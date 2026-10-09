/**
 * Executor (mundo MAIN da página do ISS.net).
 * - Desenha o painel flutuante (Shadow DOM, isolado do CSS do sistema).
 * - Executa o preenchimento linha a linha, com retomada e botão Parar.
 * - Conversa com a extensão apenas por mensagens validadas (ponte window.postMessage).
 * Nenhum dado da declaração sai da página.
 */
(function () {
  'use strict';

  if (window.__optanteExecutor) return;
  window.__optanteExecutor = true;

  var P = window.ISSProtocol;
  var C = window.ISSCore;
  if (!P || !C) return;

  var L = P.LIMITS;
  var M = P.MSG;
  var CHANNEL = 'optante-facil/v1';
  var JOB_KEY = 'optanteFacil:job:v3';

  // ---------- Estado ----------
  var token = null;
  var stopFlag = false;
  var heartbeat = null;
  var host = null;
  var root = null;
  var ui = {};
  var lastReport = 0;
  var pendingDecision = null; // resolução do pedido de retomada

  var prefs = P.sanitizePrefs({});
  var state = {
    running: false,
    visible: document.visibilityState !== 'hidden',
    pending: 0,
    total: 0,
    progress: null, // { done, total, current }
    result: null,   // { status, updated, failed }
    keepAwakeOn: false,
    keepAwakeBlocked: false
  };

  var keepAwake = C.createKeepAwake(window);

  // ---------- Utilidades ----------
  function sleep(ms) { return C.sleep(ms); }

  function readJob() {
    try {
      var raw = window.sessionStorage.getItem(JOB_KEY);
      if (!raw) return null;
      var job = JSON.parse(raw);
      return (job && typeof job === 'object' && job.running === true) ? job : null;
    } catch (e) { return null; }
  }

  function saveJob(job) {
    try { window.sessionStorage.setItem(JOB_KEY, JSON.stringify(job)); } catch (e) { /* ignora */ }
  }

  function clearJob() {
    try { window.sessionStorage.removeItem(JOB_KEY); } catch (e) { /* ignora */ }
  }

  function post(type, payload) {
    window.postMessage({
      __optante: true,
      v: P.PROTOCOL_VERSION,
      channel: CHANNEL,
      token: token,
      type: type,
      payload: payload || {}
    }, window.location.origin);
  }

  function progressPayload() {
    var progress = state.progress || { done: 0, total: Math.max(state.pending, 1), current: 1 };
    return {
      running: state.running,
      done: progress.done,
      total: progress.total,
      current: progress.current,
      left: state.pending,
      keepAwake: state.keepAwakeOn,
      keepAwakeBlocked: state.keepAwakeBlocked,
      visible: state.visible
    };
  }

  function reportState(force) {
    var now = Date.now();
    if (!force && now - lastReport < 3000) return;
    lastReport = now;
    post(M.STATE, {
      pending: state.pending,
      total: state.total,
      running: state.running,
      keepAwake: state.keepAwakeOn,
      keepAwakeBlocked: state.keepAwakeBlocked,
      visible: state.visible,
      result: state.result
    });
  }

  function applyPrefs(next) {
    prefs = P.sanitizePrefs(next);
    render();
  }

  // ---------- Keep-awake (segundo plano) ----------
  function ensureKeepAwake() {
    if (!prefs.keepAwake) return false;
    if (keepAwake.isActive()) return true;
    var ok = keepAwake.start();
    state.keepAwakeOn = ok;
    state.keepAwakeBlocked = !ok;
    return ok;
  }

  function releaseKeepAwake() {
    keepAwake.stop();
    state.keepAwakeOn = false;
  }

  // ---------- Painel ----------
  var CSS = [
    ':host{all:initial}',
    '*,*::before,*::after{box-sizing:border-box}',
    '[hidden]{display:none !important}',
    'button,select{font:inherit;color:inherit}',
    ':focus-visible{outline:2px solid #2b7a9b;outline-offset:2px}',
    '.card,.pill{position:fixed;right:16px;bottom:92px;z-index:2147483647;font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1c2b36;background:#fff;border:1px solid #d9e2e8;box-shadow:0 10px 30px rgba(16,40,56,.16),0 1px 3px rgba(16,40,56,.10)}',
    '.card{width:302px;border-radius:12px;overflow:hidden}',
    'header{display:flex;align-items:center;justify-content:space-between;padding:10px 8px 10px 14px}',
    '.title{display:flex;align-items:center;gap:8px;font-weight:600;letter-spacing:.1px}',
    '.dot{width:8px;height:8px;border-radius:50%;background:#2b7a9b;flex:none}',
    '.dot.busy{background:#c8892b}',
    '.min{width:26px;height:26px;border:0;border-radius:6px;background:transparent;color:#6b7c88;cursor:pointer;font-size:18px;line-height:1}',
    '.min:hover{background:#f1f5f8;color:#1c2b36}',
    '.body{padding:2px 14px 14px}',
    '.label{margin:0 0 6px;color:#6b7c88;font-size:12px}',
    '.seg{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:3px;background:#f1f5f8;border-radius:9px}',
    '.seg button{padding:7px 2px;border:0;border-radius:7px;background:transparent;color:#4a5b68;font-size:12px;cursor:pointer;white-space:nowrap}',
    '.seg button:hover:not([aria-checked="true"]){color:#1c2b36}',
    '.seg button[aria-checked="true"]{background:#fff;color:#17566f;font-weight:600;box-shadow:0 1px 2px rgba(16,40,56,.16)}',
    '.seg.locked button{cursor:default;opacity:.6}',
    '.status{min-height:38px;margin:12px 0 0;color:#1c2b36}',
    '.status.muted{color:#6b7c88}',
    '.status b{font-weight:600}',
    '.bar{height:4px;margin:8px 0 0;background:#e6edf1;border-radius:2px;overflow:hidden}',
    '.bar i{display:block;height:100%;width:0;background:#2b7a9b;transition:width .25s ease}',
    '.go{width:100%;margin-top:12px;padding:9px 10px;border:1px solid transparent;border-radius:8px;background:#2b7a9b;color:#fff;font-weight:600;cursor:pointer}',
    '.go:hover:not(:disabled){background:#236784}',
    '.go:disabled{background:#e1e8ed;color:#8a9aa5;cursor:default}',
    '.go.stop{background:#fff;color:#b4372c;border-color:#e3b5b0}',
    '.go.stop:hover{background:#fdf3f2}',
    '.hint{margin:8px 0 0;padding:7px 9px;border-radius:7px;background:#fdf6ec;color:#7a5514;font-size:12px;display:flex;gap:8px;align-items:center;justify-content:space-between}',
    '.hint button{border:0;background:transparent;color:#17566f;font-weight:600;cursor:pointer;text-decoration:underline;padding:0;font-size:12px}',
    'footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 14px;border-top:1px solid #eef2f5;color:#6b7c88;font-size:12px}',
    'footer select{border:0;background:transparent;color:#2b7a9b;font-weight:600;cursor:pointer;padding:2px 0}',
    'footer select:disabled{color:#8a9aa5;cursor:default}',
    '.chip{display:inline-flex;align-items:center;gap:5px;color:#2b7a9b}',
    '.pill{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;cursor:pointer;font-weight:600}',
    '.pill:hover{background:#f7fafb}',
    '.badge{min-width:20px;padding:0 6px;border-radius:999px;background:#2b7a9b;color:#fff;font-size:12px;text-align:center}',
    '@media (prefers-reduced-motion:reduce){.bar i{transition:none}}'
  ].join('\n');

  function buildPanel() {
    host = document.createElement('div');
    host.id = 'optante-facil-panel';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = [
      '<style>', CSS, '</style>',
      '<section class="card" id="card" role="region" aria-label="Optante Fácil">',
        '<header>',
          '<span class="title"><span class="dot" id="dot"></span>Optante Fácil</span>',
          '<button class="min" id="min" type="button" title="Minimizar" aria-label="Minimizar painel">&minus;</button>',
        '</header>',
        '<div class="body">',
          '<p class="label" id="lbl">Marcar linhas pendentes como</p>',
          '<div class="seg" id="seg" role="radiogroup" aria-labelledby="lbl"></div>',
          '<p class="status" id="st" role="status" aria-live="polite"></p>',
          '<div class="bar" id="bar" hidden><i id="fill"></i></div>',
          '<div class="hint" id="hint" hidden>',
            '<span>Segundo plano bloqueado pelo navegador.</span>',
            '<button type="button" id="fix">Ativar</button>',
          '</div>',
          '<button class="go" id="go" type="button"></button>',
        '</div>',
        '<footer>',
          '<label for="spd">Velocidade</label>',
          '<span class="chip" id="chip" hidden>2º plano ativo</span>',
          '<select id="spd"></select>',
        '</footer>',
      '</section>',
      '<button class="pill" id="pill" type="button" hidden aria-label="Abrir o Optante Fácil">',
        '<span class="dot" id="pilldot"></span><span id="pilltxt">Optante</span><span class="badge" id="badge" hidden></span>',
      '</button>'
    ].join('');

    var $ = function (id) { return root.getElementById(id); };
    ui = {
      card: $('card'), pill: $('pill'), pilltxt: $('pilltxt'), pilldot: $('pilldot'), badge: $('badge'),
      dot: $('dot'), min: $('min'), seg: $('seg'), st: $('st'), bar: $('bar'), fill: $('fill'),
      go: $('go'), spd: $('spd'), chip: $('chip'), hint: $('hint'), fix: $('fix'), radios: []
    };

    // Opções e velocidades: conteúdo estático definido pela extensão, nunca pela página.
    P.OPTIONS.forEach(function (option) {
      var button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'radio');
      button.dataset.id = option.id;
      button.textContent = option.label;
      button.addEventListener('click', function () { selectOption(option.id); });
      ui.seg.appendChild(button);
      ui.radios.push(button);
    });

    P.SPEEDS.forEach(function (speed) {
      var opt = document.createElement('option');
      opt.value = speed.id;
      opt.textContent = speed.label;
      ui.spd.appendChild(opt);
    });

    ui.spd.addEventListener('change', function () {
      prefs.speed = P.sanitizeSpeed(ui.spd.value);
      post(M.STATE, { prefs: prefs });
      render();
    });

    ui.seg.addEventListener('keydown', onSegKeydown);
    ui.min.addEventListener('click', function () { setCollapsed(true); });
    ui.pill.addEventListener('click', function () { setCollapsed(false); });
    ui.fix.addEventListener('click', function () { ensureKeepAwake(); render(); });
    ui.go.addEventListener('click', onPrimaryClick);

    (document.body || document.documentElement).appendChild(host);
    render();
  }

  function onSegKeydown(event) {
    if (state.running) return;
    var current = P.OPTIONS.findIndex(function (o) { return o.id === prefs.option; });
    var next = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % P.OPTIONS.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current + P.OPTIONS.length - 1) % P.OPTIONS.length;
    if (next === null) return;
    event.preventDefault();
    selectOption(P.OPTIONS[next].id);
    ui.radios[next].focus();
  }

  function selectOption(id) {
    if (state.running || prefs.option === id) return;
    prefs.option = P.sanitizeOption(id);
    state.result = null;
    post(M.STATE, { prefs: prefs });
    render();
  }

  function setCollapsed(value) {
    prefs.collapsed = !!value;
    post(M.STATE, { prefs: prefs });
    render();
  }

  function onPrimaryClick() {
    if (state.running) { stopFlag = true; render(); return; }
    // O clique do usuário é a garantia de que o áudio de keep-awake pode iniciar.
    ensureKeepAwake();
    post(M.STATE, { prefs: prefs, request: 'start' });
    render();
  }

  /** Monta o texto de status sem innerHTML: só nós de texto e <b>. */
  function setRichText(node, parts) {
    if (!node) return;
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

  function statusParts() {
    var pend = state.pending;
    var total = state.total;
    if (state.running && state.progress) {
      if (stopFlag) return { parts: [{ text: 'Parando…' }], muted: true };
      return {
        parts: [
          { text: 'Marcando linha ' }, { bold: String(state.progress.current) },
          { text: ' de ' }, { bold: String(state.progress.total) }, { text: '…' }
        ]
      };
    }
    if (state.result) {
      var r = state.result;
      var updated = P.plural(r.updated, 'linha atualizada', 'linhas atualizadas');
      if (r.status === P.STATUS.DONE) return { parts: [{ text: 'Concluído. ' }, { bold: updated }, { text: '.' }] };
      if (r.status === P.STATUS.STOPPED) return { parts: [{ text: 'Interrompido. ' }, { bold: updated }, { text: '.' }] };
      return {
        parts: [
          { bold: updated }, { text: '. ' },
          {
            text: P.plural(r.failed, 'não aceitou', 'não aceitaram') + ' a alteração e ' +
              (r.failed === 1 ? 'foi destacada' : 'foram destacadas') + ' em vermelho.'
          }
        ]
      };
    }
    if (pend > 0) {
      return {
        parts: [
          { bold: P.plural(pend, 'linha pendente', 'linhas pendentes') },
          { text: ' de ' + total + '.' }
        ]
      };
    }
    return {
      parts: [{ text: total > 0 ? 'Nenhuma linha pendente. Todas as ' + total + ' já estão preenchidas.' : 'Aguardando a grade…' }],
      muted: true
    };
  }

  function render() {
    if (!host) return;

    ui.radios.forEach(function (button) {
      var on = button.dataset.id === prefs.option;
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
      button.disabled = state.running && !on;
    });
    ui.seg.classList.toggle('locked', state.running);
    ui.spd.disabled = state.running;
    ui.spd.value = prefs.speed;
    ui.dot.classList.toggle('busy', state.running);

    var info = statusParts();
    setRichText(ui.st, info.parts); // texto gerado pela extensão, sem dados da página
    ui.st.classList.toggle('muted', !!info.muted);

    if (state.running && state.progress) {
      ui.bar.hidden = false;
      var pct = Math.round((state.progress.done / Math.max(state.progress.total, 1)) * 100);
      ui.fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    } else {
      ui.bar.hidden = true;
    }

    ui.hint.hidden = !(state.running && prefs.keepAwake && state.keepAwakeBlocked);

    if (state.running) {
      ui.go.textContent = stopFlag ? 'Parando…' : 'Parar';
      ui.go.disabled = stopFlag;
      ui.go.classList.add('stop');
    } else {
      ui.go.classList.remove('stop');
      ui.go.disabled = state.pending === 0;
      ui.go.textContent = state.pending === 0
        ? 'Nada a aplicar'
        : 'Aplicar “' + P.getOption(prefs.option).label + '” a ' + P.plural(state.pending, 'linha', 'linhas');
    }

    ui.card.hidden = prefs.collapsed;
    ui.pill.hidden = !prefs.collapsed;
    ui.pilldot.className = state.running ? 'dot busy' : 'dot';
    ui.chip.hidden = !state.keepAwakeOn;

    if (state.running && state.progress) {
      ui.pilltxt.textContent = state.progress.current + '/' + state.progress.total;
      ui.badge.hidden = true;
    } else {
      ui.pilltxt.textContent = 'Optante';
      ui.badge.hidden = state.pending === 0;
      ui.badge.textContent = String(state.pending);
    }
  }

  function destroyPanel() {
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null; root = null; ui = {};
  }

  // ---------- Processamento ----------
  function startHeartbeat() {
    stopHeartbeat();
    heartbeat = window.setInterval(function () {
      if (state.running) post(M.PROGRESS, progressPayload());
    }, L.HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeat) { window.clearInterval(heartbeat); heartbeat = null; }
  }

  function refreshCounts() {
    var targets = C.findTargets(document);
    state.total = targets.length;
    state.pending = C.countPending(document);
  }

  async function runJob(optionId, speedId, resume) {
    if (state.running) return;

    var option = P.getOption(P.sanitizeOption(optionId));
    var speed = P.getSpeed(P.sanitizeSpeed(speedId));
    var attempts = (resume && typeof resume.attempts === 'object' && resume.attempts) ? resume.attempts : {};

    refreshCounts();
    var initial = P.clampInt(resume && resume.initial, 0, L.MAX_ROWS, state.pending);
    if (initial < state.pending) initial = state.pending;
    if (initial === 0) { render(); return; }

    C.clearMarks(document);
    state.running = true;
    state.stopping = false;
    state.result = null;
    stopFlag = false;
    state.progress = { done: 0, total: initial, current: 1 };
    ensureKeepAwake();
    startHeartbeat();
    render();

    for (;;) {
      if (stopFlag) break;
      var targets = C.findTargets(document);
      var index = -1;
      for (var i = 0; i < targets.length; i++) {
        if (C.isPending(targets[i]) && (attempts[i] || 0) < L.MAX_TRY) { index = i; break; }
      }
      if (index === -1) break;

      attempts[index] = (attempts[index] || 0) + 1;
      saveJob({
        running: true, option: option.id, speed: speed.id,
        initial: initial, attempts: attempts, ts: Date.now()
      });

      var select = targets[index];
      C.scrollIntoViewSafe(select);
      C.applyValue(select, option);

      await C.waitIdle({
        minMs: speed.ms,
        quietMs: L.QUIET_MS,
        maxMs: L.MAX_WAIT_MS,
        shouldStop: function () { return stopFlag; },
        window: window,
        document: document
      });

      refreshCounts();
      var done = Math.max(0, initial - state.pending);
      state.progress = { done: done, total: Math.max(initial, done + 1), current: done + 1 };
      post(M.PROGRESS, progressPayload());
      render();

      if (state.pending === 0) break;
    }

    // ---- Encerramento ----
    var wasStopped = stopFlag;
    var left = C.findTargets(document).filter(function (el) { return C.isPending(el); });
    var updated = Math.max(0, initial - left.length);

    var status = wasStopped ? P.STATUS.STOPPED : (left.length > 0 ? P.STATUS.FAILED : P.STATUS.DONE);
    state.result = { status: status, updated: updated, failed: left.length, option: option.id, ts: Date.now() };

    if (!wasStopped && left.length > 0) {
      C.markFailed(left);
      C.scrollIntoViewSafe(left[0]);
    }

    clearJob();
    stopHeartbeat();
    releaseKeepAwake();
    state.running = false;
    stopFlag = false;
    state.progress = null;
    refreshCounts();
    render();

    post(M.DONE, {
      status: status,
      updated: updated,
      failed: left.length,
      pending: state.pending,
      option: option.id,
      ts: Date.now()
    });
  }

  // ---------- Mensagens ----------
  function handleCommand(type, payload) {
    payload = payload || {};
    switch (type) {
      case 'cmd:start':
        runJob(payload.optionId, payload.speedId, null);
        break;
      case 'cmd:stop':
        if (state.running) { stopFlag = true; render(); }
        break;
      case 'cmd:refresh':
        refreshCounts();
        render();
        reportState(true);
        break;
      case 'cmd:prefs':
        applyPrefs(payload.prefs);
        break;
      case 'cmd:resume':
        if (pendingDecision) { var resolve = pendingDecision; pendingDecision = null; resolve(true); }
        if (!state.running && payload && payload.job) {
          runJob(payload.job.option, payload.job.speed, payload.job);
        }
        break;
      case 'cmd:discard':
        if (pendingDecision) { var settle = pendingDecision; pendingDecision = null; settle(false); }
        clearJob();
        break;
      default:
        break; // tipo desconhecido: ignorado
    }
  }

  window.addEventListener('message', function (event) {
    if (event.source && event.source !== window) return; // só mensagens deste mesmo frame
    var data = event.data;
    if (!data || data.__optante !== true || data.channel !== CHANNEL) return;
    if (data.v !== P.PROTOCOL_VERSION) return;

    if (data.type === 'cmd:init') {
      token = typeof data.token === 'string' && data.token ? data.token : null;
      applyPrefs(data.payload && data.payload.prefs);
      return;
    }
    if (!token || data.token !== token) return; // exige handshake prévio
    handleCommand(data.type, data.payload);
  });

  document.addEventListener('visibilitychange', function () {
    state.visible = document.visibilityState !== 'hidden';
    if (!state.running) releaseKeepAwake();
    reportState(true);
  });

  // ---------- Ciclo de vida ----------
  /** Evita dois painéis: um iframe só assume a grade se o frame principal não a tiver. */
  function ownsGrid() {
    try {
      if (window.top === window.self) return true;
      var topDoc = window.top.document;
      return C.findTargets(topDoc).length === 0;
    } catch (e) {
      return true; // frame isolado (cross-origin): mantém o comportamento padrão
    }
  }

  function tick() {
    if (!ownsGrid()) {
      if (host) destroyPanel();
      return;
    }
    var total = C.findTargets(document).length;
    if (total > 0 && !host) {
      buildPanel();
      refreshCounts();
      render();
      reportState(true);   // o popup mostra a contagem mesmo sem o usuário abrir o painel
      checkOrphan();
    } else if (total === 0 && host && !state.running) {
      destroyPanel();
      reportState(true);
    } else if (host) {
      var previous = state.pending + ':' + state.total;
      refreshCounts();
      if (!state.running && previous !== state.pending + ':' + state.total) {
        state.result = null;
        render();
        reportState(true);
      }
    }
  }

  /** Após uma recarga no meio do processo, pergunta ao service worker se deve retomar. */
  function checkOrphan() {
    var job = readJob();
    if (!job) return;
    if (Date.now() - (job.ts || 0) > L.RESUME_WINDOW_MS) { clearJob(); return; }

    var decided = new Promise(function (resolve) {
      pendingDecision = resolve;
      post(M.ORPHAN, { job: job });
      window.setTimeout(function () {
        if (pendingDecision) { pendingDecision = null; resolve(true); } // sem resposta: retoma
      }, 3000);
    });

    decided.then(function (shouldResume) {
      if (!shouldResume) { clearJob(); return; }
      if (!state.running && C.countPending(document) > 0) {
        state.result = null;
        runJob(job.option, job.speed, job);
      } else {
        clearJob();
      }
    });
  }

  // Primeiro contato: pede o token e as preferências à ponte.
  post(M.HELLO, { url: window.location.href });
  tick();
  window.setInterval(tick, 1000);
})();
