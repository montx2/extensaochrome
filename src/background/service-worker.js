/**
 * Service worker (MV3): cérebro da extensão.
 * Mantém o estado do processamento fora da aba, para que ele continue mesmo
 * com o usuário em outra página, em outra janela ou com o navegador minimizado.
 *
 * Nada aqui faz requisição de rede: nenhum dado da declaração sai do navegador.
 */
'use strict';

importScripts('/shared/protocol.js');

var P = self.ISSProtocol;
var M = P.MSG;
var L = P.LIMITS;
var S = P.STATUS;

var PREFS_KEY = 'prefs';
var JOBS_KEY = 'jobs';
var ALARM_WATCHDOG = 'optante-watchdog';
var NOTIFICATION_ID = 'optante-facil';

// ---------- Estado em memória ----------
var prefs = P.sanitizePrefs(P.DEFAULTS);
var records = Object.create(null);           // tabId -> registro da aba
var connections = Object.create(null);       // "tabId:frameId" -> porta
var jobFrames = Object.create(null);         // tabId -> frameId que controla o job
var popupPorts = [];
var notifyGranted = false;

// ---------- Utilidades ----------
function now() { return Date.now(); }

function newRecord(tabId, info) {
  return {
    tabId: tabId,
    windowId: info && info.windowId,
    frameId: (info && typeof info.frameId === 'number') ? info.frameId : 0,
    url: (info && info.url) || '',
    status: S.IDLE,
    running: false,
    pending: 0,
    total: 0,
    progress: null,
    result: null,
    job: null,
    keepAwake: false,
    keepAwakeBlocked: false,
    visible: true,
    updatedAt: now(),
    connectedAt: now()
  };
}

function getRecord(tabId, info) {
  if (!records[tabId]) records[tabId] = newRecord(tabId, info);
  return records[tabId];
}

function portKey(tabId, frameId) { return tabId + ':' + frameId; }

function controlPort(tabId) {
  var frameId = jobFrames[tabId];
  var key = portKey(tabId, frameId);
  return connections[key] || connections[portKey(tabId, 0)] || null;
}

function send(port, cmd, payload) {
  if (!port) return false;
  try {
    port.postMessage({ cmd: cmd, payload: payload || {} });
    return true;
  } catch (e) {
    return false;
  }
}

// ---------- Preferências ----------
function loadPrefs() {
  return chrome.storage.local.get(PREFS_KEY).then(function (stored) {
    prefs = P.sanitizePrefs(stored && stored[PREFS_KEY]);
    return prefs;
  }).catch(function () { prefs = P.sanitizePrefs(P.DEFAULTS); return prefs; });
}

function savePrefs(patch) {
  prefs = P.sanitizePrefs(Object.assign({}, prefs, patch || {}));
  return chrome.storage.local.set((function () { var o = {}; o[PREFS_KEY] = prefs; return o; })());
}

function pushPrefsToTabs() {
  Object.keys(connections).forEach(function (key) {
    send(connections[key], 'prefs', { prefs: prefs });
  });
}

// ---------- Persistência dos jobs (sobrevive ao service worker) ----------
function persistJobs() {
  var jobs = {};
  Object.keys(records).forEach(function (tabId) {
    var rec = records[tabId];
    if (rec.job) jobs[tabId] = rec.job;
  });
  return chrome.storage.session.set({ jobs: jobs }).catch(function () { /* ignora */ });
}

function restoreJobs() {
  return chrome.storage.session.get('jobs').then(function (stored) {
    var jobs = (stored && stored.jobs) || {};
    Object.keys(jobs).forEach(function (tabId) {
      var job = jobs[tabId];
      if (!job || typeof job !== 'object') return;
      if (now() - P.clampInt(job.ts, 0, Number.MAX_SAFE_INTEGER, 0) > L.RESUME_WINDOW_MS) return;
      var rec = getRecord(tabId, {});
      rec.job = job;
      rec.status = S.STALLED;
      rec.running = true;
      rec.updatedAt = now();
      if (job.frameId != null) jobFrames[tabId] = job.frameId;
    });
  }).catch(function () { /* ignora */ });
}

