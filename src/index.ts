/**
 * @byteshift/theme - everything a theme imports.
 *
 *     import { defineTheme, useClimate, sendCommand, PressButton } from '@byteshift/theme';
 *
 * A theme is three React components (see `Theme`). They read the car through the hooks below and
 * act on it with `sendCommand`. The panel supplies React and this package at runtime, so a built
 * theme carries only its own code: `bst build` sees to that.
 */
import { createElement, useCallback, useRef, useState, useSyncExternalStore } from 'react';
import type { ButtonHTMLAttributes, PointerEvent as ReactPointerEvent } from 'react';
import type { Button, Command } from './commands';
import { THEME_BASE } from './protocol';
import { getState, send, subscribe } from './store';
import type {
  CarState, ClimateState, CommandResult, ControlState, Page, PanelState, RadioState, Theme,
} from './types';

export * from './commands';
export type * from './types';

/** Marks the default export of a theme's entry file. It only adds type checking. */
export function defineTheme(theme: Theme): Theme {
  return theme;
}

/**
 * Asks the car to do something. Resolves once the panel has accepted or refused it - not when the
 * car has done it. What the car actually did comes back through the state hooks, and that is what
 * a theme should draw: a button lights because the car says it is on, never because it was tapped.
 */
export function sendCommand(command: Command): Promise<CommandResult> {
  return send(command);
}

function useFrame() {
  return useSyncExternalStore(subscribe, getState);
}

/** The whole car, or null until the panel has heard from it. */
export function useCar(): CarState | null {
  return useFrame().car;
}

export function useClimate(): ClimateState | null {
  return useFrame().car?.climate ?? null;
}

export function useRadio(): RadioState | null {
  return useFrame().car?.radio ?? null;
}

export function useControl(): ControlState | null {
  return useFrame().car?.control ?? null;
}

const PAGES: Page[] = ['closed', 'climate', 'radio'];

/** Where the panel is and how big things are. */
export function usePanel(): PanelState {
  const { geometry, tray } = useFrame();
  return {
    page: PAGES[tray.target],
    moving: tray.mode === 'dragging' || tray.mode === 'settling',
    ...geometry,
  };
}

/** Whether the car has a command for this button at all. */
export function useAvailable(button: Button): boolean {
  const control = useControl();
  return !control?.unavailable.includes(button);
}

/**
 * A file shipped in the theme's `assets/` folder, as a URL: `asset('bg.jpg')`.
 *
 * Importing the file works too and is checked at build time: `import bg from '../assets/bg.jpg'`.
 * Inside a stylesheet, a plain relative `url(...)` is all that is needed.
 */
export function asset(path: string): string {
  return THEME_BASE + 'assets/' + path.replace(/^\/+/, '');
}

export interface PressHandlers {
  onPointerDown(e: ReactPointerEvent<Element>): void;
  onPointerUp(): void;
  onPointerCancel(): void;
  onLostPointerCapture(): void;
}

/**
 * Pointer handlers that press a car button while a finger is down: `<NAME>_PRESSED` on the way
 * down, `<NAME>_RELEASED` on the way up, however the touch ends. Spread them onto any element.
 * `held` is true in between, for drawing the pressed look.
 */
export function usePress(button: Button): PressHandlers & { held: boolean } {
  // The button actually pressed. A control whose meaning follows the car (one AUTO/OFF key, say)
  // can change `button` while it is held; the release must still go to the button that was pressed.
  const down = useRef<Button | null>(null);
  const [held, setHeld] = useState(false);
  const release = useCallback(() => {
    const pressed = down.current;
    if (!pressed) return;
    down.current = null;
    setHeld(false);
    void send(`${pressed}_RELEASED`);
  }, []);
  return {
    held,
    onPointerDown(e) {
      if (down.current) return;
      // Keep the finger's up and cancel even if it slides off the element.
      e.currentTarget.setPointerCapture?.(e.pointerId);
      down.current = button;
      setHeld(true);
      void send(`${button}_PRESSED`);
    },
    onPointerUp: release,
    onPointerCancel: release,
    onLostPointerCapture: release,
  };
}

export interface PressButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  button: Button;
}

/**
 * A `<button>` that presses a car button. While held it carries `data-held`, and a button the car
 * has no command for is `disabled`. Everything else is passed through, so style it as you like.
 */
export function PressButton({ button, disabled, ...rest }: PressButtonProps) {
  const press = usePress(button);
  const available = useAvailable(button);
  const { held, ...handlers } = press;
  return createElement('button', {
    type: 'button',
    ...rest,
    ...handlers,
    disabled: disabled || !available,
    'data-held': held ? '' : undefined,
  });
}
