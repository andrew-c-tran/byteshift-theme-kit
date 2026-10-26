import type { ComponentType } from 'react';
import type { Button, Command } from './commands';

/** Where the air is going, or null when nothing is selected (front defrost clears it). */
export type Vent = 'face' | 'face-feet' | 'feet' | 'feet-screen' | null;

/**
 * What the car reports about climate and audio: which functions are on, never a level.
 *
 * The car does not report the temperature setpoints, the fan speed or the volume, and the panel
 * cannot work them out. Those controls are up and down only (see KNOBS), and a theme has no number
 * to show for them.
 */
export interface ClimateState {
  dual: boolean;
  auto: boolean;
  ac: boolean;
  /** The whole system is off. */
  off: boolean;
  intake: 'fresh' | 'recirc';
  vent: Vent;
  frontDefrost: boolean;
  rearDefrost: boolean;
}

export interface RadioState {
  muted: boolean;
}

export interface ControlState {
  /** The panel can reach the car's controller. */
  connected: boolean;
  /** There is no car: the panel (or `bst dev`) is simulating one. */
  simulated: boolean;
  /**
   * The controller will act on climate and audio commands. It starts false on every drive and
   * becomes true after `ENABLE_CONTROL`; until then every other command is refused.
   */
  enabled: boolean;
  /** Buttons the car has no command for yet. Draw them as unavailable rather than leave them dead. */
  unavailable: Button[];
}

export interface CarState {
  climate: ClimateState;
  radio: RadioState;
  control: ControlState;
}

/** Which of the panel's surfaces is showing. */
export type Page = 'closed' | 'climate' | 'radio';

export interface PanelState {
  /** The page the panel is on, or heading to while it settles. */
  page: Page;
  /** A swipe is in progress or the panel is still animating to `page`. */
  moving: boolean;
  /** The whole screen, in CSS px. Pages are this size. */
  width: number;
  height: number;
  /** The strip's width, in CSS px. Fixed by the panel; a theme cannot change it. */
  stripWidth: number;
  /** Space the system's own bars may take at the top and bottom edges. Usually 0. */
  insetTop: number;
  insetBottom: number;
}

export type CommandResult =
  | { ok: true }
  | {
    ok: false;
    /**
     * - `unknown`: not a command (only possible from untyped JavaScript)
     * - `unavailable`: the car has no command for this yet - see `ControlState.unavailable`
     * - `disabled`: control has not been enabled for this drive - see `ENABLE_CONTROL`
     * - `offline`: the panel cannot reach the car's controller
     */
    reason: 'unknown' | 'unavailable' | 'disabled' | 'offline';
  };

/** What a theme hands the panel. Every component fills the space it is given. */
export interface Theme {
  /** The always-visible column down the left edge, `stripWidth` wide and the full height. */
  Strip: ComponentType;
  /** The first page, shown when the panel is swiped out. Full screen. */
  ClimatePage: ComponentType;
  /** The second page, one more swipe along. Full screen. */
  RadioPage: ComponentType;
}

export type { Button, Command };
