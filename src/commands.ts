/**
 * Everything a theme can ask the car to do.
 *
 * There are two kinds of control, because the car's own panel has two kinds:
 *
 * - **Knobs** turn in detents. Each command is one detent: `sendCommand('LH_TEMP_UP')` is one
 *   click of the driver's temperature knob. Send it again for the next click.
 * - **Buttons** are pressed and released. A theme sends `AC_PRESSED` when the finger goes down and
 *   `AC_RELEASED` when it comes up, exactly as the physical button would. `usePress()` and
 *   `<PressButton>` do this for you.
 *
 * Nothing else is reachable from a theme. The set-up switches (transmission, suspension, VDC) and
 * the controller's routines are deliberately absent: a theme is somebody else's code, and it only
 * ever gets the controls a passenger could reach on the factory panel.
 */

/** One detent per command. */
export const KNOBS = [
  /** Driver's (left-hand) temperature. */
  'LH_TEMP_UP', 'LH_TEMP_DOWN',
  /** Passenger's (right-hand) temperature. Only does anything while DUAL is on. */
  'RH_TEMP_UP', 'RH_TEMP_DOWN',
  'FAN_UP', 'FAN_DOWN',
  'VOLUME_UP', 'VOLUME_DOWN',
  /** The radio's tuning knob. */
  'TUNE_UP', 'TUNE_DOWN',
] as const;

/** Each is sent as `<NAME>_PRESSED`, then `<NAME>_RELEASED`. */
export const BUTTONS = [
  // Climate
  'AC', 'AUTO', 'DUAL',
  /** Cycles where the air goes: face, face and feet, feet, feet and screen. */
  'MODE',
  /** Fresh air / recirculate. One button, as on the car: it toggles. */
  'INTAKE',
  'FRONT_DEFROST', 'REAR_DEFROST',
  /** Switches the whole climate system off. AUTO (or any climate control) brings it back. */
  'CLIMATE_OFF',
  // Audio
  /** Toggles. */
  'MUTE',
  'AM_FM', 'AUX', 'SAT', 'SOUND',
  'SEEK', 'TRACK', 'SCAN', 'REPEAT',
  'RADIO_POWER',
  'PRESET_1', 'PRESET_2', 'PRESET_3', 'PRESET_4', 'PRESET_5', 'PRESET_6',
  /**
   * Lets the panel send climate and audio commands for this drive. The controller refuses every
   * other command until this has been pressed - see `ControlState.enabled` - so a theme has to
   * offer it somewhere, typically on the strip.
   */
  'ENABLE_CONTROL',
] as const;

export type Knob = (typeof KNOBS)[number];
export type Button = (typeof BUTTONS)[number];
export type Command = Knob | `${Button}_PRESSED` | `${Button}_RELEASED`;

/** Every valid command string, for checking one that arrived from somewhere untyped. */
export const COMMANDS: readonly Command[] = [
  ...KNOBS,
  ...BUTTONS.flatMap((b) => [`${b}_PRESSED`, `${b}_RELEASED`] as const),
];

const VALID = new Set<string>(COMMANDS);

export function isCommand(value: unknown): value is Command {
  return typeof value === 'string' && VALID.has(value);
}

/** The button a `_PRESSED` / `_RELEASED` command belongs to, or null for a knob. */
export function buttonOf(command: Command): Button | null {
  const m = /^(.*)_(PRESSED|RELEASED)$/.exec(command);
  return m ? (m[1] as Button) : null;
}
