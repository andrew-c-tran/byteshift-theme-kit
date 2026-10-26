/**
 * The theme frame: the page inside the sandboxed iframe that a theme runs in.
 *
 * It gives the theme React and @byteshift/theme as globals (a built theme imports both but carries
 * neither), loads the theme's stylesheets and script, and lays out its three components: the strip
 * down the left edge, and the two pages on a track that the panel's swipes move. The swipes are
 * recognised by the panel, outside this frame; it only ever hears where the track should be.
 *
 * The sandbox has no same-origin access, so the host's page, its native bridge and the car link
 * are all out of reach. Commands leave only as messages, and the host decides what to do with them.
 */
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { Component, useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import * as api from '../index';
import { THEME_BASE, type FrameToHost, type HostToFrame, type PageIndex } from '../protocol';
import { getState, setState, setSender, subscribe } from '../store';
import type { CommandResult, Theme } from '../types';

declare global {
  interface Window {
    BST?: { React: typeof React; jsxRuntime: typeof jsxRuntime; api: typeof api };
    __bstTheme?: { default?: Theme };
  }
}

window.BST = { React, jsxRuntime, api };

function post(message: FrameToHost) {
  window.parent.postMessage(message, '*');
}

// --- commands ---

let nextId = 1;
const pending = new Map<number, (r: CommandResult) => void>();

setSender((command) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  post({ bst: 1, type: 'command', id, command });
}));

// --- loading the theme ---

let theme: Theme | null = null;
let loading = false;

function fail(where: string, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`theme ${where}:`, e);
  post({ bst: 1, type: 'error', where, message });
}

function load(entry: string, styles: string[], cacheKey: string) {
  if (loading) return;
  loading = true;
  const v = `?v=${encodeURIComponent(cacheKey)}`;
  for (const href of styles) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = THEME_BASE + href + v;
    document.head.appendChild(link);
  }
  const script = document.createElement('script');
  script.src = THEME_BASE + entry + v;
  script.onload = () => {
    const t = window.__bstTheme?.default;
    const missing = (['Strip', 'ClimatePage', 'RadioPage'] as const).filter((k) => typeof t?.[k] !== 'function');
    if (!t || missing.length) {
      fail('load', new Error(missing.length
        ? `the theme's default export has no ${missing.join(', ')}`
        : 'the theme script did not export a theme (is it a bst build?)'));
      return;
    }
    theme = t;
    createRoot(document.getElementById('root')!).render(<Root theme={t} />);
  };
  script.onerror = () => fail('load', new Error(`could not load ${entry}`));
  document.head.appendChild(script);
}

window.addEventListener('message', (e: MessageEvent<HostToFrame>) => {
  if (e.source !== window.parent) return;
  const m = e.data;
  if (!m || m.bst !== 1) return;
  switch (m.type) {
    case 'init':
      setState({ car: m.state, geometry: m.geometry, tray: m.tray });
      load(m.manifest.entry, m.manifest.styles, m.cacheKey);
      break;
    case 'state':
      setState({ car: m.state });
      break;
    case 'geometry':
      setState({ geometry: m.geometry });
      break;
    case 'tray':
      setState({ tray: m.tray });
      break;
    case 'result': {
      const done = pending.get(m.id);
      pending.delete(m.id);
      done?.(m.result);
      break;
    }
  }
});

// Before the theme is up these are the frame's own or the theme script's top-level failures, and the
// host needs to hear about those just as much.
window.addEventListener('error', (e) => fail(theme ? 'runtime' : 'load', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => fail(theme ? 'runtime' : 'load', e.reason));
// A blocked load (the frame's Content-Security-Policy) is not an error event; report it too.
document.addEventListener('securitypolicyviolation', (e) =>
  fail('policy', new Error(`blocked ${e.blockedURI} (${e.violatedDirective})`)));

// --- layout ---

/** One part of the theme. If it throws, the host is told, and it falls back to the default theme. */
class Part extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    fail(this.props.name, error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useFrame() {
  return useSyncExternalStore(subscribe, getState);
}

function Root({ theme: t }: { theme: Theme }) {
  const { geometry: g, tray } = useFrame();
  const track = useRef<HTMLDivElement>(null);

  // Ready once every part has committed once: the strip, and both pages on the (hidden) track.
  useEffect(() => { post({ bst: 1, type: 'ready' }); }, []);

  // A settle with nothing to animate (already there) ends at once; the rest end on transitionend.
  const lastTransform = useRef('');
  const transform = `translateX(${tray.reveal - 2 * g.width}px)`;
  useLayoutEffect(() => {
    const moved = transform !== lastTransform.current;
    lastTransform.current = transform;
    if (tray.mode === 'settling' && !moved) post({ bst: 1, type: 'settled', page: tray.target });
  }, [transform, tray.mode, tray.target]);

  const { Strip, ClimatePage, RadioPage } = t;
  const page = { position: 'relative' as const, width: g.width, height: g.height, overflow: 'hidden', flex: 'none' };
  return (
    <>
      <div className="bst-strip" style={{ position: 'absolute', left: 0, top: 0, width: g.stripWidth, height: g.height }}>
        <Part name="Strip"><Strip /></Part>
      </div>
      <div
        ref={track}
        className="bst-track"
        style={{
          position: 'absolute', left: 0, top: 0, display: tray.mode === 'collapsed' ? 'none' : 'flex',
          width: 2 * g.width, height: g.height, transform, willChange: 'transform',
          transition: tray.mode === 'settling' ? 'transform 220ms cubic-bezier(.2, .8, .2, 1)' : 'none',
        }}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && e.propertyName === 'transform' && tray.mode === 'settling') {
            post({ bst: 1, type: 'settled', page: tray.target as PageIndex });
          }
        }}
      >
        {/* Radio sits to the left of climate: each swipe out pulls the next page in from the left. */}
        <div className="bst-page bst-radio" style={page}><Part name="RadioPage"><RadioPage /></Part></div>
        <div className="bst-page bst-climate" style={page}><Part name="ClimatePage"><ClimatePage /></Part></div>
      </div>
    </>
  );
}
