#!/usr/bin/env node
/**
 * Verificação estática antes de publicar:
 *  - sintaxe de todos os scripts
 *  - integridade do manifest (arquivos existem, permissões mínimas, sem código remoto)
 *  - ausência de padrões perigosos (eval, código remoto, requisições de rede)
 * Uso: npm run check
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

const problems = [];
const warnings = [];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------- 1. sintaxe
console.log('• Verificando sintaxe dos scripts…');
const jsFiles = walk(SRC).filter((file) => file.endsWith('.js'));
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    problems.push(`sintaxe inválida em ${path.relative(ROOT, file)}: ${String(error.stderr || error).slice(0, 300)}`);
  }
}
console.log(`  ${jsFiles.length} arquivos verificados`);

// -------------------------------------------------------- 2. padrões proibidos
console.log('• Procurando padrões proibidos…');
const RULES = [
  { name: 'eval', regex: /\beval\s*\(/, severity: 'error' },
  { name: 'new Function', regex: /new\s+Function\s*\(/, severity: 'error' },
  { name: 'document.write', regex: /document\s*\.\s*write/, severity: 'error' },
  { name: 'requisição de rede', regex: /\b(fetch|XMLHttpRequest|WebSocket|navigator\.sendBeacon|EventSource)\b/, severity: 'error' },
  { name: 'código remoto', regex: /https?:\/\/(?!www\.issnetonline\.com\.br)[^\s'"`)]+\.(js|mjs|css)\b/, severity: 'error' },
  // innerHTML só é aceito com conteúdo literal (template/string/vetor), nunca com variável
  { name: 'innerHTML dinâmico', regex: /innerHTML\s*=\s*(?![`'\[])[A-Za-z_$]/, severity: 'warn' }
];

for (const file of jsFiles) {
  const code = fs.readFileSync(file, 'utf8');
  for (const rule of RULES) {
    if (rule.regex.test(code)) {
      const line = code.split('\n').findIndex((l) => rule.regex.test(l)) + 1;
      const message = `${rule.name} em ${path.relative(ROOT, file)}:${line}`;
      (rule.severity === 'error' ? problems : warnings).push(message);
    }
  }
}

// ------------------------------------------------------------- 3. manifest
console.log('• Validando o manifest…');
const manifestPath = path.join(SRC, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (manifest.manifest_version !== 3) problems.push('manifest_version precisa ser 3');
if (!manifest.default_locale) problems.push('default_locale ausente');
if (!manifest.action || !manifest.action.default_popup) problems.push('action.default_popup ausente');

const declared = [
  ...Object.values(manifest.icons || {}),
  ...Object.values((manifest.action && manifest.action.default_icon) || {}),
  manifest.background && manifest.background.service_worker,
  manifest.action && manifest.action.default_popup,
  ...(manifest.content_scripts || []).flatMap((cs) => cs.js || [])
].filter(Boolean);

for (const relative of declared) {
  if (!fs.existsSync(path.join(SRC, relative))) problems.push(`arquivo declarado não existe: ${relative}`);
}

const ALLOWED_PERMISSIONS = new Set(['storage', 'alarms', 'scripting', 'notifications']);
for (const permission of manifest.permissions || []) {
  if (!ALLOWED_PERMISSIONS.has(permission)) problems.push(`permissão não prevista: ${permission}`);
}
for (const permission of manifest.optional_permissions || []) {
  if (!ALLOWED_PERMISSIONS.has(permission)) problems.push(`permissão opcional não prevista: ${permission}`);
}

const hosts = [...(manifest.host_permissions || []), ...(manifest.content_scripts || []).flatMap((cs) => cs.matches || [])];
for (const host of hosts) {
  if (!/\.issnetonline\.com\.br/.test(host)) problems.push(`host fora do escopo: ${host}`);
  if (host.startsWith('http://')) warnings.push(`host sem HTTPS: ${host}`);
}

// Locales obrigatórios
const localesDir = path.join(SRC, '_locales');
if (!fs.existsSync(path.join(localesDir, manifest.default_locale, 'messages.json'))) {
  problems.push(`falta _locales/${manifest.default_locale}/messages.json`);
}
for (const key of ['extName', 'extDesc']) {
  const file = path.join(localesDir, manifest.default_locale, 'messages.json');
  if (fs.existsSync(file)) {
    const messages = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!messages[key] || !messages[key].message) problems.push(`falta a mensagem "${key}"`);
    if (messages[key] && messages[key].message.length > 132 && key === 'extDesc') {
      problems.push('extDesc passa de 132 caracteres');
    }
  }
}

// Versão deve acompanhar o package.json
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
if (pkg.version !== manifest.version) {
  problems.push(`versão divergente: package.json ${pkg.version} x manifest ${manifest.version}`);
}

// ------------------------------------------------------------------ 4. saída
for (const warning of warnings) console.log(`  ⚠ ${warning}`);

if (problems.length) {
  console.error('\n✖ Verificação falhou:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`\n✔ Tudo certo: ${jsFiles.length} scripts, manifest v${manifest.version}, sem código remoto.`);
