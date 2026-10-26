/**
 * The .bst container: writing one, reading one, and the checks the panel makes before installing.
 * Kept apart from the CLI so it can be tested, and so the rules live in one place.
 */
import { deflateRawSync, inflateRawSync } from 'node:zlib';

/** What the panel accepts. ThemeStore.java on the panel enforces the same numbers. */
export const LIMITS = { bytes: 24 * 1024 * 1024, files: 300 };

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const useDeflate = packed.length < data.length;
    const body = useDeflate ? packed : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);             // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, body);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(useDeflate ? 8 : 0, 10);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, end]);
}

export function unzip(buf) {
  const endAt = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endAt < 0) throw new Error('not a zip file');
  const count = buf.readUInt16LE(endAt + 10);
  let p = buf.readUInt32LE(endAt + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('damaged zip directory');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    if (!name.endsWith('/')) {
      if (method !== 0 && method !== 8) throw new Error(`${name} uses a compression the panel cannot read`);
      out.push({ name, data: method === 8 ? inflateRawSync(raw) : raw });
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// --- checks ---

/** Returns the problems with a pack, as sentences. An empty list means the panel will take it. */
export function checkPack(buf) {
  const problems = [];
  let files;
  try {
    files = unzip(buf);
  } catch (e) {
    return [`it is not a readable .bst (${e.message})`];
  }
  const byName = new Map(files.map((f) => [f.name, f.data]));
  if (files.length > LIMITS.files) problems.push(`it has ${files.length} files; the panel takes ${LIMITS.files}`);
  const total = files.reduce((n, f) => n + f.data.length, 0);
  if (total > LIMITS.bytes) problems.push(`it unpacks to ${(total / 1048576).toFixed(1)} MB; the panel takes 24 MB`);
  for (const f of files) {
    if (f.name.startsWith('/') || f.name.split('/').includes('..') || f.name.includes('\\')) {
      problems.push(`${f.name} is an unsafe path`);
    }
  }
  const raw = byName.get('manifest.json');
  if (!raw) return [...problems, 'it has no manifest.json at the top level'];
  let m;
  try {
    m = JSON.parse(raw.toString('utf8'));
  } catch {
    return [...problems, 'manifest.json is not valid JSON'];
  }
  if (m.format !== 1) problems.push(`manifest.json says format ${m.format}; the panel reads format 1`);
  for (const key of ['name', 'author', 'version', 'sdk', 'entry']) {
    if (typeof m[key] !== 'string' || !m[key]) problems.push(`manifest.json has no "${key}"`);
  }
  if (!Array.isArray(m.styles)) problems.push('manifest.json "styles" must be a list');
  const script = typeof m.entry === 'string' ? byName.get(m.entry) : null;
  if (typeof m.entry === 'string' && !script) problems.push(`the entry ${m.entry} is not in the pack`);
  for (const s of Array.isArray(m.styles) ? m.styles : []) {
    if (!byName.has(s)) problems.push(`the stylesheet ${s} is not in the pack`);
  }
  if (script) {
    const js = script.toString('utf8');
    if (!js.includes('__bstTheme')) problems.push(`${m.entry} is not a bst build (build it with bst build)`);
    // A second React would not share the panel's hooks, and every hook in the theme would throw.
    if (/react\.production|__CLIENT_INTERNALS_DO_NOT_USE|ReactSharedInternals/.test(js)) {
      problems.push(`${m.entry} carries its own copy of React; build it with bst build so it uses the panel's`);
    }
  }
  return problems;
}

