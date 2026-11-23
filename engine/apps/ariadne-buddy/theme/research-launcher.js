const SESSION_PARAM = 'researchSession';
const TASK_ID = /^research_[a-f0-9]{24}$/;
const AFPK_WORKFLOW = 'afpk-ks';
const CREDENTIAL_KEY = 'kimi-web.server-credential';
const API = '/api/v1/ariadne/research';
const OBSERVER_DELAY = 120;
const FLASH_INTERVAL = 900;

const strings = {
  zh: {
    create: 'AFPK 筛选', back: '关闭任务会话', frame: '任务会话', archive: '已归档任务',
    open: '进行中', running: '计算中', waiting: '等待处理', ready: '待交接', cancelled: '已取消',
    stage_review: '待假说审核', nomination_review: '待候选审核', afpk_nomination_review: '待候选审核',
    iteration_decision: '待迭代决策', scientific_review: '待科学复核', environment_readiness: '待配置运行环境',
    afpkGroup: 'AFPK 筛选任务', afpkArchive: '已归档 AFPK 筛选', afpkNew: '新建 AFPK 筛选',
    attention: '待决策', titleBadge: '● {n} 项待决策', retry: '重试',
    authFailed: '登录状态已失效，请重新打开 AriadneBuddy。',
    serverFailed: '服务器无法返回任务列表。', networkFailed: '无法连接 AriadneBuddy。',
  },
  en: {
    create: 'AFPK screening', back: 'Close task session', frame: 'Task session', archive: 'Archived tasks',
    open: 'Open', running: 'Running', waiting: 'Waiting', ready: 'Handoff ready', cancelled: 'Cancelled',
    stage_review: 'Hypothesis review pending', nomination_review: 'Shortlist review pending',
    afpk_nomination_review: 'Shortlist review pending', iteration_decision: 'Iteration decision pending',
    scientific_review: 'Scientific review pending', environment_readiness: 'Runtime setup pending',
    afpkGroup: 'AFPK screening tasks', afpkArchive: 'Archived AFPK screening', afpkNew: 'New AFPK screening',
    attention: 'Awaiting decision', titleBadge: '● {n} awaiting decision', retry: 'Retry',
    authFailed: 'Your session expired. Reopen AriadneBuddy.',
    serverFailed: 'The server could not return the task list.', networkFailed: 'Could not reach AriadneBuddy.',
  },
};

// A refusal reads as a refusal: 401 is an expired credential, a non-ok
// response is the server, and a thrown fetch is the network.
const FAILURE_COPY = { auth: 'authFailed', server: 'serverFailed', network: 'networkFailed' };

