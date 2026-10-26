# ByteShift theme kit

Build the look of the ByteShift panel: the climate and audio controls in a Nissan GT-R (R35)
whose factory panel has been replaced by a touchscreen running CarPlay and Android Auto.

A theme is three React components and some CSS:

| Component     | Where it shows                                                        |
| ------------- | --------------------------------------------------------------------- |
| `Strip`       | Always visible down the left edge of the screen, 128 px wide.         |
| `ClimatePage` | Full screen, when the driver swipes the panel out.                    |
| `RadioPage`   | Full screen, one more swipe along.                                    |

You build them into a single `.bst` file, and the owner sends that file to the panel from their
phone. Backgrounds, fonts, images, layout and animation are all yours to design. The panel keeps
the bottom bar (HOME, the ByteShift button, the drive-mode readout and routines), and it handles
the swipes between pages.

```tsx
import { defineTheme, useClimate, sendCommand, PressButton } from '@byteshift/theme';
import './theme.css';

function ClimatePage() {
  const climate = useClimate();
  if (!climate) return null;
  return (
    <div className="page">
      <button onClick={() => sendCommand('LH_TEMP_UP')}>+</button>
      <span>TEMP</span>
      <button onClick={() => sendCommand('LH_TEMP_DOWN')}>–</button>
      <PressButton button="AC" className={climate.ac ? 'on' : ''}>A/C</PressButton>
    </div>
  );
}

export default defineTheme({ Strip, ClimatePage, RadioPage });
```

## Quick start

You need Node.js 20 or later.

```sh
npx github:andrew-c-tran/byteshift-theme-kit init my-theme   # a copy of the default theme
cd my-theme
npm install
npm run dev                                                   # simulator on http://localhost:5173
npm run pack                                                  # writes my-theme-0.1.0.bst
```

`npm run dev` opens the panel's screen at its real size, with a simulated car behind it. Each save
rebuilds the theme and reloads it. **Back** and **Next** (or the arrow keys) stand in for the
swipes, and the **drag** slider holds the panel part-way out. Every command your theme sends is
logged next to the screen, along with the car's answer.

To install a theme, open **Panel Look** on the panel's home screen, join the Wi-Fi network it
shows, and upload the `.bst` file from your phone.

## How the car is exposed

The car is **read** through hooks (`useClimate`, `useRadio`, `useControl`) and **driven** with
`sendCommand`. There are two kinds of command, matching the two kinds of control on the factory
panel:

- **Knobs** turn one detent per command: `LH_TEMP_UP`, `FAN_DOWN`, `VOLUME_UP`, `TUNE_UP`, and so on.
- **Buttons** are pressed and released: `AC_PRESSED`, then `AC_RELEASED`. Use `<PressButton>` or
  `usePress()`, which send the pair as the finger goes down and comes up.

Draw what the car reports, not what was tapped. A button lights because `climate.ac` became true,
not because it was pressed.

The car reports which functions are on, but never a level. **There is no temperature, fan speed
or volume to show,** so those controls are up and down buttons with nothing between them. Some
buttons have no command yet. They are listed in `control.unavailable`, and `<PressButton>`
disables them for you.

Nothing outside climate and audio is reachable. The drive-mode switches and routines are not part
of the kit.

## Documentation

- [docs/API.md](docs/API.md): every hook, command and type.
- [docs/FORMAT.md](docs/FORMAT.md): the `.bst` file, project layout, screen sizes and the sandbox
  rules.
- [examples/default](examples/default): the panel's own theme. It is complete, and it is the best
  reference for how the pieces fit.

## Commands

```sh
bst init <dir>          start a new theme from the default one
bst dev [dir]           simulator, rebuilding on save (--port to change 5173)
bst build [dir]         build into <dir>/dist
bst pack [dir]          build, check, and write <name>-<version>.bst
bst check <file.bst>    run the checks the panel makes before installing
```

## License

MIT for the kit and the default theme's code. The default theme's Barlow fonts are under the SIL
Open Font License (`examples/default/assets/fonts/OFL.txt`).
