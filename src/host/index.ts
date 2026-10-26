/**
 * The host's half of the frame protocol: puts a theme in a sandboxed iframe and talks to it.
 *
 * Used by the panel and by `bst dev`'s simulator, so a theme meets exactly the same host in both.
 * The host decides what a command does; this only checks that it is one.
 */
import { isCommand, type Command } from '../commands';
import type { FrameToHost, Geometry, HostToFrame, Manifest, PageIndex, TrayPosition } from '../protocol';
import type { CarState, CommandResult } from '../types';

export interface HostOptions {
  /** Where the iframe goes. It is sized to fill this element. */
  container: HTMLElement;
  /** The frame page: `<origin>/__frame/index.html`. Theme files are then served from `<origin>/theme/`. */
  frameUrl: string;
  onCommand(command: Command): Promise<CommandResult> | CommandResult;
  onReady?(): void;
  onError?(where: string, message: string): void;
  onSettled?(page: PageIndex): void;
}

export class ThemeHost {
  private frame: HTMLIFrameElement | null = null;
  private live = false;
  private manifest: Manifest | null = null;
  private cacheKey = '';
  private state: CarState | null = null;
  private geometry: Geometry = { width: 853, height: 533, stripWidth: 128, insetTop: 0, insetBottom: 0 };
  private tray: TrayPosition = { mode: 'collapsed', reveal: 0, target: 0 };

  constructor(private readonly options: HostOptions) {
    window.addEventListener('message', this.onMessage);
  }

  /** Shows a theme, replacing whatever was showing. `cacheKey` must change whenever its files do. */
  load(manifest: Manifest, cacheKey: string): void {
    this.manifest = manifest;
    this.cacheKey = cacheKey;
    this.frame?.remove();
    this.live = false;
    const f = document.createElement('iframe');
    // allow-scripts without allow-same-origin: the theme gets an opaque origin, so this page, its
    // storage and anything it was given (the native bridge on the panel) are out of its reach.
    f.setAttribute('sandbox', 'allow-scripts');
    // color-scheme must match the frame's own (normal), or Chrome paints the iframe an opaque white.
    f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;color-scheme:normal;';
    f.src = `${this.options.frameUrl}?v=${encodeURIComponent(cacheKey)}`;
    f.addEventListener('load', () => {
      if (this.frame !== f) return;
      this.live = true;
      this.post({
        bst: 1, type: 'init', manifest, cacheKey,
        geometry: this.geometry, tray: this.tray, state: this.state,
      });
    });
    this.frame = f;
    this.options.container.appendChild(f);
  }

  /** The theme currently loaded, if any. */
  current(): Manifest | null {
    return this.manifest;
  }

  setState(state: CarState): void {
    this.state = state;
    this.post({ bst: 1, type: 'state', state });
  }

  setGeometry(geometry: Geometry): void {
    this.geometry = geometry;
    this.post({ bst: 1, type: 'geometry', geometry });
  }

  setTray(tray: TrayPosition): void {
    this.tray = tray;
    this.post({ bst: 1, type: 'tray', tray });
  }

  private post(message: HostToFrame) {
    if (this.live) this.frame?.contentWindow?.postMessage(message, '*');
  }

  private onMessage = async (e: MessageEvent<FrameToHost>) => {
    if (!this.frame || e.source !== this.frame.contentWindow) return;
    const m = e.data;
    if (!m || m.bst !== 1) return;
    switch (m.type) {
      case 'ready':
        this.options.onReady?.();
        break;
      case 'error':
        this.options.onError?.(String(m.where), String(m.message));
        break;
      case 'settled':
        this.options.onSettled?.(m.page);
        break;
      case 'command': {
        let result: CommandResult;
        if (!isCommand(m.command)) {
          result = { ok: false, reason: 'unknown' };
        } else {
          try {
            result = await this.options.onCommand(m.command);
          } catch {
            result = { ok: false, reason: 'offline' };
          }
        }
        this.post({ bst: 1, type: 'result', id: m.id, result });
        break;
      }
    }
  };
}
