/**
 * Testes de integração do executor (mundo MAIN) com uma ponte simulada.
 * Cada caso usa uma página jsdom com a grade do ISS.net e verifica o
 * comportamento completo: aplicar em lote, parar, linha que recusa e retomada.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWindow, gridHtml, loadScripts, createFakeBridge, readTexts, sleep } from './helpers.mjs';

const FILES = ['shared/protocol.js', 'content/core.js'];

function boot(html, prepare) {
  const dom = createWindow(html);
  loadScripts(dom.window, FILES);
  const bridge = createFakeBridge(dom.window);
  if (prepare) prepare(dom.window);           // roda antes do executor carregar
  loadScripts(dom.window, ['content/executor.js']);
  return { dom, win: dom.window, bridge };
}

test('aplica o valor escolhido em todas as linhas pendentes', async (t) => {
  const { dom, win, bridge } = boot(gridHtml({ rows: 4, filled: [0] }));
  t.after(() => dom.window.close());

  await bridge.waitFor('hello');
  bridge.send('cmd:prefs', { prefs: { option: 'mei', speed: 'fast' } });
  bridge.send('cmd:start', { optionId: 'mei', speedId: 'fast' });

  const first = await bridge.waitFor('progress');
  assert.equal(first.payload.total, 3, 'a linha já preenchida não entra na conta');

  const done = await bridge.waitFor('done', { timeout: 40000 });
  assert.equal(done.payload.status, 'done');
  assert.equal(done.payload.updated, 3);
  assert.equal(done.payload.failed, 0);
  assert.deepEqual(readTexts(win), ['Não Optante', 'Optante MEI', 'Optante MEI', 'Optante MEI']);
  assert.equal(win.document.getElementById('uf').selectedIndex, 0, 'campos de outros tipos não são alterados');
});

test('o botão Parar interrompe antes do fim', async (t) => {
  const { dom, win, bridge } = boot(gridHtml({ rows: 6 }));
  t.after(() => dom.window.close());

  await bridge.waitFor('hello');
  bridge.send('cmd:prefs', { prefs: { option: 'sn', speed: 'safe' } });
  bridge.send('cmd:start', { optionId: 'sn', speedId: 'safe' });
  await bridge.waitFor('progress');

  bridge.send('cmd:stop');
  const done = await bridge.waitFor('done', { timeout: 20000 });
  assert.equal(done.payload.status, 'stopped');

  const applied = readTexts(win).filter((text) => text === 'Optante SN').length;
  assert.ok(applied < 6, `parou antes do fim (aplicou ${applied} de 6)`);
  assert.ok(done.payload.pending > 0, 'ainda há linhas pendentes');
});

test('linha que recusa a alteração é destacada e reportada', async (t) => {
  const { dom, win, bridge } = boot(gridHtml({ rows: 3, stubborn: [1] }));
  t.after(() => dom.window.close());

  // Simula uma linha cujo postback volta para "Selecione".
  win.document.querySelectorAll('select.sn').forEach((select) => {
    if (select.dataset.stubborn) {
      select.addEventListener('change', () => { select.selectedIndex = 0; });
    }
  });

  await bridge.waitFor('hello');
  bridge.send('cmd:prefs', { prefs: { option: 'sn', speed: 'fast' } });
  bridge.send('cmd:start', { optionId: 'sn', speedId: 'fast' });

  const done = await bridge.waitFor('done', { timeout: 60000 });
  assert.equal(done.payload.status, 'failed');
  assert.equal(done.payload.updated, 2);
  assert.equal(done.payload.failed, 1);
  assert.deepEqual(readTexts(win), ['Optante SN', 'Selecione', 'Optante SN']);
  assert.equal(win.document.querySelectorAll('[data-optante-falhou]').length, 1, 'linha recusada destacada');
});

test('sem linhas pendentes o processamento nem começa', async (t) => {
  const { dom, bridge } = boot(gridHtml({ rows: 2, filled: [0, 1] }));
  t.after(() => dom.window.close());

  await bridge.waitFor('hello');
  bridge.send('cmd:prefs', { prefs: { option: 'sn', speed: 'fast' } });
  bridge.send('cmd:start', { optionId: 'sn', speedId: 'fast' });
  await sleep(300);

  assert.equal(bridge.last('done'), null, 'não há job para concluir');
  const state = bridge.last('state');
  assert.equal(state.payload.pending, 0);
});

test('retoma o job após recarga da página quando o service worker confirma', async (t) => {
  // Estado deixado por uma execução interrompida há poucos segundos.
  const { dom, win, bridge } = boot(gridHtml({ rows: 3 }), (w) => {
    w.sessionStorage.setItem('optanteFacil:job:v3', JSON.stringify({
      running: true, option: 'mei', speed: 'fast', initial: 3, attempts: {}, ts: Date.now()
    }));
  });
  t.after(() => dom.window.close());

  await bridge.waitFor('hello');
  const orphan = await bridge.waitFor('orphan', { timeout: 10000 });
  assert.equal(orphan.payload.job.option, 'mei');

  bridge.send('cmd:resume', { job: orphan.payload.job });
  const done = await bridge.waitFor('done', { timeout: 40000 });
  assert.equal(done.payload.status, 'done');
  assert.deepEqual(readTexts(win), ['Optante MEI', 'Optante MEI', 'Optante MEI']);
});

test('descarta job órfão quando o service worker manda descartar', async (t) => {
  const { dom, win, bridge } = boot(gridHtml({ rows: 3 }), (w) => {
    w.sessionStorage.setItem('optanteFacil:job:v3', JSON.stringify({
      running: true, option: 'sn', speed: 'fast', initial: 3, attempts: {}, ts: Date.now()
    }));
  });
  t.after(() => dom.window.close());

  await bridge.waitFor('hello');
  const orphan = await bridge.waitFor('orphan', { timeout: 10000 });
  bridge.send('cmd:discard', {});
  await sleep(400);

  assert.equal(win.sessionStorage.getItem('optanteFacil:job:v3'), null, 'job antigo foi descartado');
  assert.equal(bridge.last('done'), null, 'nada foi executado');
  assert.ok(orphan.payload.job);
});

test('mensagens de outra origem ou sem token são ignoradas', async (t) => {
  const { dom, win, bridge } = boot(gridHtml({ rows: 2 }));
  t.after(() => dom.window.close());

  await bridge.waitFor('hello');

  win.postMessage({ __optante: true, v: 1, channel: 'optante-facil/v1', type: 'cmd:start', payload: { optionId: 'sn' } }, 'https://www.issnetonline.com.br');
  win.postMessage({ __optante: true, v: 1, channel: 'optante-facil/v1', token: 'falso', type: 'cmd:start', payload: { optionId: 'sn' } }, 'https://www.issnetonline.com.br');
  win.postMessage({ __optante: true, v: 99, channel: 'optante-facil/v1', token: 'token-teste', type: 'cmd:start', payload: { optionId: 'sn' } }, 'https://www.issnetonline.com.br');
  await sleep(500);

  assert.deepEqual(readTexts(win), ['Selecione', 'Selecione'], 'nenhum comando inválido foi executado');
  assert.equal(bridge.last('done'), null);
});