// ---------- Badge e notificações ----------
function updateBadge(tabId) {
  var rec = records[tabId];
  if (!rec || !chrome.action) return;
  var text = '';
  var color = '#2b7a9b';
  if (rec.status === S.STALLED) { text = '!'; color = '#c0392b'; }
  else if (rec.running && rec.progress) {
    var left = Math.max(0, (rec.progress.total || 0) - (rec.progress.done || 0));
    text = left > 99 ? '99+' : String(left);
  } else if (!rec.running && rec.pending > 0 && rec.total > 0) {
    text = rec.pending > 99 ? '99+' : String(rec.pending);
  }
  try {
    chrome.action.setBadgeText({ tabId: tabId, text: text });
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: color });
  } catch (e) { /* ignora */ }
}

function refreshPermissions() {
  if (!chrome.permissions || !chrome.permissions.contains) return Promise.resolve(false);
  return chrome.permissions.contains({ permissions: ['notifications'] })
    .then(function (granted) { notifyGranted = !!granted; return notifyGranted; })
    .catch(function () { notifyGranted = false; return false; });
}

function notify(title, message, tabId) {
  if (!prefs.notify || !notifyGranted || !chrome.notifications) return;
  try {
    chrome.notifications.create(NOTIFICATION_ID, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title,
      message: message,
      priority: 0
    });
  } catch (e) { /* ignora */ }
}

// ---------- Snapshot para o popup ----------
function snapshot() {
  var candidates = Object.keys(records).map(function (id) { return records[id]; });
  var active = candidates.filter(function (r) { return r.running; })[0]
    || candidates.filter(function (r) { return r.total > 0; })
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; })[0]
    || candidates.sort(function (a, b) { return b.connectedAt - a.connectedAt; })[0]
    || null;

  return {
    prefs: prefs,
    notifyGranted: notifyGranted,
    version: chrome.runtime.getManifest().version,
    tab: active ? {
      tabId: active.tabId,
      windowId: active.windowId,
      url: active.url,
      status: active.status,
      running: active.running,
      pending: active.pending,
      total: active.total,
      progress: active.progress,
      result: active.result,
      keepAwake: active.keepAwake,
      keepAwakeBlocked: active.keepAwakeBlocked,
      visible: active.visible,
      updatedAt: active.updatedAt
    } : null
  };
}

function pushToPopups() {
  var data = snapshot();
  popupPorts = popupPorts.filter(function (port) {
    try { port.postMessage({ cmd: 'state', payload: data }); return true; }
    catch (e) { return false; }
  });
}

// ---------- Comandos ----------
function startJob(tabId) {
  var rec = records[tabId];
  var port = controlPort(tabId);
  if (!rec || !port) return false;
  if (rec.running) return true;
  if (!rec.pending || rec.pending <= 0) {
    send(port, 'refresh', {}); // contagem desatualizada: pede e o popup se atualiza
    return false;
  }

  rec.job = {
    option: prefs.option,
    speed: prefs.speed,
    initial: rec.pending,
    attempts: {},
    frameId: rec.frameId,
    ts: now()
  };
  rec.status = S.RUNNING;
  rec.running = true;
  rec.result = null;
  rec.progress = { done: 0, total: rec.pending, current: 1 };
  rec.updatedAt = now();

  jobFrames[tabId] = rec.frameId;
  persistJobs();
  updateBadge(tabId);
  send(port, 'start', { optionId: prefs.option, speedId: prefs.speed, initial: rec.pending });
  pushToPopups();
  return true;
}

function stopJob(tabId) {
  var rec = records[tabId];
  if (!rec || !rec.running) return false;
  rec.status = S.STOPPING;
  rec.updatedAt = now();
  send(controlPort(tabId), 'stop', {});
  updateBadge(tabId);
  pushToPopups();
  return true;
}

