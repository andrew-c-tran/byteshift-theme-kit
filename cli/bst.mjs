#!/usr/bin/env node
/**
 * bst - build, preview and package ByteShift panel themes.
 *
 *   bst init <dir>          start a new theme from the default one
 *   bst dev [dir]           simulator at http://localhost:5173, rebuilding on save
 *   bst build [dir]         build into <dir>/dist
 *   bst pack [dir]          build, then write <name>-<version>.bst
 *   bst check <file.bst>    the checks the panel makes before installing a pack
 *
 * <dir> is a theme project: a folder with a bst.json (see docs/FORMAT.md). Default: the current one.
 */
import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPack, zip } from './pack.mjs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SDK_VERSION = JSON.parse(readFileSync(join(KIT, 'package.json'), 'utf8')).version;

/** The panel's WebView is Chromium 158; this leaves room for an older one. */
const TARGET = 'chrome110';

const ASSET_LOADERS = Object.fromEntries(
  ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg', '.ttf', '.otf', '.woff', '.woff2', '.mp4', '.webm']
    .map((ext) => [ext, 'file']),
);

function fail(message) {
  console.error(`bst: ${message}`);
  process.exit(1);
}

// --- the project ---

function readProject(dir) {
  const file = join(dir, 'bst.json');
  if (!existsSync(file)) fail(`no bst.json in ${dir} (run bst init to start a theme)`);
  let p;
  try {
    p = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`bst.json is not valid JSON: ${e.message}`);
  }
  for (const key of ['name', 'author', 'version']) {
    if (typeof p[key] !== 'string' || !p[key].trim()) fail(`bst.json needs a "${key}"`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(p.version)) fail('bst.json "version" must look like 1.0.0');
  return { entry: 'src/index.tsx', assets: 'assets', ...p };
}

function manifestFor(project, hasCss) {
  return {
    format: 1,
    name: project.name,
    author: project.author,
    version: project.version,
    ...(project.description ? { description: project.description } : {}),
    sdk: SDK_VERSION,
    entry: 'theme.js',
    styles: hasCss ? ['theme.css'] : [],
  };
}

/**
 * A theme imports React and @byteshift/theme but must not carry them: the panel provides both, so
 * every theme shares one React and one copy of the car's state. These resolve to the frame's globals.
 */
const GLOBALS = {
  'react': 'window.BST.React',
  'react/jsx-runtime': 'window.BST.jsxRuntime',
  'react/jsx-dev-runtime': 'window.BST.jsxRuntime',
  '@byteshift/theme': 'window.BST.api',
};

const panelGlobals = {
  name: 'bst-globals',
  setup(build) {
    build.onResolve({ filter: /^(react|react\/jsx-runtime|react\/jsx-dev-runtime|@byteshift\/theme)$/ }, (a) =>
      ({ path: a.path, namespace: 'bst-global' }));
    build.onResolve({ filter: /^react-dom(\/.*)?$/ }, () => ({
      errors: [{ text: 'a theme cannot import react-dom: the panel renders the theme\'s components itself' }],
    }));
    build.onLoad({ filter: /.*/, namespace: 'bst-global' }, (a) =>
      ({ contents: `module.exports = ${GLOBALS[a.path]};`, loader: 'js' }));
  },
};

function themeOptions(dir, project, dev) {
  const entry = resolve(dir, project.entry);
  if (!existsSync(entry)) fail(`bst.json says the entry is ${project.entry}, which does not exist`);
  return {
    entryPoints: { theme: entry },
    bundle: true,
    format: 'iife',
    globalName: '__bstTheme',
    target: TARGET,
    jsx: 'automatic',
    loader: ASSET_LOADERS,
    assetNames: 'assets/[name]-[hash]',
    // The frame page is /__frame/index.html and the pack is served at /theme/, on the panel and in
    // the simulator alike, so this one prefix works from the script and from the stylesheet.
    publicPath: '../theme',
    outdir: join(dir, 'dist'),
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    logLevel: 'silent',
    plugins: [panelGlobals],
    metafile: true,
  };
}

/**
 * Copies the assets folder into the pack, so asset('name.png') works for files no code imports.
 * Files the build already emitted (fonts and images the CSS or code references) are left out, or
 * every one of them would ship twice.
 */