function element(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function preference() {
  try {
    const locale = localStorage.getItem('kimi-locale');
    if (locale === 'zh' || locale === 'en') return locale;
  } catch { /* Use the browser language. */ }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function credential() {
  try {
    const stored = JSON.parse(localStorage.getItem(CREDENTIAL_KEY));
    if (stored?.version === 1 && typeof stored.credential === 'string' && stored.expiresAt > Date.now()) {
      return stored.credential;
    }
  } catch { /* Wait for the normal launcher credential. */ }
  return null;
}

function validSelection(value) {
  return value === 'new' || TASK_ID.test(value ?? '') ? value : null;
}

function selectedFrom(url) {
  return validSelection(url.searchParams.get(SESSION_PARAM));
}

function sessionUrl(value) {
  const url = new URL(location.href);
  url.hash = '';
  if (value === null) url.searchParams.delete(SESSION_PARAM);
  else url.searchParams.set(SESSION_PARAM, value);
  return url.href;
}

const columns = element('div', 'ariadne-hero-columns');
columns.setAttribute('aria-hidden', 'true');
columns.append(element('span', 'workspace-column'), element('span', 'workspace-column'));

const rows = element('div', 'ariadne-session-list');
const listHead = element('div', 'ariadne-session-head');
const newTask = element('button', 'ariadne-session-new');
newTask.type = 'button';
newTask.dataset.copy = 'afpkNew';
const failureRow = element('div', 'ariadne-session-failure');
failureRow.hidden = true;
const failureText = element('span', 'ariadne-session-failure-text');
const retry = element('button', 'ariadne-session-retry');
retry.type = 'button';
retry.dataset.copy = 'retry';
failureRow.append(failureText, retry);
listHead.append(newTask);

const current = element('ul', 'ariadne-session-rows');
const archive = element('details', 'ariadne-session-archive');
const archiveTitle = document.createElement('summary');
const archived = element('ul', 'ariadne-session-rows');
archive.append(archiveTitle, archived);

const afpk = element('details', 'ariadne-session-archive ariadne-session-afpk');
const afpkTitle = document.createElement('summary');
const afpkCurrent = element('ul', 'ariadne-session-rows');
const afpkArchive = element('details', 'ariadne-session-archive ariadne-session-afpk-archive');
const afpkArchiveTitle = document.createElement('summary');
const afpkPast = element('ul', 'ariadne-session-rows');
afpkArchive.append(afpkArchiveTitle, afpkPast);
afpk.append(afpkTitle, afpkCurrent, afpkArchive);

rows.append(listHead, failureRow, current, archive, afpk);

const pane = element('section', 'ariadne-session-pane');
const toolbar = element('div', 'ariadne-session-toolbar');
const tab = element('div', 'ariadne-session-tab');
const tabTitle = element('span', 'ariadne-session-tab-title');
const back = element('button', 'ariadne-session-back');
back.type = 'button';
back.textContent = '×';
const frame = element('iframe', 'ariadne-session-frame');
frame.referrerPolicy = 'no-referrer';
tab.append(tabTitle, back);
toolbar.append(tab);
pane.append(toolbar, frame);

let selected = selectedFrom(new URL(location.href));
let loaded;
let sessions = [];
let lastSnapshot;
let copy = strings[preference()];
let loading = false;
let observedCredential;
let failure;

// A gate is any reason the desk already has a label for: the copy map is
// the authority on what counts as waiting on a human.
function awaitingDecision(task) {
  const reason = task?.waitingReason;
  return typeof reason === 'string' && Object.hasOwn(copy, reason);
}

function row(task) {
  const item = document.createElement('li');
  const link = element('a', 'ariadne-session-row');
  link.dataset.researchTask = task.id;
  link.href = sessionUrl(task.id);
  const title = element('span', 'ariadne-session-title');
  title.textContent = task.objective;
  link.title = task.objective;
  link.append(title);
  if (task.status !== 'cancelled') {
    if (awaitingDecision(task)) {
      const attention = element('span', 'ariadne-session-attention');
      attention.dataset.copy = 'attention';
      attention.textContent = copy.attention;
      link.append(attention);
    }
    const status = element('span', 'ariadne-session-status');
    status.textContent = copy[task.waitingReason] ?? copy[task.status] ?? task.status;
    link.append(status);
  }
  item.append(link);
  return item;
}

function markCurrent() {
  for (const link of rows.querySelectorAll('.ariadne-session-row')) {
    if (link.dataset.researchTask === selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const task = sessions.find((entry) => entry.id === selected);
  if (task?.status === 'cancelled') {
    (task.workflow === AFPK_WORKFLOW ? afpkArchive : archive).open = true;
  }
  const title = task?.objective || (selected === 'new' ? copy.create : copy.frame);
  tabTitle.textContent = title;
  tabTitle.title = title;
}

let flashTimer;
let flashVisible;
let baseTitle = document.title;

function pendingDecisions() {
  return sessions.filter((task) => task.status !== 'cancelled' && awaitingDecision(task)).length;
}

function stopTitleFlash() {
  if (flashTimer) {
    clearInterval(flashTimer);
    flashTimer = undefined;
  }
  if (flashVisible) {
    document.title = baseTitle;
    flashVisible = false;
  }
}

function flashTitle() {
  const pending = pendingDecisions();
  if (!pending) {
    stopTitleFlash();
    return;
  }
  const badge = copy.titleBadge.replace('{n}', String(pending));
  if (!flashTimer) {
    baseTitle = document.title;
    flashTimer = setInterval(() => {
      flashVisible = !flashVisible;
      document.title = flashVisible ? badge : baseTitle;
    }, FLASH_INTERVAL);
  }
  flashVisible = true;
  document.title = badge;
}

function renderFailure() {
  if (!failure) {
    failureRow.hidden = true;
    return;
  }
  failureText.textContent = copy[FAILURE_COPY[failure]];
  failureRow.hidden = false;
}

// The desk's entry point stays reachable even before the first task exists;
// with no credential at all the research surfaces are simply not offered.
// mount() runs on every observer tick, so only write when the value moves —
// an unconditional write would keep the subtree observer fed forever.
function updateVisibility() {
  const hidden = !sessions.length && !failure && !credential();
  if (rows.hidden !== hidden) rows.hidden = hidden;
}

function renderRows() {
  const visible = sessions.filter((task) => task.workflow !== AFPK_WORKFLOW);
  const screening = sessions.filter((task) => task.workflow === AFPK_WORKFLOW);
  const active = visible.filter((task) => task.status !== 'cancelled');
  const past = visible.filter((task) => task.status === 'cancelled');
  const screeningActive = screening.filter((task) => task.status !== 'cancelled');
  const screeningPast = screening.filter((task) => task.status === 'cancelled');
  current.replaceChildren(...active.map(row));
  archived.replaceChildren(...past.map(row));
  afpkCurrent.replaceChildren(...screeningActive.map(row));
  afpkPast.replaceChildren(...screeningPast.map(row));
  current.hidden = !active.length;
  archive.hidden = !past.length;
  afpk.hidden = !screening.length;
  afpkArchive.hidden = !screeningPast.length;
  updateVisibility();
  renderFailure();
  markCurrent();
  flashTitle();
}

function applyLabels() {
  back.setAttribute('aria-label', copy.back);
  back.title = copy.back;
  frame.title = copy.frame;
  archiveTitle.textContent = copy.archive;
  afpkTitle.textContent = copy.afpkGroup;
  afpkArchiveTitle.textContent = copy.afpkArchive;
  newTask.textContent = copy.afpkNew;
  newTask.setAttribute('aria-label', copy.afpkNew);
  newTask.title = copy.afpkNew;
  retry.textContent = copy.retry;
}

function updateLabels() {
  const next = strings[preference()];
  if (next === copy) return;
  copy = next;
  applyLabels();
  renderRows();
}

function fail(kind) {
  if (failure === kind) return;
  failure = kind;
  renderRows();
}

async function refreshSessions() {
  const token = credential();
  if (loading || !token || document.hidden) return;
  loading = true;
  try {
    const response = await fetch(API, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      fail(response.status === 401 ? 'auth' : 'server');
      return;
    }
    if (credential() !== token) return;
    const { tasks } = await response.json();
    if (!Array.isArray(tasks)) {
      fail('server');
      return;
    }
    const snapshot = JSON.stringify(tasks);
    if (snapshot === lastSnapshot) {
      if (failure) {
        failure = undefined;
        renderRows();
      }
      return;
    }
    lastSnapshot = snapshot;
    sessions = tasks.filter((task) => TASK_ID.test(task?.id ?? '') && typeof task.objective === 'string');
    failure = undefined;
    renderRows();
  } catch { fail('network'); }
  finally { loading = false; }
}

function paintSelection() {
  const host = document.querySelector('.app > .con:not(.session-admin)');
  if (!selected || !host) {
    pane.remove();
    return;
  }

  if (loaded !== selected) {
    frame.src = selected === 'new'
      ? '/research/session?new=1'
      : `/research/session?task=${encodeURIComponent(selected)}`;
    loaded = selected;
  }
  if (pane.parentElement !== host) host.append(pane);
}

function select(value, { reuseFrame = false } = {}) {
  if (selected !== value && !value) {
    pane.remove();
    frame.removeAttribute('src');
    loaded = undefined;
  }
  if (reuseFrame) loaded = value;
  selected = value;
  history.replaceState(history.state, '', sessionUrl(value));
  markCurrent();
  paintSelection();
}

function openSession(value) {
  select(value);
  document.querySelector('.app.mobile .sheet-root .sheet-grab')?.click();
  back.focus({ preventScroll: true });
}

function mount() {
  updateLabels();
  const list = document.querySelector('.side .sessions, .app.mobile .sheet-body > .mlist');
  if (list && rows.parentElement !== list) list.prepend(rows);
  const hero = document.querySelector('.con .empty-hint .wordmark');
  if (hero && hero.previousElementSibling !== columns) hero.before(columns);
  updateVisibility();
  const token = credential();
  if (token !== observedCredential) {
    observedCredential = token;
    void refreshSessions();
  }
  paintSelection();
}

function closeSession() {
  const previous = selected;
  select(null);
  const rowLink = [...rows.querySelectorAll('.ariadne-session-row')]
    .find((item) => item.dataset.researchTask === previous);
  const destination = rowLink?.isConnected
    ? rowLink
    : document.querySelector('.side .btn-new-chat, .app.mobile .tb-main');
  destination?.focus({ preventScroll: true });
}

back.addEventListener('click', closeSession);

newTask.addEventListener('click', () => select('new'));

retry.addEventListener('click', () => {
  failure = undefined;
  renderRows();
  void refreshSessions();
});

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (selected && target.closest('.side :is(.btn-new-chat, .sessions .se, .ws-dir), .sheet-body .actions .newrow:first-child, .sheet-body .mlist .srow')) {
    select(null);
    return;
  }
  const link = target.closest('a[href]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  const value = url.pathname === '/research' ? validSelection(url.searchParams.get('task')) : selectedFrom(url);
  if (!value) return;
  event.preventDefault();
  openSession(value);
}, { capture: true });

window.addEventListener('message', (event) => {
  if (!pane.isConnected || event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'ariadne:close-session' && selected === 'new') {
    closeSession();
  } else if (event.data?.type === 'ariadne:session' && TASK_ID.test(event.data.taskId ?? '')) {
    if (selected === 'new') select(event.data.taskId, { reuseFrame: true });
    void refreshSessions();
  }
});

window.addEventListener('popstate', () => select(selectedFrom(new URL(location.href))));
window.addEventListener('storage', (event) => {
  if (event.key === 'kimi-locale' || event.key === null) updateLabels();
  if (event.key === CREDENTIAL_KEY || event.key === null) void refreshSessions();
});
document.addEventListener('visibilitychange', refreshSessions);

// The desk is waiting on a human: say so in the tab, and stop saying it the
// moment the window regains attention.
window.addEventListener('focus', () => {
  stopTitleFlash();
  void refreshSessions();
});

// A streaming composer rewrites the transcript on every chunk, so the
// subtree observer coalesces its work into one rAF plus a short delay and
// stands down entirely while a turn is in flight.
function composerStreaming() {
  return Boolean(document.querySelector('.chat-dock .composer-card :is(.stop, .send.is-starting)'));
}

let pendingFrame;
let pendingTimer;

function runScheduled() {
  pendingFrame = undefined;
  pendingTimer = undefined;
  mount();
}

function scheduleMount() {
  if (pendingFrame || pendingTimer) return;
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = undefined;
    pendingTimer = setTimeout(() => {
      pendingTimer = undefined;
      if (composerStreaming()) scheduleMount();
      else runScheduled();
    }, OBSERVER_DELAY);
  });
}

applyLabels();

const root = document.getElementById('app');
if (root) {
  new MutationObserver(scheduleMount).observe(root, { childList: true, subtree: true });
  mount();
  void refreshSessions();
  setInterval(refreshSessions, 12_000);
}