function finishJob(tabId, payload) {
  var rec = records[tabId];
  if (!rec) return;
  rec.running = false;
  rec.job = null;
  rec.progress = null;
  var status = (payload && typeof payload.status === 'string') ? payload.status : S.DONE;
  if (status !== S.DONE && status !== S.STOPPED && status !== S.FAILED) status = S.DONE;
  rec.status = status;
  rec.result = {
    status: rec.status,
    updated: P.clampInt(payload && payload.updated, 0, L.MAX_ROWS, 0),
    failed: P.clampInt(payload && payload.failed, 0, L.MAX_ROWS, 0),
    ts: now()
  };
  if (payload && typeof payload.pending === 'number') rec.pending = P.clampInt(payload.pending, 0, L.MAX_ROWS, 0);
  rec.updatedAt = now();

  persistJobs();
  updateBadge(tabId);

  var updated = rec.result.updated;
  if (rec.status === S.DONE) {
    notify('Optante Fácil', 'Concluído: ' + P.plural(updated, 'linha atualizada', 'linhas atualizadas') + '.', tabId);
  } else if (rec.status === S.STOPPED) {
    notify('Optante Fácil', 'Interrompido: ' + P.plural(updated, 'linha atualizada', 'linhas atualizadas') + '.', tabId);
  } else if (rec.status === S.FAILED) {
    notify('Optante Fácil', P.plural(rec.result.failed, 'linha não aceitou', 'linhas não aceitaram') + ' a alteração.', tabId);
  }
  pushToPopups();
}

function focusTab(tabId, windowId) {
  try {
    if (typeof windowId === 'number' && chrome.windows && chrome.windows.update) {
      chrome.windows.update(windowId, { focused: true });
    }
    if (chrome.tabs && chrome.tabs.update) chrome.tabs.update(tabId, { active: true });
  } catch (e) { /* ignora */ }
}

// ---------- Watchdog ----------
function watchdog() {
  var changed = false;
  Object.keys(records).forEach(function (tabId) {
    var rec = records[tabId];
    if (!rec.running) return;
    var idle = now() - rec.updatedAt;
    if (idle > L.STALE_MS && rec.status !== S.STALLED) {
      rec.status = S.STALLED;
      updateBadge(Number(tabId));
      send(controlPort(Number(tabId)), 'refresh', {});
      notify('Optante Fácil', 'O processamento está lento ou parado. Abra a aba do ISS.net para retomar.', Number(tabId));
      changed = true;
    }
    if (idle > L.STALE_MS * 5) { // 5 minutos sem notícias: encerra o estado
      rec.running = false;
      rec.job = null;
      rec.status = S.STOPPED;
      rec.result = { status: S.STOPPED, updated: 0, failed: 0, ts: now() };
      rec.progress = null;
      updateBadge(Number(tabId));
      changed = true;
    }
  });
  if (changed) { persistJobs(); pushToPopups(); }
}

// ---------- Portas ----------
chrome.runtime.onConnect.addListener(function (port) {
  if (port.name === 'popup') {
    popupPorts.push(port);
    try { port.postMessage({ cmd: 'state', payload: snapshot() }); } catch (e) { /* ignora */ }
    port.onDisconnect.addListener(function () {
      popupPorts = popupPorts.filter(function (p) { return p !== port; });
    });
    return;
  }

  if (port.name !== 'optante-facil') { try { port.disconnect(); } catch (e) { /* ignora */ } return; }

  var sender = port.sender || {};
  var tabId = sender.tab && typeof sender.tab.id === 'number' ? sender.tab.id : null;
  if (tabId === null) { try { port.disconnect(); } catch (e) { /* ignora */ } return; }

  var frameId = typeof sender.frameId === 'number' ? sender.frameId : 0;
  var rec = getRecord(tabId, { windowId: sender.tab.windowId, frameId: frameId, url: sender.tab.url });
  connections[portKey(tabId, frameId)] = port;
  rec.updatedAt = now();
  rec.connectedAt = now();

  port.onMessage.addListener(function (message) {
    handleTabMessage(tabId, frameId, message);
  });

  port.onDisconnect.addListener(function () {
    delete connections[portKey(tabId, frameId)];
    var stillConnected = Object.keys(connections).some(function (key) { return key.indexOf(tabId + ':') === 0; });
    if (!stillConnected) {
      // Aba fechada ou recarregada: mantém o job por alguns minutos para retomada.
      rec.updatedAt = now();
      if (!rec.running) delete records[tabId];
    }
  });

  send(port, 'refresh', {});
});

