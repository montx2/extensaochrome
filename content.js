(() => {
  'use strict';
  if (window.__issOptanteAssistente) return;
  window.__issOptanteAssistente = true;

  // ---------- Configuração ----------
  const OPTIONS = [
    { id: 'nao', label: 'Não Optante', match: 'nao optante' },
    { id: 'sn',  label: 'Optante SN',  match: 'optante sn' },
    { id: 'mei', label: 'Optante MEI', match: 'optante mei' }
  ];
  const SPEEDS = [
    { id: 'fast',   label: 'Rápida',    ms: 600 },
    { id: 'normal', label: 'Normal',    ms: 1000 },
    { id: 'safe',   label: 'Cautelosa', ms: 2000 }
  ];
  const PREFS_KEY = 'issOptante:prefs';
  const JOB_KEY = 'issOptante:job';
  const FLAG_ATTR = 'data-iss-optante-flag';
  const MAX_TRY = 4;            // tentativas por linha antes de desistir dela
  const QUIET_MS = 400;         // tempo sem mudanças na página para considerar a atualização concluída
  const MAX_WAIT = 15000;       // limite de segurança por linha (ms)
  const RESUME_WINDOW = 30000;  // só retoma um processamento interrompido se for recente (ms)

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // ---------- Armazenamento ----------
  const read = (storage, key, fallback) => {
    try { const v = JSON.parse(storage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  };
  const write = (storage, key, value) => { try { storage.setItem(key, JSON.stringify(value)); } catch (e) {} };

  const prefs = Object.assign({ option: 'nao', speed: 'normal', collapsed: false }, read(localStorage, PREFS_KEY, {}));
  if (!OPTIONS.some(o => o.id === prefs.option)) prefs.option = 'nao';
  if (!SPEEDS.some(s => s.id === prefs.speed)) prefs.speed = 'normal';
  const savePrefs = () => write(localStorage, PREFS_KEY, prefs);

  // Estado do processamento (sobrevive a recarregamento completo da página)
  let job = read(sessionStorage, JOB_KEY, null);
  const saveJob = () => (job ? write(sessionStorage, JOB_KEY, job) : sessionStorage.removeItem(JOB_KEY));

  // ---------- Localização dos campos (pelo conteúdo, não por ID) ----------
  // O select de "Simples Nacional/MEI" é o que tem: Selecione / Não Optante / Optante SN / Optante MEI
  const isTarget = sel => {
    const t = Array.from(sel.options, o => norm(o.text));
    return OPTIONS.every(o => t.includes(o.match));
  };
  const getTargets = () => Array.from(document.querySelectorAll('select')).filter(isTarget);
  const selectedText = sel => norm(sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text);
  const isPending = sel => selectedText(sel) === 'selecione' && !sel.disabled && sel.getClientRects().length > 0;
  const countPending = () => getTargets().filter(isPending).length;

  // ---------- Detecção de "página ocupada" ----------
  function busy() {
    try {
      const m = window.Sys && window.Sys.WebForms && window.Sys.WebForms.PageRequestManager;
      if (m) { const p = m.getInstance(); if (p && p.get_isInAsyncPostBack()) return true; }
    } catch (e) {}
    try { if (window.jQuery && window.jQuery.active > 0) return true; } catch (e) {}
    return false;
  }

  let stopFlag = false;

  async function waitIdle(minMs) {
    const start = Date.now();
    let last = start;
    const obs = new MutationObserver(() => { last = Date.now(); });
    obs.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['style', 'class', 'hidden']
    });
    try {
      while (!stopFlag && Date.now() - start < minMs) await sleep(50);
      while (!stopFlag && Date.now() - start < MAX_WAIT) {
        if (!busy() && Date.now() - last > QUIET_MS) break;
        await sleep(100);
      }
    } finally { obs.disconnect(); }
  }

  function choose(sel, option) {
    const opt = Array.from(sel.options).find(o => norm(o.text) === option.match);
    if (!opt) return;
    try { sel.focus({ preventScroll: true }); } catch (e) {}
    sel.selectedIndex = opt.index;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true })); // dispara o __doPostBack do ASP.NET
  }

  const clearFlags = () => document.querySelectorAll(`[${FLAG_ATTR}]`).forEach(el => {
    el.style.outline = ''; el.style.outlineOffset = ''; el.removeAttribute(FLAG_ATTR);
  });
  const flag = el => {
    el.setAttribute(FLAG_ATTR, '1');
    el.style.outline = '2px solid #c0392b';
    el.style.outlineOffset = '1px';
  };

  // ---------- Painel ----------
  let host = null, root = null, ui = {};
  let active = false, resultMsg = '', resultPending = -1, progress = null;

  const CSS = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }
    button, select { font: inherit; color: inherit; }
    button:focus-visible, select:focus-visible { outline: 2px solid #2b7a9b; outline-offset: 2px; }

    .card, .pill {
      position: fixed; right: 16px; bottom: 90px; z-index: 2147483647;
      font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
      color: #1c2b36; background: #fff; border: 1px solid #d6dee4;
      box-shadow: 0 8px 28px rgba(16, 40, 56, .16), 0 1px 3px rgba(16, 40, 56, .10);
    }
    .card { width: 300px; border-radius: 12px; overflow: hidden; }

    header { display: flex; align-items: center; justify-content: space-between; padding: 10px 8px 10px 14px; }
    .title { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #2b7a9b; }
    .min {
      width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent;
      color: #6b7c88; cursor: pointer; font-size: 18px; line-height: 1;
    }
    .min:hover { background: #f1f5f8; color: #1c2b36; }

    .body { padding: 2px 14px 14px; }
    .label { margin: 0 0 6px; color: #6b7c88; font-size: 12px; }

    .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; padding: 3px; background: #f1f5f8; border-radius: 9px; }
    .seg button {
      padding: 7px 2px; border: 0; border-radius: 7px; background: transparent;
      color: #4a5b68; font-size: 12px; cursor: pointer; white-space: nowrap;
    }
    .seg button:hover:not([aria-checked="true"]) { color: #1c2b36; }
    .seg button[aria-checked="true"] { background: #fff; color: #17566f; font-weight: 600; box-shadow: 0 1px 2px rgba(16, 40, 56, .16); }
    .seg.locked button { cursor: default; opacity: .6; }

    .status { min-height: 38px; margin: 12px 0 0; color: #1c2b36; }
    .status.muted { color: #6b7c88; }
    .bar { height: 4px; margin: 8px 0 0; background: #e6edf1; border-radius: 2px; overflow: hidden; }
    .bar i { display: block; height: 100%; width: 0; background: #2b7a9b; transition: width .25s ease; }

    .go {
      width: 100%; margin-top: 12px; padding: 9px 10px; border: 1px solid transparent; border-radius: 8px;
      background: #2b7a9b; color: #fff; font-weight: 600; cursor: pointer;
    }
    .go:hover:not(:disabled) { background: #236784; }
    .go:disabled { background: #e1e8ed; color: #8a9aa5; cursor: default; }
    .go.stop { background: #fff; color: #b4372c; border-color: #e3b5b0; }
    .go.stop:hover { background: #fdf3f2 !important; }

    footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 14px; border-top: 1px solid #eef2f5; color: #6b7c88; font-size: 12px;
    }
    footer select { border: 0; background: transparent; color: #2b7a9b; font-weight: 600; cursor: pointer; padding: 2px 0; }
    footer select:disabled { color: #8a9aa5; cursor: default; }

    .pill {
      display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; cursor: pointer; font-weight: 600;
    }
    .pill:hover { background: #f7fafb; }
    .badge { min-width: 20px; padding: 0 6px; border-radius: 999px; background: #2b7a9b; color: #fff; font-size: 12px; text-align: center; }

    @media (prefers-reduced-motion: reduce) { .bar i { transition: none; } }
  `;

  function createPanel() {
    host = document.createElement('div');
    host.id = 'iss-optante-assistente';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${CSS}</style>
      <section class="card" id="card" aria-label="Assistente de Optante">
        <header>
          <span class="title"><span class="dot"></span>Assistente de Optante</span>
          <button class="min" id="min" type="button" title="Minimizar" aria-label="Minimizar">&minus;</button>
        </header>
        <div class="body">
          <p class="label" id="lbl">Marcar linhas pendentes como</p>
          <div class="seg" id="seg" role="radiogroup" aria-labelledby="lbl">
            ${OPTIONS.map(o => `<button type="button" role="radio" data-id="${o.id}">${o.label}</button>`).join('')}
          </div>
          <p class="status" id="st" role="status" aria-live="polite"></p>
          <div class="bar" id="bar" hidden><i id="fill"></i></div>
          <button class="go" id="go" type="button"></button>
        </div>
        <footer>
          <label for="spd">Velocidade</label>
          <select id="spd">${SPEEDS.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}</select>
        </footer>
      </section>
      <button class="pill" id="pill" type="button" hidden aria-label="Abrir Assistente de Optante">
        <span class="dot"></span><span id="pilltxt">Optante</span><span class="badge" id="badge" hidden></span>
      </button>`;
    document.body.appendChild(host);

    const $ = id => root.getElementById(id);
    ui = {
      card: $('card'), pill: $('pill'), pilltxt: $('pilltxt'), badge: $('badge'), min: $('min'),
      seg: $('seg'), st: $('st'), bar: $('bar'), fill: $('fill'), go: $('go'), spd: $('spd'),
      radios: Array.from(root.querySelectorAll('[role="radio"]'))
    };

    ui.spd.value = prefs.speed;
    ui.spd.addEventListener('change', () => { prefs.speed = ui.spd.value; savePrefs(); });

    ui.radios.forEach(btn => btn.addEventListener('click', () => selectOption(btn.dataset.id)));
    ui.seg.addEventListener('keydown', e => {
      if (active) return;
      const i = OPTIONS.findIndex(o => o.id === prefs.option);
      let n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % OPTIONS.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + OPTIONS.length - 1) % OPTIONS.length;
      if (n == null) return;
      e.preventDefault();
      selectOption(OPTIONS[n].id);
      ui.radios[n].focus();
    });

    ui.min.addEventListener('click', () => setCollapsed(true));
    ui.pill.addEventListener('click', () => setCollapsed(false));
    ui.go.addEventListener('click', () => {
      if (active) { stopFlag = true; render(); return; }
      start(prefs.option);
    });

    render();
  }

  function selectOption(id) {
    if (active || prefs.option === id) return;
    prefs.option = id; savePrefs();
    resultMsg = '';
    render();
  }

  function setCollapsed(v) {
    prefs.collapsed = v; savePrefs();
    render();
  }

  const currentOption = () => OPTIONS.find(o => o.id === prefs.option);

  // Atualiza o painel conforme o estado atual
  function render() {
    if (!host) return;
    const pend = countPending();
    const total = getTargets().length;

    // Seletor
    ui.radios.forEach(b => {
      const on = b.dataset.id === prefs.option;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      b.disabled = active && !on;
    });
    ui.seg.classList.toggle('locked', active);
    ui.spd.disabled = active;

    // Mensagem, progresso e botão
    let msg, muted = false;
    if (active && progress) {
      msg = stopFlag ? 'Parando…' : `Marcando linha ${progress.current} de ${progress.total}…`;
      ui.bar.hidden = false;
      ui.fill.style.width = `${Math.round((progress.done / progress.total) * 100)}%`;
    } else {
      ui.bar.hidden = true;
      if (resultMsg && pend === resultPending) msg = resultMsg;
      else {
        resultMsg = '';
        if (pend > 0) msg = `${plural(pend, 'linha pendente', 'linhas pendentes')} de ${total}.`;
        else { msg = `Nenhuma linha pendente. Todas as ${total} já estão preenchidas.`; muted = true; }
      }
    }
    ui.st.textContent = msg;
    ui.st.classList.toggle('muted', muted);

    if (active) {
      ui.go.textContent = stopFlag ? 'Parando…' : 'Parar';
      ui.go.disabled = stopFlag;
      ui.go.classList.add('stop');
    } else {
      ui.go.classList.remove('stop');
      ui.go.disabled = pend === 0;
      ui.go.textContent = pend === 0 ? 'Nada a aplicar'
        : `Aplicar “${currentOption().label}” a ${plural(pend, 'linha', 'linhas')}`;
    }

    // Minimizado
    ui.card.hidden = prefs.collapsed;
    ui.pill.hidden = !prefs.collapsed;
    if (active && progress) {
      ui.pilltxt.textContent = `${progress.current}/${progress.total}`;
      ui.badge.hidden = true;
    } else {
      ui.pilltxt.textContent = 'Optante';
      ui.badge.hidden = pend === 0;
      ui.badge.textContent = String(pend);
    }
  }

  // ---------- Processamento ----------
  function start(optionId) {
    clearFlags();
    resultMsg = '';
    job = { running: true, option: optionId, ts: Date.now(), attempts: {}, initial: countPending() };
    saveJob();
    run();
  }

  async function run() {
    if (active || !job) return;
    const option = OPTIONS.find(o => o.id === job.option) || currentOption();
    active = true; stopFlag = false;
    progress = { total: Math.max(job.initial, 1), done: 0, current: 1 };
    render();

    while (!stopFlag) {
      const targets = getTargets();
      const idx = targets.findIndex((s, i) => isPending(s) && (job.attempts[i] || 0) < MAX_TRY);
      if (idx < 0) break;
      job.attempts[idx] = (job.attempts[idx] || 0) + 1;
      job.ts = Date.now();
      saveJob();

      const left = countPending();
      const done = Math.max(0, job.initial - left);
      progress = { total: Math.max(job.initial, done + 1), done, current: done + 1 };
      render();

      const sel = targets[idx];
      try { sel.scrollIntoView({ block: 'nearest' }); } catch (e) {}
      choose(sel, option);
      await waitIdle(SPEEDS.find(s => s.id === prefs.speed).ms);
    }

    // Conclusão
    const wasStopped = stopFlag;
    const leftRows = getTargets().filter(isPending);
    const updated = Math.max(0, job.initial - leftRows.length);
    job = null; saveJob();
    active = false; stopFlag = false; progress = null;

    if (wasStopped) {
      resultMsg = `Interrompido. ${plural(updated, 'linha atualizada', 'linhas atualizadas')}.`;
    } else if (leftRows.length === 0) {
      resultMsg = `Concluído. ${plural(updated, 'linha atualizada', 'linhas atualizadas')}.`;
    } else {
      leftRows.forEach(flag);
      try { leftRows[0].scrollIntoView({ block: 'center' }); } catch (e) {}
      resultMsg = `${plural(updated, 'linha atualizada', 'linhas atualizadas')}. ` +
        `${plural(leftRows.length, 'não aceitou', 'não aceitaram')} a alteração e ` +
        `${leftRows.length === 1 ? 'foi destacada' : 'foram destacadas'} em vermelho. Preencha manualmente.`;
    }
    resultPending = leftRows.length;
    render();
  }

  // ---------- Vigia: mostra o painel só onde existe a grade ----------
  function tick() {
    const n = getTargets().length;
    if (n > 0 && !host) {
      createPanel();
      // Retoma se a página recarregou no meio do processo (apenas se for recente)
      if (job && job.running && Date.now() - job.ts < RESUME_WINDOW) run();
      else if (job) { job = null; saveJob(); }
    } else if (n === 0 && host && !active) {
      host.remove(); host = null; root = null; ui = {};
    } else if (host && !active) {
      render();
    }
  }
  tick();
  setInterval(tick, 1000);
})();
