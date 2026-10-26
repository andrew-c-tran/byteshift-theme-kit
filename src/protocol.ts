/**
 * The messages between the theme frame and the panel that hosts it.
 *
 * A theme runs in a sandboxed iframe with no access to the panel's page, so these postMessage
 * calls are the only way anything crosses. Theme authors never see them: the hooks and
 * `sendCommand` in this package are built on top. They are written down here because two hosts
 * implement the other side - the panel itself and `bst dev`'s simulator - and must agree.
 *
 * Every message carries `bst: 1`, so either side can ignore anything else that arrives.
 */
import type { CarState, CommandResult } from './types';

export const PROTOCOL = 1;

/** 0 closed, 1 the climate page, 2 the radio page. */
export type PageIndex = 0 | 1 | 2;

export interface Geometry {
  width: number;
  height: number;
  stripWidth: number;
  insetTop: number;
  insetBottom: number;
}

export interface TrayPosition {
  /**
   * - `collapsed`: only the strip is showing
   * - `dragging`: a finger is moving the panel; follow `reveal` exactly
   * - `settling`: animate to `target`, then say `settled`
   * - `open`: resting on page `target`
   */
  mode: 'collapsed' | 'dragging' | 'settling' | 'open';
  /** How far out the panel is, in CSS px: 0 closed, `width` the climate page, 2 x `width` radio. */
  reveal: number;
  target: PageIndex;
}

export interface Manifest {
  format: 1;
  name: string;
  author: string;
  version: string;
  description?: string;
  /** The kit version it was built with. */
  sdk: string;
  /** The theme's script, relative to the pack root. */
  entry: string;
  /** Stylesheets, relative to the pack root, applied in order. */
  styles: string[];
}

export type HostToFrame =
  | { bst: 1; type: 'init'; manifest: Manifest; geometry: Geometry; tray: TrayPosition; state: CarState | null; cacheKey: string }
  | { bst: 1; type: 'state'; state: CarState }
  | { bst: 1; type: 'geometry'; geometry: Geometry }
  | { bst: 1; type: 'tray'; tray: TrayPosition }
  | { bst: 1; type: 'result'; id: number; result: CommandResult };

export type FrameToHost =
  /** All three components have drawn once. A new theme stays installed only after this. */
  | { bst: 1; type: 'ready' }
  | { bst: 1; type: 'command'; id: number; command: string }
  /** A settle animation finished on this page. */
  | { bst: 1; type: 'settled'; page: PageIndex }
  /** The theme failed to load, or a component threw. The host falls back to the default theme. */
  | { bst: 1; type: 'error'; where: string; message: string };

/** Where, relative to the frame's own page, the installed theme's files are served. */
export const THEME_BASE = '../theme/';
