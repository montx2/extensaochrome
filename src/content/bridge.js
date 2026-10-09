/**
 * Ponte (mundo isolado): liga o executor (mundo MAIN) ao service worker.
 * Motivo: scripts no mundo MAIN não têm acesso a chrome.runtime.
 * Tudo que atravessa a ponte é validado: formato, versão, canal e token.
 */
(function () {
  'use strict';

  if (window.__optanteBridge) return;
  window.__optanteBridge = true;

  var P = self.ISSProtocol;
  if (!P) return;

  var CHANNEL = 'optante-facil/v1';
  var COMMANDS = { start: 1, stop: 1, resume: 1, discard: 1, refresh: 1, prefs: 1 };
  var EVENTS = {};
  EVENTS[P.MSG.HELLO] = 1;
  EVENTS[P.MSG.STATE] = 1;
  EVENTS[P.MSG.PROGRESS] = 1;
  EVENTS[P.MSG.DONE] = 1;
  EVENTS[P.MSG.ERROR] = 1;
  EVENTS[P.MSG.ORPHAN] = 1;

  var token = null;
  var port = null;
  var closed = false;
  var attempts = 0;
  var windowStart = Date.now();
  var windowCount = 0;

  function allowed() { // anti-flood: nada legítimo passa de 50 msg/s
    var now = Date.now();
    if (now - windowStart > 1000) { windowStart = now; windowCount = 0; }
    windowCount++;
    return windowCount <= 50;
  }

  function toPage(type, payload) {
    window.postMessage({
      __optante: true,
      v: P.PROTOCOL_VERSION,
      channel: CHANNEL,
      token: token,
      type: type,
      payload: payload || {}
    }, window.location.origin);
  }

  function connect() {
    if (closed) return;
    try {
      port = chrome.runtime.connect({ name: 'optante-facil' });
    } catch (e) {
      scheduleReconnect();
      return;
    }
    attempts = 0;

    port.onMessage.addListener(function (message) {
      if (!message || typeof message !== 'object') return;
      if (!COMMANDS[message.cmd] && message.cmd !== 'init') return;
      toPage(message.cmd === 'init' ? 'cmd:init' : 'cmd:' + message.cmd, message.payload);
    });

    port.onDisconnect.addListener(function () {
      port = null;
      var reason = '';
      try { reason = (chrome.runtime.lastError && chrome.runtime.lastError.message) || ''; } catch (e) { /* ignora */ }
      // Após atualização/desinstalação da extensão não há o que reconectar.
      if (/context invalidated|Extension context/i.test(reason)) { closed = true; return; }
      scheduleReconnect();
    });
  }

  function scheduleReconnect() {
    if (closed || port) return;
    attempts = Math.min(attempts + 1, 6);
    var delay = Math.min(30000, 500 * Math.pow(2, attempts));
    window.setTimeout(connect, delay);
  }

  window.addEventListener('message', function (event) {
    if (event.source && event.source !== window) return; // somente este frame
    var data = event.data;
    if (!data || data.__optante !== true) return;
    if (data.channel !== CHANNEL || data.v !== P.PROTOCOL_VERSION) return;
    if (!EVENTS[data.type]) return;             // allowlist de eventos
    if (data.payload !== undefined && (typeof data.payload !== 'object' || data.payload === null)) return;
    if (!allowed()) return;

    if (data.type === P.MSG.HELLO) {
      if (!token) {
        token = (self.crypto && self.crypto.randomUUID)
          ? self.crypto.randomUUID()
          : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
      }
      toPage('cmd:init', { token: token });
      // Avisa o service worker que este frame existe; ele responde com as preferências.
      if (!port) connect();
      if (port) {
        try { port.postMessage({ type: P.MSG.HELLO, payload: { url: window.location.href } }); } catch (e) { /* ignora */ }
      }
      return;
    }
    if (!token || data.token !== token) return; // handshake obrigatório
    if (!port) connect();                       // perdeu a porta: tenta novamente
    try {
      port.postMessage({ type: data.type, payload: data.payload || {} });
    } catch (e) {
      scheduleReconnect();
    }
  });

  window.addEventListener('pagehide', function () {
    closed = true;
    if (port) { try { port.disconnect(); } catch (e) { /* ignora */ } port = null; }
  });

  connect();
})();
