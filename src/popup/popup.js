/**
 * Popup: espelho do processamento, disponível em qualquer aba.
 * Mostra o andamento, permite aplicar/parar e guarda as preferências.
 */
(function () {
  'use strict';

  var P = self.ISSProtocol;
  if (!P) return;

  var S = P.STATUS;
  var state = null;
  var port = null;
  var radios = [];

  var el = {};

  function $(id) { return document.getElementById(id); }

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return 'ISS.net'; }
  }

  function buildControls() {
    var seg = $('seg');
    P.OPTIONS.forEach(function (option) {
      var button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'radio');
      button.dataset.id = option.id;
      button.textContent = option.label;
      button.addEventListener('click', function () {
        if (state && state.tab && state.tab.running) return;
        if (!state || state.prefs.option === option.id) return;
        sendPrefs({ option: option.id });
      });
      seg.appendChild(button);
      radios.push(button);
    });

    var speed = $('speed');
    P.SPEEDS.forEach(function (item) {
      var opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.label;
      speed.appendChild(opt);
    });

    $('go').addEventListener('click', function () {
      if (!state || !state.tab) return;
      if (state.tab.running) {
        chrome.runtime.sendMessage({ cmd: 'stop', payload: { tabId: state.tab.tabId } }, after);
      } else {
        chrome.runtime.sendMessage({ cmd: 'start', payload: { tabId: state.tab.tabId } }, after);
      }
    });

    $('speed').addEventListener('change', function () { sendPrefs({ speed: $('speed').value }); });

    $('notify').addEventListener('change', function () {
      if ($('notify').checked && !state.notifyGranted) {
        chrome.runtime.sendMessage({ cmd: 'requestNotifications' }, function (response) {
          if (!response || !response.ok) $('notify').checked = false;
          refresh();
        });
        return;
      }
      sendPrefs({ notify: $('notify').checked });
    });

    $('keepAwake').addEventListener('change', function () { sendPrefs({ keepAwake: $('keepAwake').checked }); });
  }

  function sendPrefs(patch) {
    var merged = Object.assign({}, state ? state.prefs : P.DEFAULTS, patch);
    chrome.runtime.sendMessage({ cmd: 'prefs', payload: { prefs: merged } }, after);
  }

  function after(response) {
    if (chrome.runtime.lastError) return;
    if (response && response.state) render(response.state);
    refresh();
  }

  function refresh() {
    chrome.runtime.sendMessage({ cmd: 'status' }, function (response) {
      if (chrome.runtime.lastError) return;
      if (response && response.state) render(response.state);
    });
  }

  /** Escreve texto com trechos em negrito sem usar innerHTML. */
  function setRichText(node, parts) {
    node.textContent = '';
    parts.forEach(function (part) {
      if (part.bold) {
        var strong = document.createElement('b');
        strong.textContent = part.bold;
        node.appendChild(strong);
      } else {
        node.appendChild(document.createTextNode(part.text));
      }
    });
  }

  function resultHeadline(result) {
    if (!result) return null;
    var updated = P.plural(result.updated || 0, 'linha atualizada', 'linhas atualizadas');
    if (result.status === S.DONE) return { parts: [{ text: 'Concluído' }], sub: updated + '.' };
    if (result.status === S.STOPPED) return { parts: [{ text: 'Interrompido' }], sub: updated + '.' };
    return {
      parts: [{ text: P.plural(result.failed || 0, 'linha não aceitou', 'linhas não aceitaram') + ' a alteração' }],
      sub: updated + '. As linhas recusadas ficam destacadas em vermelho na grade.'
    };
  }

  function render(data) {
    state = data;
    if (!state) return;

    $('version').textContent = 'v' + (state.version || '');
    $('speed').value = state.prefs.speed;
    $('notify').checked = !!state.prefs.notify;
    $('keepAwake').checked = !!state.prefs.keepAwake;

    radios.forEach(function (button) {
      var on = button.dataset.id === state.prefs.option;
      button.setAttribute('aria-checked', String(on));
      button.disabled = !!(state.tab && state.tab.running && !on);
    });

    var tab = state.tab;
    $('emptyCard').hidden = !!tab;
    $('controlCard').hidden = !tab;
    $('live').hidden = !(tab && tab.running);

    if (!tab) {
      $('eyebrow').textContent = 'Sem conexão';
      $('headline').textContent = 'Nenhuma aba do ISS.net aberta';
      $('sub').textContent = '';
      $('bar').hidden = true;
      return;
    }

    $('eyebrow').textContent = hostOf(tab.url);
    var info;

    if (tab.running && tab.status === S.STALLED) {
      info = {
        parts: [{ text: 'Processamento lento ou parado' }],
        sub: 'O Chrome reduziu a aba. Abra a aba do ISS.net para retomar.',
        alert: true
      };
    } else if (tab.running && tab.progress) {
      info = {
        parts: [
          { text: 'Marcando linha ' }, { bold: String(tab.progress.current) },
          { text: ' de ' }, { bold: String(tab.progress.total) }, { text: '…' }
        ],
        sub: 'Pode navegar em outras abas. Faltam ' + Math.max(0, tab.progress.total - tab.progress.done) + '.'
      };
      if (tab.keepAwakeBlocked) info.sub = 'Segundo plano bloqueado pelo navegador: mantenha a aba visível para acelerar.';
    } else {
      info = resultHeadline(tab.result);
      if (!info) {
        if (tab.total === 0) {
          info = { parts: [{ text: 'Grade não encontrada' }], sub: 'Abra Declaração de Serviços Contratados > Incluir e carregue as notas.' };
        } else if (tab.pending > 0) {
          info = {
            parts: [{ bold: String(tab.pending) }, { text: ' ' + (tab.pending === 1 ? 'linha pendente' : 'linhas pendentes') }],
            sub: 'De ' + tab.total + ' linhas na grade.'
          };
        } else {
          info = { parts: [{ text: 'Nada pendente' }], sub: 'Todas as ' + tab.total + ' linhas já estão preenchidas.' };
        }
      }
    }

    // textos gerados pela extensão, com números e rótulos próprios
    setRichText($('headline'), info.parts);
    $('sub').textContent = info.sub || '';
    $('sub').classList.toggle('alert', !!info.alert);

    if (tab.running && tab.progress) {
      $('bar').hidden = false;
      var pct = Math.round((tab.progress.done / Math.max(tab.progress.total, 1)) * 100);
      $('fill').style.width = Math.max(0, Math.min(100, pct)) + '%';
    } else {
      $('bar').hidden = true;
    }

    var go = $('go');
    if (tab.running) {
      go.textContent = 'Parar';
      go.classList.add('stop');
      go.disabled = false;
    } else {
      go.classList.remove('stop');
      go.disabled = tab.pending === 0;
      go.textContent = tab.pending === 0
        ? 'Nada a aplicar'
        : 'Aplicar “' + P.getOption(state.prefs.option).label + '” a ' + P.plural(tab.pending, 'linha', 'linhas');
    }
  }

  function connect() {
    try {
      port = chrome.runtime.connect({ name: 'popup' });
    } catch (e) {
      return;
    }
    port.onMessage.addListener(function (message) {
      if (message && message.cmd === 'state') render(message.payload);
    });
    port.onDisconnect.addListener(function () { port = null; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    el = {};
    buildControls();
    connect();
    refresh();
  });
})();
