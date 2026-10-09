#!/usr/bin/env node
/**
 * Teste de fumaça no PACOTE GERADO (dist/): garante que a minificação não
 * quebrou nada. Roda o executor numa página jsdom, executa um lote e confere
 * o resultado.
 *
 * Uso: npm run build && npm run smoke
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ORIGIN = 'https://www.issnetonline.com.br';

const FILES = ['shared/protocol.js', 'content/core.js', 'content/executor.js'];
for (const file of FILES) {
  if (!fs.existsSync(path.join(DIST, file))) {
    console.error('✖ dist/ não encontrado. Rode "npm run build" antes.');
    process.exit(1);
  }
}

function gridHtml(rows) {
  const selects = [];
  for (let i = 0; i < rows; i++) {
    selects.push(`<select class="sn" id="sn${i}"><option value="">Selecione</option><option value="1">Não Optante</option><option value="2">Optante SN</option><option value="3">Optante MEI</option></select>`);
  }
  return `<!DOCTYPE html><html><body><table><tbody>${selects.map((s) => `<tr><td>${s}</td></tr>`).join('')}</tbody></table></body></html>`;
}

const dom = new JSDOM(gridHtml(3), {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: `${ORIGIN}/itauna/online/declaracao.aspx`
});
const win = dom.window;
win.Element.prototype.getClientRects = function () { return { length: 1 }; };

const events = [];
let resolveDone;
const done = new Promise((resolve, reject) => {
  resolveDone = resolve;
  setTimeout(() => reject(new Error('timeout: o pacote não concluiu o lote')), 30000);
});

win.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.__optante !== true) return;
  events.push(data);
  if (data.type === 'hello') {
    win.postMessage({ __optante: true, v: 1, channel: 'optante-facil/v1', type: 'cmd:init', token: 'smoke', payload: {} }, ORIGIN);
    win.postMessage({ __optante: true, v: 1, channel: 'optante-facil/v1', token: 'smoke', type: 'cmd:prefs', payload: { prefs: { option: 'sn', speed: 'fast' } } }, ORIGIN);
    win.postMessage({ __optante: true, v: 1, channel: 'optante-facil/v1', token: 'smoke', type: 'cmd:start', payload: { optionId: 'sn', speedId: 'fast' } }, ORIGIN);
  }
  if (data.type === 'done') resolveDone(data);
});

try {
  for (const file of FILES) {
    win.eval(fs.readFileSync(path.join(DIST, file), 'utf8'));
  }
} catch (error) {
  console.error('✖ erro ao executar o pacote:', error.message);
  process.exit(1);
}

const result = await done.catch((error) => ({ error }));
if (result.error) {
  console.error('✖', result.error.message);
  process.exit(1);
}

const texts = [...win.document.querySelectorAll('select.sn')].map((el) => el.options[el.selectedIndex].text);

if (result.payload.status !== 'done' || result.payload.updated !== 3) {
  console.error('✖ resultado inesperado:', JSON.stringify(result.payload));
  process.exit(1);
}
if (texts.some((text) => text !== 'Optante SN')) {
  console.error('✖ a grade não foi preenchida:', texts.join(', '));
  process.exit(1);
}
if (events.some((e) => e.type === 'error')) {
  console.error('✖ o pacote reportou erro:', JSON.stringify(events.filter((e) => e.type === 'error')));
  process.exit(1);
}

console.log(`✔ dist/ OK: ${result.payload.updated} linhas aplicadas, ${events.length} mensagens trocadas.`);
win.close();
