# The .bst format

## A theme project

```
my-theme/
  bst.json          name, author, version
  package.json      devDependency on @byteshift/theme
  src/index.tsx     the entry: export default defineTheme({ Strip, ClimatePage, RadioPage })
  src/*.tsx, *.css  everything else, imported from the entry
  assets/           images, fonts, video: anything referenced by URL
```

`bst.json`:

```json
{
  "name": "Carbon",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "Optional, one line",
  "entry": "src/index.tsx",
  "assets": "assets"
}
```

`version` must be `major.minor.patch`. `entry` and `assets` are optional; the values above are the
defaults.

## What `bst build` does

- Bundles the entry and everything it imports into `theme.js`. React and `@byteshift/theme` are
  not bundled: they resolve to the copies the panel provides, which is what lets the hooks work.
  Importing `react-dom` is an error, because the panel renders your components itself.
- Gathers every imported CSS file into `theme.css`.
- Copies images and fonts that the code or CSS references into `assets/`, with a content hash in
  the name. Everything else in your `assets/` folder is copied as is, for `asset()`.
- Writes `manifest.json`.

The output targets Chromium 110 or later. The panel runs a current Chromium WebView.

## The file

A `.bst` is a zip archive:

```
manifest.json
theme.js
theme.css
assets/…
```

`manifest.json`:

```json
{
  "format": 1,
  "name": "Carbon",
  "author": "Your Name",
  "version": "1.0.0",
  "description": "Optional",
  "sdk": "0.1.0",
  "entry": "theme.js",
  "styles": ["theme.css"]
}
```

| Field         | Meaning                                                       |
| ------------- | ------------------------------------------------------------- |
| `format`      | Always `1`. The panel refuses any other format.               |
| `sdk`         | The kit version that built the pack.                          |
| `entry`       | The script, relative to the pack root.                        |
| `styles`      | Stylesheets, applied in order.                                |

### Limits the panel enforces

- At most 24 MB unpacked, and at most 300 files.
- No absolute paths and no `..` in any path.
- `entry` and every file in `styles` must be in the pack.
- The script must be a `bst build` (it must define `__bstTheme`) and must not carry its own React.

`bst pack` refuses to write a pack that breaks these rules, and `bst check` tests an existing one.

## Installing

1. On the panel, open **Panel Look** from the home screen. The panel starts a Wi-Fi network and
   shows its name and password.
2. Join it from a phone, open the address shown, and upload the `.bst`.

The new theme is on trial until all three components have drawn once. If that doesn't happen
within a few seconds, the panel puts the previous theme back. If a component throws later, the
panel switches to its built-in theme for the rest of the drive. Either way, the driver is never
left without climate controls.

## The sandbox

A theme runs in a sandboxed iframe with no same-origin access. It can reach only its own files and
the API in [API.md](API.md):

- **Files:** scripts, styles, images, fonts and media load only from the pack. `data:` and `blob:`
  URLs work for images and media.
- **Network:** there is none. `fetch`, XHR and WebSockets are blocked, and nothing loads from the
  internet: no web fonts or CDN scripts. Put everything the theme needs into `assets/`.
- **Commands:** only the climate and audio commands in API.md exist. Anything else is refused.
- **Storage:** `localStorage` and cookies are not available, because the frame has no origin of its
  own. Keep state in React.

## Screen and layout

The screen is 1280 x 800 physical pixels at 1.5 x, so **853 x 533 CSS px**. The strip is 128 px wide
at the left edge, and the panel's own bottom bar (72 px tall) runs along the bottom to its right.
Your pages cover the bar while they are out.

When closed, only the strip is on screen, and CarPlay or Android Auto runs to its right. When the
driver swipes:

```
swipe right ->  climate page    swipe right ->  radio page
            <- swipe left                   <- swipe left
```

Each page slides in from the left. During a swipe the page is part-way across the screen, with
CarPlay visible beside it. So give each page an opaque background unless you want the app to show
through.
