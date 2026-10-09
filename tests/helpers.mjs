import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const ORIGIN = 'https://www.issnetonline.com.br';

function option(value, text) {
  return `<option value="${value}">${text}</option>`;
}

/**
 * Monta uma grade parecida com a tela "Declaração de Serviços Contratados":
 * N selects de Simples Nacional/MEI + um select de outro campo (não deve ser tocado).
 */
export function gridHtml({ rows = 5, filled = [], stubborn = [] } = {}) {
  const selects = [];
  for (let i = 0; i < rows; i++) {
    const selected = filled.includes(i) ? 1 : 0;
    const opts = [
      option('', 'Selecione'),
      option('1', 'Não Optante'),
      option('2', 'Optante SN'),
      option('3', 'Optante MEI')
    ];
    if (selected === 1) opts[1] = `<option value="1" selected>Não Optante</option>`;
    selects.push(`<select class="sn" id="sn${i}"${stubborn.includes(i) ? ' data-stubborn="1"' : ''}>${opts.join('')}</select>`);
  }
  return `<!DOCTYPE html><html><body>
    <table><tbody>
      ${selects.map((s) => `<tr><td>${s}</td></tr>`).join('\n')}
      <tr><td><select id="uf">${option('', 'Selecione')}${option('MG', 'MG')}${option('SP', 'SP')}</select></td></tr>
    </tbody></table>
  </body></html>`;
}

export function createWindow(html) {
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: `${ORIGIN}/itauna/online/declaracao.aspx`
  });
  const win = dom.window;
  // jsdom não faz layout: força a existência de rects para o teste de visibilidade.
  win.Element.prototype.getClientRects = function () { return { length: 1 }; };
  return dom;
}

export function loadScripts(win, files) {
  for (const file of files) {
    win.eval(fs.readFileSync(path.join(SRC, file), 'utf8'));
  }
}

export function readTexts(win, selector = 'select.sn') {
  return [...win.document.querySelectorAll(selector)].map((el) => el.options[el.selectedIndex].text);
}

/**
 * Finge ser a ponte (mundo isolado): faz o handshake e traduz os comandos do
 * "service worker" para mensagens de janela, gravando todos os eventos.
 */
export function createFakeBridge(win, { token = 'token-teste' } = {}) {
  const events = [];
  const waiters = [];

  win.addEventListener('message', (event) => {
    if (event.source && event.source !== win) return;
    const data = event.data;
    if (!data || data.__optante !== true) return;
    events.push(data);

    if (data.type === 'hello') {
      win.postMessage({
        __optante: true, v: 1, channel: 'optante-facil/v1',
        type: 'cmd:init', token, payload: {}
      }, ORIGIN);
    }

    for (const waiter of waiters.slice()) {
      if (waiter.type === data.type && (!waiter.match || waiter.match(data.payload))) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(data);
      }
    }
  });

  function send(type, payload = {}) {
    win.postMessage({
      __optante: true, v: 1, channel: 'optante-facil/v1',
      token, type, payload
    }, ORIGIN);
  }

  function waitFor(type, { timeout = 20000, match } = {}) {
    const found = events.find((e) => e.type === type && (!match || (e.payload && match(e.payload))));
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const waiter = { type, match };
      waiter.timer = setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) {
          waiters.splice(index, 1);
          reject(new Error(`timeout esperando evento "${type}"`));
        }
      }, timeout);
      waiter.resolve = (data) => {
        clearTimeout(waiter.timer);
        resolve(data);
      };
      waiters.push(waiter);
    });
  }

  function last(type) {
    for (let i = events.length - 1; i >= 0; i--) if (events[i].type === type) return events[i];
    return null;
  }

  return { events, send, waitFor, last };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
