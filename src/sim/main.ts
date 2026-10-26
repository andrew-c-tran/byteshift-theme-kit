/**
 * `bst dev`'s simulator page: the panel's screen at its real size, with a pretend CarPlay behind,
 * the panel's fixed bottom bar, and the theme in the same sandboxed frame the panel uses.
 *
 * The panel's swipes are stood in for by buttons, the arrow keys and a slider (to hold the panel
 * part-way out). Every command the theme sends is logged with the car's answer.
 */
import { ThemeHost } from '../host';
import type { Manifest, PageIndex, TrayPosition } from '../protocol';
import type { Command } from '../commands';
import { SimCar } from './car';

const W = 853;
const H = 533;
const STRIP = 128;
const BAND = 72;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const screen = $('#screen');
const layer = $('#theme');
const log = $('#log');
const stateView = $('#state');
const pageLabel = $('#page');
const slider = $<HTMLInputElement>('#reveal');

const car = new SimCar();
let page: PageIndex = 0;
let tray: TrayPosition = { mode: 'collapsed', reveal: 0, target: 0 };

function line(text: string, kind = '') {
  const li = document.createElement('li');
  li.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  if (kind) li.className = kind;
  log.prepend(li);
  while (log.children.length > 200) log.lastChild?.remove();
}

const host = new ThemeHost({
  container: layer,
  frameUrl: '/__frame/index.html',
  onCommand(command: Command) {
    const result = car.command(command);
    line(`${command} → ${result.ok ? 'ok' : result.reason}`, result.ok ? '' : 'refused');
    return result;
  },
  onReady: () => line('theme ready', 'info'),
  onError: (where, message) => line(`theme error in ${where}: ${message}`, 'error'),
  onSettled(p) {
    if (tray.mode !== 'settling' || p !== tray.target) return;
    setTray({ mode: p === 0 ? 'collapsed' : 'open', reveal: p * W, target: p });
  },
});

car.subscribe((s) => {
  host.setState(s);
  stateView.textContent = JSON.stringify(s, null, 2);
  ($<HTMLInputElement>('#enabled')).checked = s.control.enabled;
  ($<HTMLInputElement>('#connected')).checked = s.control.connected;
});

function setTray(t: TrayPosition) {
  tray = t;
  // As on the panel: collapsed, the theme's window is only the strip, so the app beside it can be
  // touched; otherwise it is the whole screen.
  layer.style.width = t.mode === 'collapsed' ? `${STRIP}px` : `${W}px`;
  host.setTray(t);
  slider.value = String(t.reveal);
  pageLabel.textContent = ['closed', 'climate', 'radio'][t.target];
}

function go(p: number) {
  page = Math.max(0, Math.min(2, p)) as PageIndex;
  if (tray.mode === 'collapsed') layer.style.width = `${W}px`;
  setTray({ mode: 'settling', reveal: page * W, target: page });
}

host.setGeometry({ width: W, height: H, stripWidth: STRIP, insetTop: 0, insetBottom: 0 });

$('#next').addEventListener('click', () => go(page + 1));
$('#back').addEventListener('click', () => go(page - 1));
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') go(page + 1);
  if (e.key === 'ArrowLeft') go(page - 1);
});
slider.max = String(2 * W);
slider.addEventListener('input', () => {
  layer.style.width = `${W}px`;
  setTray({ mode: 'dragging', reveal: Number(slider.value), target: page });
});
slider.addEventListener('change', () => go(Math.round(Number(slider.value) / W)));
$<HTMLInputElement>('#enabled').addEventListener('change', (e) =>
  car.patchControl({ enabled: (e.target as HTMLInputElement).checked }));
$<HTMLInputElement>('#connected').addEventListener('change', (e) =>
  car.patchControl({ connected: (e.target as HTMLInputElement).checked }));
$('#reset').addEventListener('click', () => location.reload());

// Fit the 853 x 533 screen to the window, keeping its real proportions.
function fit() {
  const box = $('#stage').getBoundingClientRect();
  const k = Math.min(box.width / W, box.height / H, 2);
  screen.style.transform = `scale(${k})`;
}
window.addEventListener('resize', fit);
fit();

// The pretend surroundings, sized as on the panel.
$('#carplay').style.cssText += `left:${STRIP}px;top:0;width:${W - STRIP}px;height:${H - BAND}px;`;
$('#band').style.cssText += `left:${STRIP}px;bottom:0;width:${W - STRIP}px;height:${BAND}px;`;

// Load the theme, and again whenever `bst dev` rebuilds it.
// ?page=climate|radio opens on that page, ?enabled=1 starts with control enabled, ?hold=0.5 leaves
// the panel half-way out: for screenshots, and for coming back to the page being worked on.
const q = new URLSearchParams(location.search);
if (q.get('enabled') === '1') car.patchControl({ enabled: true });

let opened = false;
async function loadTheme() {
  const res = await fetch('/__bst/manifest');
  if (!res.ok) {
    line(`build failed: ${await res.text()}`, 'error');
    return;
  }
  const { manifest, key } = (await res.json()) as { manifest: Manifest; key: string };
  host.load(manifest, key);
  line(`loaded ${manifest.name} ${manifest.version}`, 'info');
  if (opened) return;
  opened = true;
  const start = { climate: 1, radio: 2 }[q.get('page') ?? ''];
  const hold = Number(q.get('hold'));
  if (hold > 0) {
    layer.style.width = `${W}px`;
    setTray({ mode: 'dragging', reveal: hold * W, target: 0 });
  } else if (start) {
    page = start as PageIndex;
    setTray({ mode: 'open', reveal: start * W, target: page });
  }
}
void loadTheme();
// ?live=0 turns live reload off, which headless screenshots need to ever finish loading.
if (q.get('live') !== '0') new EventSource('/__bst/events').addEventListener('rebuilt', () => void loadTheme());
