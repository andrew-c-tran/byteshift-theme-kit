# API

Everything is imported from `@byteshift/theme`. The panel supplies this package and React at
runtime, so a built theme carries neither: `bst build` sees to that.

## The theme

```ts
export default defineTheme({ Strip, ClimatePage, RadioPage });
```

The theme's entry file must default-export this. Each component takes no props and fills the box
it is given:

| Component     | Box                                       |
| ------------- | ----------------------------------------- |
| `Strip`       | 128 x 533 CSS px, at the left edge        |
| `ClimatePage` | 853 x 533, the whole screen               |
| `RadioPage`   | 853 x 533, the whole screen               |

Use `usePanel()` rather than hard-coding these sizes. Both pages stay mounted the whole time, so
their state survives swiping between them.

## Reading the car

All hooks return `null` until the panel has heard from the car, so handle that first.

### `useClimate(): ClimateState | null`

| Field          | Type                                                              | Notes                                                                       |
| -------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `driver`       | `{ temp: number; known: boolean }`                                | In the units the car displays. `known: false` means the car is estimating.  |
| `passenger`    | same                                                              | Repeats `driver` while `dual` is off.                                       |
| `dual`         | `boolean`                                                         |                                                                             |
| `auto`         | `boolean`                                                         |                                                                             |
| `ac`           | `boolean`                                                         |                                                                             |
| `off`          | `boolean`                                                         | The whole system is off.                                                    |
| `fan`          | `number \| null`                                                  | 1 to 7, 0 when off, `null` while AUTO is choosing the speed.                |
| `intake`       | `'fresh' \| 'recirc'`                                             |                                                                             |
| `vent`         | `'face' \| 'face-feet' \| 'feet' \| 'feet-screen' \| null`        | `null` when nothing is selected (front defrost clears it).                  |
| `frontDefrost` | `boolean`                                                         |                                                                             |
| `rearDefrost`  | `boolean`                                                         |                                                                             |

**Why setpoints are estimated.** Nothing on the car's bus reports a temperature setpoint. The
controller counts knob detents from a starting guess. Once a zone has been turned to its lowest or
highest setting, the count is exact and `known` becomes true. Draw an estimate differently from a
known value; the default theme adds a small `?`.

### `useRadio(): RadioState | null`

| Field         | Type      | Notes                                    |
| ------------- | --------- | ---------------------------------------- |
| `volume`      | `number`  |                                          |
| `volumeKnown` | `boolean` | Estimated, like a setpoint, until it has been turned to a limit. |
| `muted`       | `boolean` |                                          |

### `useControl(): ControlState | null`

| Field         | Type       | Notes                                                                                     |
| ------------- | ---------- | ----------------------------------------------------------------------------------------- |
| `connected`   | `boolean`  | The panel can reach the car's controller.                                                 |
| `simulated`   | `boolean`  | There is no car: the panel or `bst dev` is simulating one.                                |
| `enabled`     | `boolean`  | Control is on for this drive. **Every command except `ENABLE_CONTROL` is refused until it is.** |
| `unavailable` | `Button[]` | Buttons the car has no command for yet.                                                   |

**Every theme must offer `ENABLE_CONTROL` somewhere a driver can always reach it,** usually on the
strip while `enabled` is false. Control starts off on every drive. Without that button, a theme
cannot change anything.

### `useCar(): CarState | null`

`{ climate, radio, control }` in one object.

### `useAvailable(button): boolean`

Whether the car has a command for this button.

### `usePanel(): PanelState`

| Field                    | Type                                | Notes                                              |
| ------------------------ | ----------------------------------- | -------------------------------------------------- |
| `page`                   | `'closed' \| 'climate' \| 'radio'`  | Where the panel is, or where it is heading.        |
| `moving`                 | `boolean`                           | A swipe or its animation is in progress.           |
| `width`, `height`        | `number`                            | The screen, in CSS px. Pages are this size.        |
| `stripWidth`             | `number`                            | Fixed by the panel.                                |
| `insetTop`, `insetBottom`| `number`                            | Space the system's bars may cover. Usually 0.      |

## Driving the car

### `sendCommand(command): Promise<CommandResult>`

Resolves once the panel has accepted or refused the command, not once the car has acted on it.
What the car actually did arrives through the hooks.

```ts
type CommandResult =
  | { ok: true }
  | { ok: false; reason: 'unknown' | 'unavailable' | 'disabled' | 'offline' };
```

### Knobs: one detent per command

| Command                           | Control                                      |
| --------------------------------- | -------------------------------------------- |
| `LH_TEMP_UP`, `LH_TEMP_DOWN`      | Driver's (left-hand) temperature             |
| `RH_TEMP_UP`, `RH_TEMP_DOWN`      | Passenger's temperature; only while `dual`   |
| `FAN_UP`, `FAN_DOWN`              | Blower; takes the system out of AUTO         |
| `VOLUME_UP`, `VOLUME_DOWN`        | Volume                                       |
| `TUNE_UP`, `TUNE_DOWN`            | Radio tuning                                 |

### Buttons: `<NAME>_PRESSED`, then `<NAME>_RELEASED`

| Button                                                             | Notes                                                    |
| ------------------------------------------------------------------ | -------------------------------------------------------- |
| `AC`, `AUTO`, `DUAL`                                               |                                                          |
| `MODE`                                                             | Cycles `vent`                                            |
| `INTAKE`                                                           | Toggles fresh / recirculate                              |
| `FRONT_DEFROST`, `REAR_DEFROST`                                    |                                                          |
| `CLIMATE_OFF`                                                      | AUTO, or any climate control, turns the system back on   |
| `MUTE`                                                             | Toggles                                                  |
| `AM_FM`, `AUX`, `SAT`, `SOUND`, `SEEK`, `TRACK`, `SCAN`, `REPEAT`, `RADIO_POWER` | `SAT` and `RADIO_POWER` have no command yet |
| `PRESET_1` … `PRESET_6`                                            |                                                          |
| `ENABLE_CONTROL`                                                   | Turns control on for this drive (see `useControl`)       |

Send the release, however the touch ends. The car acts on the press today, but a held button (for
example, holding a preset to store a station) is told apart from a tap by the release.

### `<PressButton button="…">`

A `<button>` that sends the pair for you. It takes every ordinary button prop. While held it
carries a `data-held` attribute for styling, and it is `disabled` when the car has no command for
that button.

```tsx
<PressButton button="REAR_DEFROST" className={climate.rearDefrost ? 'on' : ''}>REAR</PressButton>
```

### `usePress(button)`

The same behaviour as pointer handlers to spread onto any element, plus `held`:

```tsx
const { held, ...press } = usePress('PRESET_3');
return <div {...press} className={held ? 'down' : ''}>3</div>;
```

If the button's meaning changes while it is held, the release still goes to the button that was
pressed. The default theme's single AUTO/OFF key relies on this.

### Constants

`KNOBS`, `BUTTONS` and `COMMANDS` list every valid name. `isCommand(value)` checks an untyped string.

## Files

### `asset(path): string`

A URL for a file in the theme's `assets/` folder: `<img src={asset('logo.png')} />`. You can also
import the file, which is checked at build time: `import logo from '../assets/logo.png'`. In CSS, a
plain relative `url(...)` works.

## Swipes

The panel owns horizontal swipes: it uses them to move between the strip and the two pages, and it
takes them from your components. Vertical scrolling and taps are yours. Don't build controls that
need a horizontal drag; use buttons, or a vertical gesture, instead.
