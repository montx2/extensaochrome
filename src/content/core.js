/**
 * Núcleo de DOM do executor (mundo MAIN).
 * Regras: nenhuma API de extensão aqui, nenhum dado sai da página.
 * Carregado antes de executor.js; também usado pelos testes (jsdom).
 */
(function (root) {
  'use strict';

  if (root.ISSCore) return;
  var P = root.ISSProtocol || {};
  var normalize = P.normalize || function (s) { return String(s || '').trim().toLowerCase(); };
  var clampInt = P.clampInt || function (v, min, max, fb) { var n = parseInt(v, 10); return isFinite(n) ? Math.min(max, Math.max(min, n)) : fb; };

  var FLAG_ATTR = 'data-optante-falhou';
  var REQUIRED = ['nao optante', 'optante sn', 'optante mei'];

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function optionTexts(select) {
    var out = [];
    for (var i = 0; i < select.options.length; i++) out.push(normalize(select.options[i].text));
    return out;
  }

  /**
   * Reconhece o campo "Simples Nacional/MEI" pelo conteúdo das opções,
   * nunca por id (que muda entre versões do sistema).
   */
  function isTarget(select) {
    if (!select || select.tagName !== 'SELECT' || !select.options || select.options.length < 2) return false;
    var texts = optionTexts(select);
    for (var i = 0; i < REQUIRED.length; i++) {
      if (texts.indexOf(REQUIRED[i]) === -1) return false;
    }
    return true;
  }

  function findTargets(doc) {
    doc = doc || document;
    var all = doc.querySelectorAll ? doc.querySelectorAll('select') : [];
    var out = [];
    for (var i = 0; i < all.length; i++) if (isTarget(all[i])) out.push(all[i]);
    return out;
  }

  function selectedText(select) {
    var opt = select.options[select.selectedIndex];
    return opt ? normalize(opt.text) : '';
  }

  function isVisible(select) {
    if (!select) return false;
    try {
      var rects = select.getClientRects();
      if (rects && rects.length) return true;
    } catch (e) { /* ignora */ }
    return false;
  }

  /** Linha pendente = ainda em "Selecione", habilitada e visível. */
  function isPending(select) {
    if (!isTarget(select) || select.disabled || !isVisible(select)) return false;
    var text = selectedText(select);
    return text === '' || text.indexOf('selecione') === 0;
  }

  function countPending(doc) {
    var targets = findTargets(doc);
    var n = 0;
    for (var i = 0; i < targets.length; i++) if (isPending(targets[i])) n++;
    return n;
  }

  /**
   * Aplica o valor e dispara os eventos que o ASP.NET espera.
   * Não usa eval, nem código da página: apenas eventos padrão do DOM.
   */
  function applyValue(select, option) {
    if (!select || !option || !isTarget(select)) return false;
    var wanted = option.match;
    var found = null;
    for (var i = 0; i < select.options.length; i++) {
      if (normalize(select.options[i].text) === wanted) { found = select.options[i]; break; }
    }
    if (!found) return false;

    try { select.focus({ preventScroll: true }); } catch (e) { /* ignora */ }
    try { select.value = found.value; } catch (e) { /* ignora */ }
    select.selectedIndex = found.index;

    var doc = select.ownerDocument || document;
    var win = doc.defaultView || window;
    var EventCtor = win.Event || Event;
    try {
      select.dispatchEvent(new EventCtor('input', { bubbles: true, cancelable: false }));
      select.dispatchEvent(new EventCtor('change', { bubbles: true, cancelable: false }));
    } catch (e) {
      // Ambientes sem construtor de Event (não deve ocorrer no Chrome)
      var legacy = doc.createEvent('HTMLEvents');
      legacy.initEvent('change', true, false);
      select.dispatchEvent(legacy);
    }
    return true;
  }

  /** Detecta postback assíncrono (ASP.NET WebForms / jQuery) em andamento. */
  function isBusy(win) {
    win = win || window;
    try {
      var sys = win.Sys && win.Sys.WebForms && win.Sys.WebForms.PageRequestManager;
      if (sys) {
        var manager = sys.getInstance();
        if (manager && manager.get_isInAsyncPostBack && manager.get_isInAsyncPostBack()) return true;
      }
    } catch (e) { /* ignora */ }
    try {
      if (win.jQuery && win.jQuery.active > 0) return true;
    } catch (e) { /* ignora */ }
    return false;
  }

  /**
   * Espera mínima (cadência) + espera até a página ficar estável.
   * Sai imediatamente quando shouldStop() retorna true.
   */
  function waitIdle(options) {
    var opts = options || {};
    var win = opts.window || window;
    var doc = opts.document || win.document;
    var minMs = clampInt(opts.minMs, 0, 60000, 0);
    var quietMs = clampInt(opts.quietMs, 0, 30000, 400);
    var maxMs = clampInt(opts.maxMs, 0, 120000, 20000);
    var shouldStop = typeof opts.shouldStop === 'function' ? opts.shouldStop : function () { return false; };

    var started = Date.now();
    var lastChange = started;
    var observer = null;

    try {
      observer = new win.MutationObserver(function () { lastChange = Date.now(); });
      observer.observe(doc.documentElement || doc.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'disabled']
      });
    } catch (e) { observer = null; }

    function done() {
      if (observer) { try { observer.disconnect(); } catch (e) { /* ignora */ } }
    }

    return (async function () {
      try {
        while (!shouldStop() && Date.now() - started < minMs) await sleep(50);
        while (!shouldStop() && Date.now() - started < maxMs) {
          if (!isBusy(win) && Date.now() - lastChange >= quietMs) break;
          await sleep(100);
        }
      } finally {
        done();
      }
    })();
  }

  /**
   * Keep-awake: um fluxo de áudio inaudível impede que o Chrome
   * coloque a aba oculta em throttling intenso (1 chamada por minuto).
   * Sem isso, o processamento em segundo plano fica até 60x mais lento.
   * Nenhum som é reproduzido: amplitude ~ -74 dBFS.
   */
  function createKeepAwake(win) {
    win = win || window;
    var ctx = null;
    var source = null;
    var gain = null;
    var active = false;

    function stop() {
      if (source) { try { source.stop(); } catch (e) { /* ignora */ } }
      if (ctx) { try { ctx.close(); } catch (e) { /* ignora */ } }
      source = null; gain = null; ctx = null; active = false;
    }

    function start() {
      if (active) return true;
      var Ctor = win.AudioContext || win.webkitAudioContext;
      if (!Ctor) return false;
      try {
        ctx = new Ctor();
        var seconds = 2;
        var buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < data.length; i++) {
          data[i] = Math.sin((i / ctx.sampleRate) * 2 * Math.PI * 1000) * 0.0002;
        }
        source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        gain = ctx.createGain();
        gain.gain.value = 1;
        source.connect(gain);
        gain.connect(ctx.destination);
        source.start(0);
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function () { /* ignora */ });
        active = true;
        return true;
      } catch (e) {
        stop();
        return false;
      }
    }

    return { start: start, stop: stop, isActive: function () { return active; } };
  }

  function scrollIntoViewSafe(el) {
    if (!el || typeof el.scrollIntoView !== 'function') return;
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* ignora */ }
  }

  /** Destaca na grade as linhas que recusaram a alteração. */
  function markFailed(rows) {
    for (var i = 0; i < rows.length; i++) {
      var el = rows[i];
      if (!el || !el.style) continue;
      el.setAttribute(FLAG_ATTR, '1');
      // Propriedades longas: alguns navegadores ignoram o atalho "outline" via style.
      el.style.outlineWidth = '2px';
      el.style.outlineStyle = 'solid';
      el.style.outlineColor = '#c0392b';
      el.style.outlineOffset = '1px';
    }
  }

  function clearMarks(doc) {
    doc = doc || document;
    var marked = doc.querySelectorAll('[' + FLAG_ATTR + ']');
    for (var i = 0; i < marked.length; i++) {
      marked[i].removeAttribute(FLAG_ATTR);
      if (marked[i].style) {
        marked[i].style.outlineWidth = '';
        marked[i].style.outlineStyle = '';
        marked[i].style.outlineColor = '';
        marked[i].style.outlineOffset = '';
      }
    }
  }

  root.ISSCore = {
    FLAG_ATTR: FLAG_ATTR,
    sleep: sleep,
    normalize: normalize,
    isTarget: isTarget,
    findTargets: findTargets,
    selectedText: selectedText,
    isPending: isPending,
    isVisible: isVisible,
    countPending: countPending,
    applyValue: applyValue,
    isBusy: isBusy,
    waitIdle: waitIdle,
    createKeepAwake: createKeepAwake,
    scrollIntoViewSafe: scrollIntoViewSafe,
    markFailed: markFailed,
    clearMarks: clearMarks
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.ISSCore;
})(typeof self !== 'undefined' ? self : this);
