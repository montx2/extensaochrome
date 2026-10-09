/**
 * Contrato compartilhado entre service worker, popup, bridge e executor.
 * Arquivo clássico (sem módulos): funciona com importScripts(), <script> e content_scripts.
 */
(function (root) {
  'use strict';

  if (root.ISSProtocol) return; // já carregado neste contexto

  var PROTOCOL_VERSION = 1;

  /** Hosts atendidos (Itaúna-MG e demais municípios no mesmo domínio). */
  var MATCHES = ['https://*.issnetonline.com.br/*'];
  var HOME_URL = 'https://www.issnetonline.com.br/itauna/online/';

  /** Valores aceitos pelo campo "Simples Nacional/MEI". */
  var OPTIONS = [
    { id: 'nao', label: 'Não Optante', match: 'nao optante', short: 'Não Optante' },
    { id: 'sn', label: 'Optante SN', match: 'optante sn', short: 'SN' },
    { id: 'mei', label: 'Optante MEI', match: 'optante mei', short: 'MEI' }
  ];

  /** Cadências de espera entre linhas. */
  var SPEEDS = [
    { id: 'fast', label: 'Rápida', ms: 700 },
    { id: 'normal', label: 'Normal', ms: 1200 },
    { id: 'safe', label: 'Cautelosa', ms: 2200 }
  ];

  /** Preferências persistidas em chrome.storage.local. */
  var DEFAULTS = {
    option: 'nao',
    speed: 'normal',
    collapsed: false,
    notify: true,
    keepAwake: true
  };

  /** Limites de segurança do processamento. */
  var LIMITS = {
    MAX_TRY: 4,             // tentativas por linha antes de desistir
    QUIET_MS: 400,          // silêncio de mutações para considerar a página estabilizada
    MAX_WAIT_MS: 20000,     // teto de espera por linha
    HEARTBEAT_MS: 5000,     // batimento executor -> service worker
    STALE_MS: 60000,        // sem notícias: processamento considerado lento/parado
    RESUME_WINDOW_MS: 300000, // janela para retomar após recarga da página
    MAX_ROWS: 3000          // proteção contra laço infinito
  };

  /** Tipos de mensagem (allowlist: nada fora desta lista é processado). */
  var MSG = {
    HELLO: 'hello',         // bridge -> SW: conteúdo pronto
    GOODBYE: 'goodbye',
    PING: 'ping',           // SW -> bridge: ainda aí?
    STATE: 'state',         // executor -> SW: contagem atual
    PROGRESS: 'progress',   // executor -> SW: andamento
    DONE: 'done',           // executor -> SW: conclusão/interrupção
    ERROR: 'error',
    ORPHAN: 'orphan',       // executor -> SW: achei um job órfão; retomo?
    START: 'start',         // SW -> executor
    STOP: 'stop',
    RESUME: 'resume',
    DISCARD: 'discard',
    REFRESH: 'refresh'
  };

  /** Status possíveis de um job. */
  var STATUS = {
    IDLE: 'idle',
    RUNNING: 'running',
    STOPPING: 'stopping',
    DONE: 'done',
    STOPPED: 'stopped',
    FAILED: 'failed',
    STALLED: 'stalled'
  };

  function findById(list, id) {
    if (typeof id !== 'string') return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  var api = {
    PROTOCOL_VERSION: PROTOCOL_VERSION,
    MATCHES: MATCHES,
    HOME_URL: HOME_URL,
    OPTIONS: OPTIONS,
    SPEEDS: SPEEDS,
    DEFAULTS: DEFAULTS,
    LIMITS: LIMITS,
    MSG: MSG,
    STATUS: STATUS,

    getOption: function (id) { return findById(OPTIONS, id); },
    getSpeed: function (id) { return findById(SPEEDS, id); },

    /** Nunca retorna null: sempre cai no padrão seguro. */
    sanitizeOption: function (id) { return (findById(OPTIONS, id) || OPTIONS[0]).id; },
    sanitizeSpeed: function (id) { return (findById(SPEEDS, id) || SPEEDS[1]).id; },

    sanitizePrefs: function (raw) {
      var src = (raw && typeof raw === 'object') ? raw : {};
      return {
        option: api.sanitizeOption(src.option),
        speed: api.sanitizeSpeed(src.speed),
        collapsed: src.collapsed === true,
        notify: src.notify !== false,
        keepAwake: src.keepAwake !== false
      };
    },

    /** Inteiro limitado a uma faixa, com fallback. */
    clampInt: function (value, min, max, fallback) {
      var n = typeof value === 'number' ? value : parseInt(value, 10);
      if (!isFinite(n)) return fallback;
      n = Math.round(n);
      if (n < min) return min;
      if (n > max) return max;
      return n;
    },

    /** Remove acentos, espaços repetidos e caixa — base para comparar textos do sistema. */
    normalize: function (text) {
      var out = String(text == null ? '' : text);
      if (out.normalize) out = out.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return out.replace(/\s+/g, ' ').trim().toLowerCase();
    },

    plural: function (n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  };

  root.ISSProtocol = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : this));