function handleTabMessage(tabId, frameId, message) {
  if (!message || typeof message !== 'object') return;
  var type = message.type;
  var payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
  var rec = getRecord(tabId, {});

  switch (type) {
    case M.HELLO:
      rec.frameId = frameId;
      rec.url = typeof payload.url === 'string' ? payload.url.slice(0, 512) : rec.url;
      rec.updatedAt = now();
      send(connections[portKey(tabId, frameId)], 'init', { prefs: prefs });
      pushToPopups();
      break;

    case M.STATE:
      rec.pending = P.clampInt(payload.pending, 0, L.MAX_ROWS, rec.pending);
      rec.total = P.clampInt(payload.total, 0, L.MAX_ROWS, rec.total);
      rec.keepAwake = payload.keepAwake === true;
      rec.keepAwakeBlocked = payload.keepAwakeBlocked === true;
      if (typeof payload.visible === 'boolean') rec.visible = payload.visible;
      if (payload.result && typeof payload.result === 'object' && !rec.running) rec.result = payload.result;
      if (payload.prefs) { prefs = P.sanitizePrefs(payload.prefs); savePrefs(prefs); }
      if (payload.request === 'start') { startJob(tabId); break; }
      rec.updatedAt = now();
      if (rec.running && rec.status === S.STALLED) { rec.status = S.RUNNING; }
      if (rec.total > 0) { rec.frameId = frameId; jobFrames[tabId] = frameId; }
      updateBadge(tabId);
      pushToPopups();
      break;

    case M.PROGRESS:
      rec.running = payload.running !== false;
      rec.progress = {
        done: P.clampInt(payload.done, 0, L.MAX_ROWS, 0),
        total: P.clampInt(payload.total, 0, L.MAX_ROWS, 1),
        current: P.clampInt(payload.current, 0, L.MAX_ROWS, 1)
      };
      if (typeof payload.left === 'number') rec.pending = P.clampInt(payload.left, 0, L.MAX_ROWS, rec.pending);
      rec.keepAwake = payload.keepAwake === true;
      rec.keepAwakeBlocked = payload.keepAwakeBlocked === true;
      if (typeof payload.visible === 'boolean') rec.visible = payload.visible;
      if (rec.status !== S.RUNNING) rec.status = S.RUNNING;
      rec.updatedAt = now();
      if (!rec.job) rec.job = { option: prefs.option, speed: prefs.speed, initial: rec.progress.total, attempts: {}, frameId: frameId, ts: now() };
      else rec.job.ts = now();
      updateBadge(tabId);
      pushToPopups();
      break;

    case M.DONE:
      finishJob(tabId, payload);
      break;

    case M.ORPHAN: {
      var job = rec.job || (payload.job && typeof payload.job === 'object' ? payload.job : null);
      var fresh = job && (now() - P.clampInt(job.ts, 0, Number.MAX_SAFE_INTEGER, 0)) < L.RESUME_WINDOW_MS;
      if (fresh) {
        jobFrames[tabId] = frameId;
        rec.frameId = frameId;
        rec.running = true;
        rec.status = S.RUNNING;
        rec.updatedAt = now();
        send(connections[portKey(tabId, frameId)], 'resume', { job: job });
      } else {
        send(connections[portKey(tabId, frameId)], 'discard', {});
      }
      break;
    }

    case M.ERROR:
      rec.status = S.FAILED;
      rec.running = false;
      rec.job = null;
      rec.updatedAt = now();
      persistJobs();
      updateBadge(tabId);
      pushToPopups();
      break;

    default:
      break; // tipo fora da allowlist: ignorado
  }
}

