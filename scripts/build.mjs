#!/usr/bin/env node
/**
 * Gera a pasta publicável (dist/) e, opcionalmente, o ZIP para a Chrome Web Store.
 *
 *   npm run build            -> dist/
 *   npm run build -- --zip   -> dist/ + release/optante-facil-vX.Y.Z.zip
 *   npm run build -- --clean -> remove dist/ e release/
 *
 * Os arquivos publicados são minificados (esbuild) e não contêm comentários,
 * caminhos de desenvolvimento nem o diretório de testes.
 *
 * O ZIP é escrito em Node puro (zlib), sem o comando `zip` do sistema —
 * funciona no Windows, macOS e Linux.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import * as esbuild from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const RELEASE = path.join(ROOT, 'release');

const args = process.argv.slice(2);
const wantZip = args.includes('--zip');
const wantClean = args.includes('--clean');

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full));
  }
  return out;
}

function clean() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.rmSync(RELEASE, { recursive: true, force: true });
  console.log('• dist/ e release/ removidos');
}

if (wantClean) {
  clean();
  if (!wantZip) process.exit(0);
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'));
const files = walk(SRC);
let jsCount = 0;
let cssCount = 0;

for (const relative of files) {
  const from = path.join(SRC, relative);
  const to = path.join(DIST, relative);
  fs.mkdirSync(path.dirname(to), { recursive: true });

  if (relative.endsWith('.js')) {
    const code = fs.readFileSync(from, 'utf8');
    const result = await esbuild.transform(code, {
      loader: 'js',
      minify: true,
      target: 'chrome111',
      legalComments: 'none',
      charset: 'utf8'
    });
    fs.writeFileSync(to, result.code + '\n', 'utf8');
    jsCount++;
  } else if (relative.endsWith('.css')) {
    const css = fs.readFileSync(from, 'utf8');
    const result = await esbuild.transform(css, { loader: 'css', minify: true, target: 'chrome111' });
    fs.writeFileSync(to, result.code + '\n', 'utf8');
    cssCount++;
  } else if (relative.endsWith('.html')) {
    // Remove apenas comentários HTML: o markup é pequeno e não vale minificar com risco.
    const html = fs.readFileSync(from, 'utf8').replace(/<!--(?!\[if)[\s\S]*?-->/g, '');
    fs.writeFileSync(to, html, 'utf8');
  } else {
    fs.copyFileSync(from, to);
  }
}

// Nada de desenvolvimento vai para o pacote
for (const forbidden of ['tests', 'node_modules', '.git']) {
  if (fs.existsSync(path.join(DIST, forbidden))) {
    fs.rmSync(path.join(DIST, forbidden), { recursive: true, force: true });
  }
}

const sizeOf = (file) => fs.statSync(file).size;
const total = walk(DIST).reduce((sum, rel) => sum + sizeOf(path.join(DIST, rel)), 0);

console.log(`• dist/ pronto: ${files.length} arquivos (${jsCount} JS minificados, ${cssCount} CSS minificados)`);
console.log(`• tamanho total: ${(total / 1024).toFixed(1)} KB`);

if (wantZip) {
  fs.mkdirSync(RELEASE, { recursive: true });
  const zipName = `optante-facil-v${manifest.version}.zip`;
  const zipPath = path.join(RELEASE, zipName);
  fs.rmSync(zipPath, { force: true });
  writeZip(DIST, zipPath);
  console.log(`• pacote: release/${zipName} (${(sizeOf(zipPath) / 1024).toFixed(1)} KB)`);
}

// ---------------------------------------------------------------------------
// ZIP em Node puro — o Windows não traz o comando `zip` (ENOENT no spawnSync).
// Formato PKZIP clássico (deflate), arquivos na raiz, caminhos com `/`.
// ---------------------------------------------------------------------------

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c >>> 0;
}

function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function writeZip(sourceDir, zipPath) {
  const entries = walk(sourceDir).sort((a, b) => a.localeCompare(b, 'en'));
  const locals = [];
  const centrals = [];
  let offset = 0;
  const stamp = dosDateTime(new Date());

  for (const relative of entries) {
    const name = relative.split(path.sep).join('/');
    const nameBuf = Buffer.from(name, 'utf8');
    const data = fs.readFileSync(path.join(sourceDir, relative));
    const crc = crc32(data);
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const store = deflated.length >= data.length;
    const payload = store ? data : deflated;
    const method = store ? 0 : 8;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(stamp.dosTime, 10);
    local.writeUInt16LE(stamp.dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    const localFile = Buffer.concat([local, nameBuf, payload]);
    locals.push(localFile);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(stamp.dosTime, 12);
    central.writeUInt16LE(stamp.dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuf]));

    offset += localFile.length;
  }

  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  fs.writeFileSync(zipPath, Buffer.concat([...locals, centralDir, eocd]));
}
