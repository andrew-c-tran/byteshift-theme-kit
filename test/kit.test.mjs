// node --test test/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as esbuild from 'esbuild';
import { checkPack, unzip, zip } from '../cli/pack.mjs';

/** Loads a TypeScript module from src/ by bundling it, since node cannot import it directly. */
async function load(entry) {
  const r = await esbuild.build({
    entryPoints: [new URL(entry, import.meta.url).pathname], bundle: true, format: 'esm',
    platform: 'node', write: false, logLevel: 'silent',
  });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].contents).toString('base64')}`);
}

const manifest = (over = {}) => JSON.stringify({
  format: 1, name: 'T', author: 'A', version: '1.0.0', sdk: '0.1.0', entry: 'theme.js', styles: ['theme.css'], ...over,
});
const pack = (files) => zip(Object.entries(files).map(([name, data]) => ({ name, data: Buffer.from(data) })));
const good = { 'manifest.json': manifest(), 'theme.js': 'var __bstTheme=(()=>{})();', 'theme.css': 'body{}' };

test('a well-formed pack passes, and round-trips through zip', () => {
  const buf = pack(good);
  assert.deepEqual(checkPack(buf), []);
  assert.deepEqual(unzip(buf).map((f) => f.name).sort(), ['manifest.json', 'theme.css', 'theme.js']);
  assert.equal(unzip(buf).find((f) => f.name === 'theme.css').data.toString(), 'body{}');
});

test('a pack with no manifest is refused', () => {
  assert.match(checkPack(pack({ 'theme.js': 'x' })).join(), /no manifest\.json/);
});

test('an unsafe path is refused', () => {
  assert.match(checkPack(pack({ ...good, '../escape.txt': 'x' })).join(), /unsafe path/);
});

test('a missing entry or stylesheet is refused', () => {
  assert.match(checkPack(pack({ 'manifest.json': manifest(), 'theme.css': '' })).join(), /entry theme\.js is not in the pack/);
  assert.match(checkPack(pack({ ...good, 'manifest.json': manifest({ styles: ['x.css'] }) })).join(), /x\.css/);
});

test('a later format is refused', () => {
  assert.match(checkPack(pack({ ...good, 'manifest.json': manifest({ format: 2 }) })).join(), /format 2/);
});

test('a theme that bundles its own React is refused', () => {
  assert.match(checkPack(pack({ ...good, 'theme.js': 'var __bstTheme; /* react.production.js */' })).join(), /own copy of React/);
});

test('commands: every button has a pressed and a released form', async () => {
  const { BUTTONS, COMMANDS, KNOBS, buttonOf, isCommand } = await load('../src/commands.ts');
  assert.equal(COMMANDS.length, KNOBS.length + 2 * BUTTONS.length);
  assert.ok(isCommand('PRESET_1_PRESSED'));
  assert.ok(isCommand('LH_TEMP_UP'));
  assert.ok(!isCommand('PRESET_1'), 'a bare button name is not a command');
  assert.ok(!isCommand('VDC_OFF_PRESSED'), 'the set-up switches are not reachable from a theme');
  assert.equal(buttonOf('ENABLE_CONTROL_RELEASED'), 'ENABLE_CONTROL');
  assert.equal(buttonOf('FAN_UP'), null);
});

test('the simulated car refuses everything until control is enabled', async () => {
  const { SimCar } = await load('../src/sim/car.ts');
  const car = new SimCar();
  assert.deepEqual(car.command('AC_PRESSED'), { ok: false, reason: 'disabled' });
  assert.deepEqual(car.command('ENABLE_CONTROL_PRESSED'), { ok: true });
  const ac = car.state.climate.ac;
  car.command('AC_PRESSED');
  assert.equal(car.state.climate.ac, !ac);
  car.command('AC_RELEASED');
  assert.equal(car.state.climate.ac, !ac, 'the release changes nothing');
  assert.deepEqual(car.command('SAT_PRESSED'), { ok: false, reason: 'unavailable' });
});

test('the simulated car reports no temperature, fan speed or volume', async () => {
  const { SimCar } = await load('../src/sim/car.ts');
  const car = new SimCar();
  car.command('ENABLE_CONTROL_PRESSED');
  for (const key of ['driver', 'passenger', 'fan']) assert.ok(!(key in car.state.climate), key);
  assert.deepEqual(Object.keys(car.state.radio), ['muted']);
  car.command('FAN_UP');
  assert.equal(car.state.climate.auto, false, 'the fan still takes the system out of AUTO');
  car.command('MUTE_PRESSED');
  car.command('VOLUME_UP');
  assert.equal(car.state.radio.muted, false, 'turning the volume unmutes');
});
