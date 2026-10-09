import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createWindow, gridHtml, loadScripts } from './helpers.mjs';

const require = createRequire(import.meta.url);

test('protocolo: normaliza, limita e sanitiza valores', () => {
  const P = require('../src/shared/protocol.js');

  assert.equal(P.normalize('  OPTANTE  MEI '), 'optante mei');
  assert.equal(P.normalize('Não Optante'), 'nao optante');
  assert.equal(P.sanitizeOption('mei'), 'mei');
  assert.equal(P.sanitizeOption('inexistente'), 'nao', 'valor inválido cai no padrão seguro');
  assert.equal(P.sanitizeSpeed(null), 'normal');
  assert.equal(P.clampInt('7', 0, 5, 1), 5);
  assert.equal(P.clampInt('abc', 0, 5, 1), 1);
  assert.equal(P.plural(1, 'linha', 'linhas'), '1 linha');
  assert.equal(P.plural(2, 'linha', 'linhas'), '2 linhas');

  const prefs = P.sanitizePrefs({ option: 'sn', speed: 'fast', collapsed: true, lixo: 1 });
  assert.deepEqual(prefs, { option: 'sn', speed: 'fast', collapsed: true, notify: true, keepAwake: true });
});

test('núcleo: reconhece o campo pelo conteúdo e ignora outros selects', () => {
  const dom = createWindow(gridHtml({ rows: 4, filled: [0] }));
  loadScripts(dom.window, ['shared/protocol.js', 'content/core.js']);
  const C = dom.window.ISSCore;

  const targets = C.findTargets(dom.window.document);
  assert.equal(targets.length, 4, 'encontra os 4 selects de Simples Nacional/MEI');
  assert.ok(!C.isTarget(dom.window.document.getElementById('uf')), 'select de UF não é alvo');

  assert.equal(C.countPending(dom.window.document), 3, 'a linha já preenchida não conta');
  assert.ok(!C.isPending(targets[0]), 'linha preenchida não está pendente');
  assert.ok(C.isPending(targets[1]));
  dom.window.close();
});

test('núcleo: aplica o valor e dispara os eventos que o ASP.NET observa', () => {
  const dom = createWindow(gridHtml({ rows: 2 }));
  loadScripts(dom.window, ['shared/protocol.js', 'content/core.js']);
  const win = dom.window;
  const C = win.ISSCore;
  const P = win.ISSProtocol;

  const select = C.findTargets(win.document)[0];
  let changes = 0;
  select.addEventListener('change', () => { changes++; });

  assert.equal(C.applyValue(select, P.getOption('mei')), true);
  assert.equal(changes, 1, 'o evento change é disparado (postback)');
  assert.equal(C.selectedText(select), 'optante mei');
  assert.equal(C.countPending(win.document), 1, 'a linha aplicada sai da contagem');

  const unrelated = win.document.getElementById('uf');
  assert.equal(C.applyValue(unrelated, P.getOption('sn')), false, 'select de outro campo é recusado');
  dom.window.close();
});

test('núcleo: waitIdle respeita o mínimo e interrompe no shouldStop', async () => {
  const dom = createWindow(gridHtml({ rows: 1 }));
  loadScripts(dom.window, ['shared/protocol.js', 'content/core.js']);
  const win = dom.window;
  const C = win.ISSCore;

  const started = Date.now();
  await C.waitIdle({ minMs: 120, quietMs: 50, maxMs: 5000, window: win, document: win.document });
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 100, `esperou o mínimo (${elapsed}ms)`);
  assert.ok(elapsed < 2000, `não ficou preso (${elapsed}ms)`);

  let stop = false;
  const begin = Date.now();
  setTimeout(() => { stop = true; }, 100);
  await C.waitIdle({ minMs: 60000, quietMs: 50, maxMs: 60000, shouldStop: () => stop, window: win, document: win.document });
  assert.ok(Date.now() - begin < 3000, 'parou rápido quando shouldStop virou true');
  dom.window.close();
});

test('núcleo: isBusy detecta postback do ASP.NET/jQuery', () => {
  const dom = createWindow(gridHtml({ rows: 1 }));
  loadScripts(dom.window, ['shared/protocol.js', 'content/core.js']);
  const win = dom.window;
  const C = win.ISSCore;

  assert.equal(C.isBusy(win), false);
  win.jQuery = { active: 2 };
  assert.equal(C.isBusy(win), true, 'jQuery em requisição');
  win.jQuery = null;
  win.Sys = { WebForms: { PageRequestManager: { getInstance: () => ({ get_isInAsyncPostBack: () => true }) } } };
  assert.equal(C.isBusy(win), true, 'UpdatePanel em postback');
  dom.window.close();
});

test('núcleo: linhas recusadas ficam marcadas e podem ser limpas', () => {
  const dom = createWindow(gridHtml({ rows: 2 }));
  loadScripts(dom.window, ['shared/protocol.js', 'content/core.js']);
  const win = dom.window;
  const C = win.ISSCore;

  const targets = C.findTargets(win.document);
  C.markFailed([targets[0]]);
  assert.equal(win.document.querySelectorAll('[' + C.FLAG_ATTR + ']').length, 1);
  assert.equal(targets[0].style.outlineStyle, 'solid', 'recebeu destaque visual');

  C.clearMarks(win.document);
  assert.equal(win.document.querySelectorAll('[' + C.FLAG_ATTR + ']').length, 0);
  assert.equal(targets[0].style.outlineStyle, '');
  dom.window.close();
});
