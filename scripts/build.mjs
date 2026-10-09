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
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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
  execFileSync('zip', ['-r', '-q', '-X', zipPath, '.'], { cwd: DIST });
  console.log(`• pacote: release/${zipName} (${(sizeOf(zipPath) / 1024).toFixed(1)} KB)`);
}