// ---------- Mensagens do popup ----------
chrome.runtime.onMessage.addListener(function (message, sender, respond) {
  if (!message || typeof message !== 'object') { respond({ ok: false }); return true; }
  var payload = message.payload && typeof message.payload === 'object' ? message.payload : {};

  switch (message.cmd) {
    case 'status':
      respond({ ok: true, state: snapshot() });
      return true;

    case 'start': {
      var tabId = P.clampInt(payload.tabId, 0, Number.MAX_SAFE_INTEGER, 0);
      var target = records[tabId] ? tabId : (snapshot().tab ? snapshot().tab.tabId : 0);
      if (payload.prefs) { savePrefs(payload.prefs); pushPrefsToTabs(); }
      var started = target ? startJob(target) : false;
      respond({ ok: started });
      return true;
    }

    case 'stop': {
      var stopId = P.clampInt(payload.tabId, 0, Number.MAX_SAFE_INTEGER, 0) || (snapshot().tab ? snapshot().tab.tabId : 0);
      var stopped = stopId ? stopJob(stopId) : false;
      respond({ ok: stopped });
      return true;
    }

    case 'prefs':
      savePrefs(payload.prefs).then(function () {
        pushPrefsToTabs();
        pushToPopups();
        respond({ ok: true, prefs: prefs });
      });
      return true;

    case 'focus': {
      var focusId = P.clampInt(payload.tabId, 0, Number.MAX_SAFE_INTEGER, 0);
      if (records[focusId]) focusTab(focusId, records[focusId].windowId);
      respond({ ok: !!records[focusId] });
      return true;
    }

    case 'requestNotifications':
      if (!chrome.permissions || !chrome.permissions.request) { respond({ ok: false }); return true; }
      chrome.permissions.request({ permissions: ['notifications'] }).then(function (granted) {
        notifyGranted = !!granted;
        if (!granted) { prefs.notify = false; savePrefs({ notify: false }); }
        pushToPopups();
        respond({ ok: notifyGranted });
      }).catch(function () { respond({ ok: false }); });
      return true;

    default:
      respond({ ok: false });
      return true;
  }
});

// ---------- Eventos do navegador ----------
chrome.tabs.onRemoved.addListener(function (tabId) {
  delete records[tabId];
  delete jobFrames[tabId];
  Object.keys(connections).forEach(function (key) {
    if (key.indexOf(tabId + ':') === 0) delete connections[key];
  });
  persistJobs();
  pushToPopups();
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
  if (changeInfo && changeInfo.url && records[tabId]) {
    records[tabId].url = String(changeInfo.url).slice(0, 512);
    records[tabId].updatedAt = now();
  }
});

if (chrome.notifications && chrome.notifications.onClicked) {
  chrome.notifications.onClicked.addListener(function (id) {
    if (id !== NOTIFICATION_ID) return;
    var rec = Object.keys(records).map(function (k) { return records[k]; })
      .filter(function (r) { return r.running || (r.result && now() - r.result.ts < 60000); })[0];
    if (rec) focusTab(rec.tabId, rec.windowId);
  });
}

chrome.runtime.onInstalled.addListener(function () {
  try { chrome.storage.session.remove('jobs'); } catch (e) { /* ignora */ }
  ensureAlarm();
  injectIntoOpenTabs();
});

chrome.runtime.onStartup.addListener(function () {
  ensureAlarm();
});

function ensureAlarm() {
  if (!chrome.alarms) return;
  chrome.alarms.clear(ALARM_WATCHDOG, function () {
    chrome.alarms.create(ALARM_WATCHDOG, { periodInMinutes: 1 });
  });
}

if (chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener(function (alarm) {
    if (alarm && alarm.name === ALARM_WATCHDOG) watchdog();
  });
}

/** Garante a injeção nas abas já abertas no momento da instalação/atualização. */
function injectIntoOpenTabs() {
  if (!chrome.scripting || !chrome.tabs) return;
  chrome.tabs.query({ url: P.MATCHES }).then(function (tabs) {
    (tabs || []).forEach(function (tab) {
      if (!tab.id) return;
      var target = { tabId: tab.id, allFrames: true };
      var main = ['shared/protocol.js', 'content/core.js', 'content/executor.js'];
      var isolated = ['shared/protocol.js', 'content/bridge.js'];
      Promise.resolve()
        .then(function () { return chrome.scripting.executeScript({ target: target, files: main, world: 'MAIN' }); })
        .then(function () { return chrome.scripting.executeScript({ target: target, files: isolated, world: 'ISOLATED' }); })
        .catch(function () { /* aba sem permissão ou em carregamento: ignorado */ });
    });
  }).catch(function () { /* ignora */ });
}

// ---------- Inicialização ----------
Promise.resolve()
  .then(loadPrefs)
  .then(restoreJobs)
  .then(refreshPermissions)
  .then(ensureAlarm)
  .catch(function () { /* ignora */ });