function finish(dir, project, metafile) {
  const dist = join(dir, 'dist');
  const assets = join(dir, project.assets);
  const bundled = new Set(Object.values(metafile?.outputs ?? {})
    .flatMap((o) => Object.keys(o.inputs))
    .map((i) => resolve(process.cwd(), i)));
  if (existsSync(assets)) {
    cpSync(assets, join(dist, 'assets'), { recursive: true, filter: (src) => !bundled.has(resolve(src)) });
  }
  const manifest = manifestFor(project, existsSync(join(dist, 'theme.css')));
  writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

function report(result) {
  for (const w of result.warnings) console.warn(`warning: ${esbuild.formatMessagesSync([w], { kind: 'warning' }).join('')}`);
}

async function build(dir, dev = false) {
  const project = readProject(dir);
  rmSync(join(dir, 'dist'), { recursive: true, force: true });
  let result;
  try {
    result = await esbuild.build(themeOptions(dir, project, dev));
    report(result);
  } catch (e) {
    fail(`build failed:\n${(e.errors ?? []).map((m) => esbuild.formatMessagesSync([m], { kind: 'error' }).join('')).join('') || e.message}`);
  }
  const manifest = finish(dir, project, result.metafile);
  return { project, manifest };
}

function walk(dir, base = dir) {
  return readdirSync(dir).flatMap((f) => {
    const full = join(dir, f);
    return statSync(full).isDirectory() ? walk(full, base) : [relative(base, full).split(sep).join('/')];
  });
}

async function pack(dir) {
  const { manifest } = await build(dir);
  const dist = join(dir, 'dist');
  const files = walk(dist).sort().map((name) => ({ name, data: readFileSync(join(dist, name)) }));
  const out = join(dir, `${manifest.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${manifest.version}.bst`);
  const buf = zip(files);
  const problems = checkPack(buf);
  if (problems.length) fail(`the pack would be refused:\n  - ${problems.join('\n  - ')}`);
  writeFileSync(out, buf);
  console.log(`${relative(process.cwd(), out) || out}  ${(buf.length / 1024).toFixed(0)} KB, ${files.length} files`);
}

function check(file) {
  if (!file || !existsSync(file)) fail('usage: bst check <file.bst>');
  const problems = checkPack(readFileSync(file));
  if (problems.length) fail(`${file} would be refused:\n  - ${problems.join('\n  - ')}`);
  console.log(`${file}: the panel will accept it`);
}

function init(dir) {
  if (!dir) fail('usage: bst init <dir>');
  if (existsSync(dir) && readdirSync(dir).length) fail(`${dir} is not empty`);
  const from = join(KIT, 'examples', 'default');
  cpSync(from, dir, {
    recursive: true,
    filter: (src) => !/[\\/](dist|node_modules)([\\/]|$)/.test(src) && extname(src) !== '.bst' && basename(src) !== 'package-lock.json',
  });
  const p = JSON.parse(readFileSync(join(dir, 'bst.json'), 'utf8'));
  p.name = 'My Theme';
  p.author = 'You';
  p.version = '0.1.0';
  delete p.description;
  writeFileSync(join(dir, 'bst.json'), JSON.stringify(p, null, 2) + '\n');
  // The example points at the kit beside it; a new project gets the kit from where it is published.
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  pkg.name = basename(resolve(dir)).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  pkg.devDependencies['@byteshift/theme'] = 'github:andrew-c-tran/byteshift-theme-kit';
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  console.log(`${dir}: a copy of the default theme. Next: cd ${dir} && npm install && npx bst dev`);
}

async function frame(out) {
  mkdirSync(out, { recursive: true });
  await esbuild.build({
    entryPoints: [join(KIT, 'src/frame/main.tsx')], bundle: true, format: 'iife', target: TARGET, jsx: 'automatic',
    outfile: join(out, 'frame.js'), minify: true, logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  cpSync(join(KIT, 'src/frame/index.html'), join(out, 'index.html'));
  console.log(`frame: ${relative(process.cwd(), out) || out}`);
}

// --- dev server ---

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

/** What the frame may load: its own origin's files and nothing else, so a theme cannot phone home. */
export function frameCsp(origin) {
  return [
    "default-src 'none'",
    `script-src ${origin}`,
    `style-src ${origin} 'unsafe-inline'`,
    `img-src ${origin} data: blob:`,
    `font-src ${origin} data:`,
    `media-src ${origin} blob:`,
    "connect-src 'none'",
  ].join('; ');
}

async function bundleKitScript(entry) {
  const r = await esbuild.build({
    entryPoints: [join(KIT, entry)], bundle: true, format: 'iife', target: TARGET, jsx: 'automatic',
    write: false, minify: false, sourcemap: 'inline', logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  return r.outputFiles[0].contents;
}

async function dev(dir, port) {
  const project = readProject(dir);
  const dist = join(dir, 'dist');
  const [frameJs, simJs] = await Promise.all([bundleKitScript('src/frame/main.tsx'), bundleKitScript('src/sim/main.ts')]);
  let key = String(Date.now());
  let manifest = null;
  let error = null;
  const clients = new Set();

  rmSync(dist, { recursive: true, force: true });
  const ctx = await esbuild.context({
    ...themeOptions(dir, project, true),
    plugins: [panelGlobals, {
      name: 'bst-dev',
      setup(b) {
        b.onEnd((result) => {
          if (result.errors.length) {
            error = esbuild.formatMessagesSync(result.errors, { kind: 'error' }).join('');
            console.error(error);
          } else {
            error = null;
            manifest = finish(dir, readProject(dir), result.metafile);
            key = String(Date.now());
            console.log(`${new Date().toLocaleTimeString()} built`);
          }
          for (const res of clients) res.write('event: rebuilt\ndata: \n\n');
        });
      },
    }],
  });
  await ctx.watch();

  const send = (res, status, type, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
    res.end(body);
  };

  createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const path = decodeURIComponent(url.pathname);
    const origin = `http://${req.headers.host}`;
    if (path === '/') return send(res, 200, 'text/html', readFileSync(join(KIT, 'src/sim/index.html')));
    if (path === '/__sim/sim.js') return send(res, 200, 'text/javascript', simJs);
    if (path === '/__frame/index.html') {
      return send(res, 200, 'text/html', readFileSync(join(KIT, 'src/frame/index.html')),
        { 'Content-Security-Policy': frameCsp(origin) });
    }
    if (path === '/__frame/frame.js') return send(res, 200, 'text/javascript', frameJs);
    if (path === '/__bst/manifest') {
      return error || !manifest
        ? send(res, 500, 'text/plain', error ?? 'still building')
        : send(res, 200, 'application/json', JSON.stringify({ manifest, key }));
    }
    if (path === '/__bst/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
      res.write(': hello\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (path.startsWith('/theme/')) {
      const file = resolve(dist, path.slice('/theme/'.length));
      if (!file.startsWith(dist + sep) || !existsSync(file) || !statSync(file).isFile()) {
        return send(res, 404, 'text/plain', 'not in the theme');
      }
      return send(res, 200, TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', readFileSync(file),
        { 'Access-Control-Allow-Origin': '*' });
    }
    send(res, 404, 'text/plain', 'not found');
  }).listen(port, () => console.log(`bst dev: ${project.name} on http://localhost:${port}`));
}

// --- main ---

const [cmd, arg, ...rest] = process.argv.slice(2);
const portFlag = rest.indexOf('--port');
switch (cmd) {
  case 'build': {
    const { manifest } = await build(resolve(arg ?? '.'));
    console.log(`built ${manifest.name} ${manifest.version} into dist/`);
    break;
  }
  case 'pack': await pack(resolve(arg ?? '.')); break;
  case 'check': check(arg); break;
  case 'init': init(arg); break;
  // For the panel's own build: the production frame, to ship inside the app.
  case 'frame': await frame(resolve(arg ?? 'dist/frame')); break;
  case 'dev': await dev(resolve(arg ?? '.'), portFlag >= 0 ? Number(rest[portFlag + 1]) : 5173); break;
  default:
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(2, 12).map((l) => l.replace(/^ \*\s?/, '')).join('\n'));
    process.exit(cmd ? 1 : 0);
}
