const { app, BrowserWindow, Menu, dialog, ipcMain, shell, nativeTheme, screen, Tray, Notification, clipboard } = require('electron');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

app.setName('ariadne-buddy');

const PRODUCT = 'AriadneBuddy';
const SERVER_START_TIMEOUT_MS = 90_000;
const SERVER_STOP_GRACE_MS = 4_000;
const DESKTOP_SMOKE_TIMEOUT_MS = 120_000;
const MAX_ENGINE_BUFFER_BYTES = 64_000;
const MAX_ENGINE_LOG_BYTES = 2_000_000;
const APP_USER_MODEL_ID = 'com.ariadne.buddy';
const ISSUE_TRACKER_URL = 'https://github.com/zhaorui-bi/AriadneBuddy/issues';
const RESEARCH_POLL_INTERVAL_MS = 15_000;
const ZOOM_FACTOR_MIN = 0.25;
const ZOOM_FACTOR_MAX = 5;
const DESKTOP_SMOKE = process.argv.includes('--smoke-test');
const ANSI_ESCAPE_PATTERN = new RegExp(String.raw`\u001B\[[0-?]*[ -/]*[@-~]`, 'g');
if (DESKTOP_SMOKE) app.disableHardwareAcceleration();
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const expectedServerExits = new WeakSet();

let mainWindow = null;
let serverProc = null;
let serverUrl = null;
let serverGeneration = 0;
let startupTimer = null;
let isQuitting = false;
let quitCleanupStarted = false;
let quitCleanupDone = false;
let currentWorkspace = app.getPath('home');
let serverQueue = Promise.resolve();
let loadingUrl = null;
let desktopColorScheme = 'light';
let brandMarkSvgCache = null;
let appearanceCssCache;
let displayFontCssCache;
let desktopSmokeTimer = null;
let desktopSmokeSettled = false;
let engineLogPath = null;
let aboutWindow = null;
let tray = null;
let researchMonitorTimer = null;
let researchTaskStates = new Map();
let windowStatePersistTimer = null;

function loadSettings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const workspaceDir = typeof parsed.workspaceDir === 'string' && isDirectory(parsed.workspaceDir)
      ? path.resolve(parsed.workspaceDir)
      : undefined;
    return {
      workspaceDir,
      colorScheme: isColorScheme(parsed.colorScheme) ? parsed.colorScheme : undefined,
      bounds: sanitizeWindowBounds(parsed.bounds),
      maximized: parsed.maximized === true,
      zoomFactor: sanitizeZoomFactor(parsed.zoomFactor),
    };
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn('[ariadne] could not read settings:', error.message);
    }
    return {};
  }
}

function isColorScheme(scheme) {
  return scheme === 'light' || scheme === 'dark' || scheme === 'system';
}

function positiveInteger(value) {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value);
}

function sanitizeWindowBounds(bounds) {
  if (typeof bounds !== 'object' || bounds === null) return undefined;
  const width = positiveInteger(bounds.width);
  const height = positiveInteger(bounds.height);
  if (width === undefined || height === undefined) return undefined;
  const x = Number.isFinite(bounds.x) ? Math.round(bounds.x) : undefined;
  const y = Number.isFinite(bounds.y) ? Math.round(bounds.y) : undefined;
  if (x === undefined || y === undefined) return { width, height };
  return { x, y, width, height };
}

function sanitizeZoomFactor(factor) {
  if (!Number.isFinite(factor)) return undefined;
  return Math.min(ZOOM_FACTOR_MAX, Math.max(ZOOM_FACTOR_MIN, factor));
}

function desktopPaper() {
  return nativeTheme.shouldUseDarkColors ? '#171717' : '#fbfbfa';
}

function saveSettings(settings) {
  const parent = path.dirname(settingsPath);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') fs.chmodSync(parent, 0o700);
  const temporary = path.join(
    parent,
    `.settings.${String(process.pid)}.${randomBytes(6).toString('hex')}.tmp`,
  );
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    fs.renameSync(temporary, settingsPath);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function ariadneHomeDir() {
  const current = app.isPackaged
    ? path.join(app.getPath('userData'), 'ariadne-data')
    : path.join(__dirname, 'ariadne-data');
  if (!app.isPackaged) {
    const legacy = path.join(__dirname, 'kimi-data');
    if (!fs.existsSync(current) && fs.existsSync(legacy)) {
      let renamed = false;
      if (!treeContainsSymlink(legacy)) {
        try {
          fs.renameSync(legacy, current);
          renamed = true;
        } catch (error) {
          console.warn('[ariadne] legacy data rename failed; copying regular files:', error.message);
        }
      }
      if (!renamed) {
        const staging = `${current}.migration.${String(process.pid)}.${randomBytes(6).toString('hex')}`;
        try {
          copyRegularTree(legacy, staging);
          if (process.platform !== 'win32') restrictPrivateTree(staging);
          fs.renameSync(staging, current);
        } catch (error) {
          fs.rmSync(staging, { recursive: true, force: true });
          throw error;
        }
      } else if (process.platform !== 'win32') {
        restrictPrivateTree(current);
      }
      console.log('[ariadne] migrated kimi-data -> ariadne-data');
    }
  }
  fs.mkdirSync(current, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(current, 0o700);
    } catch (error) {
      console.warn('[ariadne] could not restrict data-directory permissions:', error.message);
    }
  }
  return current;
}

function treeContainsSymlink(source) {
  try {
    const metadata = fs.lstatSync(source);
    if (metadata.isSymbolicLink()) return true;
    if (!metadata.isDirectory()) return false;
    return fs.readdirSync(source).some((entry) =>
      treeContainsSymlink(path.join(source, entry)),
    );
  } catch {
    return true;
  }
}

function copyRegularTree(source, destination) {
  const metadata = fs.lstatSync(source);
  if (metadata.isSymbolicLink()) {
    console.warn('[ariadne] skipped symbolic link during legacy migration:', source);
    return;
  }
  if (metadata.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
    for (const entry of fs.readdirSync(source)) {
      copyRegularTree(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }
  if (metadata.isFile()) {
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    if (process.platform !== 'win32') fs.chmodSync(destination, 0o600);
  }
}

function restrictPrivateTree(target) {
  const metadata = fs.lstatSync(target);
  if (metadata.isSymbolicLink()) return;
  if (metadata.isDirectory()) {
    fs.chmodSync(target, 0o700);
    for (const entry of fs.readdirSync(target)) {
      restrictPrivateTree(path.join(target, entry));
    }
  } else if (metadata.isFile()) {
    fs.chmodSync(target, 0o600);
  }
}

function engineDir(...parts) {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'harness')
    : path.join(__dirname, 'engine', 'apps', 'ariadne-buddy');
  return path.join(base, ...parts);
}

function brandMarkSvg() {
  if (brandMarkSvgCache !== null) return brandMarkSvgCache;
  const markPath = app.isPackaged
    ? path.join(process.resourcesPath, 'brand', 'logo.svg')
    : path.join(__dirname, 'build', 'logo.svg');
  try {
    brandMarkSvgCache = fs.readFileSync(markPath, 'utf8');
  } catch (error) {
    console.warn('[ariadne] could not load brand mark:', error.message);
    brandMarkSvgCache = '';
  }
  return brandMarkSvgCache;
}

function monorepoRoot() {
  return path.join(__dirname, 'engine');
}

function desktopAppearanceCss() {
  if (appearanceCssCache !== undefined) return appearanceCssCache;
  const file = app.isPackaged
    ? path.join(process.resourcesPath, 'brand', 'appearance.css')
    : engineDir('theme', 'appearance.css');
  try {
    appearanceCssCache = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.warn('[ariadne] could not load desktop appearance:', error.message);
    appearanceCssCache = '';
  }
  return appearanceCssCache;
}

function desktopDisplayFontCss() {
  if (displayFontCssCache !== undefined) return displayFontCssCache;
  const filename = 'cormorant-garamond-latin-wght-normal.woff2';
  const webAssets = app.isPackaged ? path.join(process.resourcesPath, 'web-ui') : engineDir('web-ui');
  let file = path.join(webAssets, 'assets', 'ariadne-fonts', 'cormorant-garamond', filename);
  if (!app.isPackaged && !fs.existsSync(file)) {
    file = path.join(__dirname, 'node_modules', '@fontsource-variable', 'cormorant-garamond', 'files', filename);
  }
  try {
    const encoded = fs.readFileSync(file).toString('base64');
    displayFontCssCache = `@font-face {
      font-family: "Cormorant Garamond Variable";
      src: url(data:font/woff2;base64,${encoded}) format("woff2");
      font-weight: 300 700;
      font-style: normal;
      font-display: swap;
    }`;
  } catch {
    displayFontCssCache = '';
  }
  return displayFontCssCache;
}

function augmentedPath() {
  const entries = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(app.getPath('home'), '.local', 'bin'),
    ...(process.env.PATH || '').split(path.delimiter),
  ].filter(Boolean);
  return [...new Set(entries)].join(path.delimiter);
}

function importExistingConfig(homeDir) {
  if (fs.existsSync(path.join(homeDir, 'config.toml'))) return;
  const sourceHome = path.join(os.homedir(), '.ariadne');
  if (path.resolve(sourceHome) === path.resolve(homeDir)) return;
  if (!fs.existsSync(path.join(sourceHome, 'config.toml'))) return;

  fs.mkdirSync(homeDir, { recursive: true, mode: 0o700 });
  for (const entry of ['config.toml', 'ariadne.json']) {
    const source = path.join(sourceHome, entry);
    const destination = path.join(homeDir, entry);
    if (isRegularFile(source) && !fs.existsSync(destination)) {
      fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(destination, 0o600);
    }
  }
  console.log('[ariadne] imported config from', sourceHome);
}

function queueServerStart(workspaceDir) {
  const generation = ++serverGeneration;
  currentWorkspace = path.resolve(workspaceDir);
  serverQueue = serverQueue
    .catch((error) => {
      console.error('[ariadne] previous server operation failed:', error);
    })
    .then(() => startServer(currentWorkspace, generation));
  return serverQueue;
}

async function startServer(cwd, generation) {
  if (generation !== serverGeneration || isQuitting) return;
  await stopServer();
  if (generation !== serverGeneration || isQuitting) return;

  if (!isUsableDirectory(cwd)) {
    handleServerFailure('工作目录不可用', `目录不存在、不可读或不可写：${cwd}`, generation);
    return;
  }

  serverUrl = null;
  showLoading('正在启动科研工作台…', { workspace: cwd });

  let homeDir;
  try {
    homeDir = ariadneHomeDir();
    if (!DESKTOP_SMOKE) importExistingConfig(homeDir);
  } catch (error) {
    handleServerFailure('无法初始化配置', error.message, generation);
    return;
  }

  const launch = resolveEngineLaunch(homeDir);
  if (launch.error) {
    handleServerFailure('缺少引擎', launch.error, generation);
    return;
  }

  console.log('[ariadne] starting web server, home =', homeDir, 'cwd =', cwd);
  const child = spawn(launch.command, launch.args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: launch.env,
    detached: process.platform !== 'win32',
  });
  serverProc = child;

  const outputBuffers = { stdout: '', stderr: '' };
  const onLine = (line) => {
    const match = stripAnsi(line).match(/Local:\s+(http:\/\/\S+)/);
    if (!match || serverUrl !== null || generation !== serverGeneration) return;
    const trustedUrl = validateLocalServerUrl(match[1]);
    if (trustedUrl === null) {
      handleServerFailure('引擎地址无效', '引擎返回了不受信任的本地服务地址。', generation);
      void stopServer();
      return;
    }
    serverUrl = trustedUrl;
    clearStartupTimer();
    console.log('[ariadne] server ready:', redactSecrets(serverUrl));
    void loadAppUrl(trustedUrl, generation);
  };
  const onData = (stream, data) => {
    outputBuffers[stream] = writeCompleteEngineLogLines(
      outputBuffers[stream] + data.toString(),
      onLine,
    );
  };

  child.stdout.on('data', (data) => onData('stdout', data));
  child.stderr.on('data', (data) => onData('stderr', data));
  child.once('error', (error) => {
    expectedServerExits.add(child);
    if (serverProc === child) serverProc = null;
    clearStartupTimer();
    handleServerFailure('无法启动 Ariadne 引擎', error.message, generation);
  });
  child.once('exit', (code, signal) => {
    for (const buffer of Object.values(outputBuffers)) {
      if (buffer !== '') process.stdout.write(`[engine] ${redactSecrets(buffer)}\n`);
      if (buffer !== '') appendEngineLog(buffer);
    }
    if (serverProc === child) serverProc = null;
    if (generation === serverGeneration) clearStartupTimer();
    if (isQuitting || expectedServerExits.has(child) || generation !== serverGeneration) return;
    const reason = signal ? `信号 ${signal}` : `退出码 ${String(code)}`;
    handleServerFailure('Ariadne 引擎已退出', `Web 服务异常退出（${reason}）。`, generation);
  });

  startupTimer = setTimeout(() => {
    if (generation !== serverGeneration || serverUrl !== null) return;
    expectedServerExits.add(child);
    void stopServer();
    handleServerFailure(
      'Ariadne 引擎启动超时',
      `在 ${String(SERVER_START_TIMEOUT_MS / 1000)} 秒内未检测到服务地址，请查看终端日志。`,
      generation,
    );
  }, SERVER_START_TIMEOUT_MS);
}

function resolveEngineLaunch(homeDir) {
  const distCli = engineDir('dist', 'cli.mjs');
  const baseEnv = {
    ...process.env,
    PATH: augmentedPath(),
    ARIADNE_HOME: homeDir,
    ELECTRON_RUN_AS_NODE: '1',
  };

  if (fs.existsSync(distCli)) {
    if (app.isPackaged) {
      baseEnv.ARIADNE_WEB_ASSETS_DIR = path.join(process.resourcesPath, 'web-ui');
    }
    return {
      command: process.execPath,
      args: [distCli, 'web', '--no-open', '--home', homeDir],
      env: baseEnv,
    };
  }

  const devCli = engineDir('src', 'cli.ts');
  const tsxCli = path.join(monorepoRoot(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  if (!app.isPackaged && fs.existsSync(devCli) && fs.existsSync(tsxCli)) {
    return {
      command: process.execPath,
      args: [
        tsxCli,
        '--tsconfig',
        engineDir('tsconfig.dev.json'),
        '--import',
        path.join(monorepoRoot(), 'build', 'register-raw-text-loader.mjs'),
        devCli,
        'web',
        '--no-open',
        '--home',
        homeDir,
      ],
      env: baseEnv,
    };
  }

  return {
    error: '未找到 Ariadne 引擎文件，请重新安装或运行 npm run setup。',
  };
}

async function stopServer() {
  clearStartupTimer();
  const child = serverProc;
  serverProc = null;
  serverUrl = null;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  expectedServerExits.add(child);
  await new Promise((resolve) => {
    let settled = false;
    let forceTimer;
    let finalTimer;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(forceTimer);
      clearTimeout(finalTimer);
      resolve();
    };
    child.once('exit', finish);
    if (child.exitCode !== null || child.signalCode !== null) {
      finish();
      return;
    }
    if (!signalServerProcess(child, false)) {
      signalServerProcess(child, true);
    }
    forceTimer = setTimeout(() => {
      signalServerProcess(child, true);
    }, SERVER_STOP_GRACE_MS);
    finalTimer = setTimeout(finish, SERVER_STOP_GRACE_MS + 2_000);
  });
}

function signalServerProcess(child, force) {
  if (process.platform === 'win32' && child.pid) {
    const args = ['/pid', String(child.pid), '/t'];
    if (force) args.push('/f');
    if (spawnSync('taskkill', args, { stdio: 'ignore' }).status === 0) return true;
    if (!force) return false;
  }
  const signal = force ? 'SIGKILL' : 'SIGTERM';
  if (child.pid && process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return true;
    } catch {}
  }
  try {
    return child.kill(signal);
  } catch {
    return false;
  }
}

function clearStartupTimer() {
  if (startupTimer !== null) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
}

function handleServerFailure(title, detail, generation) {
  if (generation !== serverGeneration || isQuitting) return;
  if (DESKTOP_SMOKE) {
    failDesktopSmoke(`${title}: ${detail}`);
    return;
  }
  showLoading('引擎未运行', { errorDetail: detail });
  void presentServerFailureDialog(title, detail);
}

async function presentServerFailureDialog(title, detail) {
  if (typeof dialog !== 'object' || dialog === null || typeof dialog.showMessageBox !== 'function') return;
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'error',
      title,
      message: detail,
      detail: '可从下方选择恢复操作，或查看日志了解更多细节。',
      buttons: ['重试', '选择其他工作目录…', '打开日志目录', '退出'],
      defaultId: 0,
      cancelId: 3,
      noLink: true,
    });
    switch (result.response) {
      case 0:
        void queueServerStart(currentWorkspace);
        break;
      case 1:
        void chooseWorkspace();
        break;
      case 2:
        revealLogs();
        break;
      default:
        app.quit();
        break;
    }
  } catch (error) {
    console.warn('[ariadne] could not present failure dialog:', error.message);
  }
}

async function verifyDesktopSmoke(url, generation) {
  if (!DESKTOP_SMOKE || desktopSmokeSettled || generation !== serverGeneration) return;
  try {
    const parsed = new URL(url);
    const token = decodeURIComponent(parsed.hash.slice('#token='.length));
    if (token === '') throw new Error('local server URL omitted its bearer token');
    if (mainWindow?.webContents.getTitle() !== PRODUCT) {
      throw new Error(`unexpected window title: ${String(mainWindow?.webContents.getTitle())}`);
    }
    const response = await fetch(`${parsed.origin}/api/v1/search`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: 'Ariadne' }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`search endpoint returned HTTP ${String(response.status)}`);
    const envelope = await response.json();
    if (envelope?.code !== 0) {
      throw new Error(`search endpoint returned code ${String(envelope?.code)}`);
    }
    const degraded = envelope?.data?.index_state?.degraded;
    if (typeof degraded === 'string' && degraded !== '') {
      throw new Error(`global search is degraded: ${degraded}`);
    }
    const inputs = await fetch(`${parsed.origin}/api/v1/ariadne/research/afpk/inputs`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!inputs.ok) {
      throw new Error(`packaged AFPK input selection returned HTTP ${String(inputs.status)}`);
    }
    const catalog = await inputs.json();
    if (!Array.isArray(catalog.requests) || !Array.isArray(catalog.presets) ||
        !Array.isArray(catalog.files?.proteins) || !Array.isArray(catalog.files?.models)) {
      throw new Error('packaged AFPK input selection is missing its file catalog');
    }
    desktopSmokeSettled = true;
    clearTimeout(desktopSmokeTimer);
    process.stdout.write('DESKTOP_SMOKE_OK\n');
    app.quit();
  } catch (error) {
    failDesktopSmoke(error instanceof Error ? error.message : String(error));
  }
}

function failDesktopSmoke(message) {
  if (desktopSmokeSettled) return;
  desktopSmokeSettled = true;
  clearTimeout(desktopSmokeTimer);
  process.exitCode = 1;
  process.stderr.write(`DESKTOP_SMOKE_FAILED: ${message}\n`);
  app.quit();
}

function createMainWindow() {
  if (mainWindow) return mainWindow;
  const options = {
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: desktopPaper(),
    title: PRODUCT,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      safeDialogs: true,
    },
  };
  if (!app.isPackaged) options.icon = path.join(__dirname, 'build', 'icon.png');
  applyRestoredWindowBounds(options);

  mainWindow = new BrowserWindow(options);
  restoreWindowState(mainWindow);
  mainWindow.webContents.session.setPermissionCheckHandler(() => false);
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      console.warn('[ariadne] denied renderer permission request:', permission);
      callback(false);
    },
  );
  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    if (isQuitting || details.reason === 'clean-exit') return;
    handleServerFailure(
      'AriadneBuddy 界面进程已退出',
      `渲染进程异常退出（${details.reason}）。请从“文件”菜单重启引擎。`,
      serverGeneration,
    );
  });
  mainWindow.once('ready-to-show', () => {
    if (!DESKTOP_SMOKE) mainWindow?.show();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  attachContextMenu(mainWindow);
  attachNavigationGuards(mainWindow);
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[ariadne] page loaded:', mainWindow?.webContents.getTitle());
  });
  return mainWindow;
}

function applyRestoredWindowBounds(options) {
  const saved = loadSettings().bounds;
  if (saved === undefined) return;
  options.width = Math.max(options.minWidth, Math.min(saved.width, 20_000));
  options.height = Math.max(options.minHeight, Math.min(saved.height, 20_000));
  if (saved.x !== undefined && saved.y !== undefined) {
    options.x = saved.x;
    options.y = saved.y;
  }
  clampWindowOptionsToDisplay(options);
}

function clampWindowOptionsToDisplay(options) {
  if (typeof screen !== 'object' || screen === null) return;
  if (typeof screen.getDisplayMatching !== 'function') return;
  let workArea;
  try {
    workArea = screen.getDisplayMatching({
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width,
      height: options.height,
    })?.workArea;
  } catch {
    return;
  }
  if (!workArea) return;
  options.width = Math.min(options.width, workArea.width);
  options.height = Math.min(options.height, workArea.height);
  const maxX = Math.max(workArea.x, workArea.x + workArea.width - options.width);
  const maxY = Math.max(workArea.y, workArea.y + workArea.height - options.height);
  options.x = Math.round(Math.min(Math.max(options.x ?? workArea.x, workArea.x), maxX));
  options.y = Math.round(Math.min(Math.max(options.y ?? workArea.y, workArea.y), maxY));
}

function restoreWindowState(win) {
  const settings = loadSettings();
  try {
    if (settings.maximized) win.maximize();
  } catch (error) {
    console.warn('[ariadne] could not restore maximized state:', error.message);
  }
  if (settings.zoomFactor !== undefined) {
    try {
      win.webContents.zoomFactor = settings.zoomFactor;
    } catch (error) {
      console.warn('[ariadne] could not restore zoom factor:', error.message);
    }
  }
  attachWindowStatePersistence(win);
}

function attachWindowStatePersistence(win) {
  const schedule = () => scheduleWindowStatePersist();
  win.on('resize', schedule);
  win.on('move', schedule);
  win.on('maximize', schedule);
  win.on('unmaximize', schedule);
  win.on('close', persistWindowState);
  if (typeof win.webContents?.on === 'function') win.webContents.on('zoom-changed', schedule);
}

function scheduleWindowStatePersist() {
  if (DESKTOP_SMOKE) return;
  if (windowStatePersistTimer !== null) clearTimeout(windowStatePersistTimer);
  windowStatePersistTimer = setTimeout(() => {
    windowStatePersistTimer = null;
    persistWindowState();
  }, 400);
}

function persistWindowState() {
  if (windowStatePersistTimer !== null) {
    clearTimeout(windowStatePersistTimer);
    windowStatePersistTimer = null;
  }
  if (DESKTOP_SMOKE || mainWindow === null || mainWindow.isDestroyed()) return;
  try {
    const settings = loadSettings();
    const maximized = mainWindow.isMaximized();
    const next = { ...settings, maximized };
    if (!maximized) {
      const bounds = mainWindow.getBounds();
      next.bounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    } else if (settings.bounds) {
      next.bounds = settings.bounds;
    }
    const zoom = mainWindow.webContents?.zoomFactor;
    if (typeof zoom === 'number' && Number.isFinite(zoom)) next.zoomFactor = sanitizeZoomFactor(zoom);
    saveSettings(next);
  } catch (error) {
    console.warn('[ariadne] could not save window state:', error.message);
  }
}

function showLoading(status, { workspace, errorDetail } = {}) {
  const win = createMainWindow();
  const mark = brandMarkSvg();
  const failed = errorDetail !== undefined;
  const html = `<!doctype html>
<html lang="zh-CN" data-color-scheme="${desktopColorScheme}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'">
  <meta name="viewport" content="width=device-width">
  <meta name="color-scheme" content="${desktopColorScheme === 'system' ? 'light dark' : desktopColorScheme}">
  <title>${PRODUCT}</title>
  <style>
    ${desktopAppearanceCss()}
    ${desktopDisplayFontCss()}
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      display: grid;
      place-items: center;
      background: var(--tb-paper, light-dark(#fbfbfa, #171717));
      color: var(--tb-ink, light-dark(#1c1d1c, #e7e8e5));
      font: 14px/1.55 var(--font-ui, system-ui, sans-serif);
    }
    .card {
      width: min(100%, 400px);
      padding: 26px 24px 22px;
      border: 1px solid var(--tb-line, #d2d4d1);
      border-top: var(--workspace-rule, 3px double light-dark(#444644, #b9bcb6));
      border-radius: var(--workspace-panel-radius, 10px);
      background: var(--tb-paper-raised, light-dark(#fff, #202020));
    }
    .brand {
      display: grid;
      justify-items: center;
      gap: 12px;
    }
    .brand-emblem { display: flex; align-items: center; gap: 14px; }
    .brand-rule {
      height: 10px;
      margin: 16px 0 0;
      background: var(--rule-egg-and-dart);
    }
    .card > .divider-meander { margin: 12px 0 0; }
    .mark {
      display: grid;
      place-items: center;
      width: 62px;
      height: 62px;
      border-radius: var(--radius-pill);
      background: var(--marble-highlight);
      box-shadow: var(--shadow-medallion), 0 0 0 4px var(--tb-paper-raised, #fff), 0 0 0 5px var(--tb-line, #d2d4d1);
    }
    .mark svg { width: 45px; height: 45px; color: var(--color-text-strong, currentColor); }
    h1 {
      margin: 0;
      font: 500 clamp(25px, 5vw, 32px)/1.14 var(--workspace-heading-font, "Cormorant Garamond Variable", Georgia, serif);
    }
    .status {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 15px 0 0;
      color: var(--color-accent, light-dark(#1c1d1c, #e7e8e5));
    }
    .spinner {
      width: 14px;
      height: 14px;
      flex: none;
      border: 1.5px solid var(--tb-line, #d2d4d1);
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin .9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .failure { color: var(--tb-danger, light-dark(#1c1d1c, #e7e8e5)); font-weight: 600; }
    .detail { margin: 10px 0 0; white-space: pre-wrap; }
    .workspace {
      display: grid;
      gap: 3px;
      margin: 16px 0 0;
      padding: 9px 12px;
      border-radius: var(--radius-xs, 4px);
      background: var(--tb-paper-soft, light-dark(#f2f2f1, #242424));
    }
    .workspace, .detail {
      color: var(--tb-ink-muted, light-dark(#525452, #afb0ac));
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .workspace dt { font-weight: 600; }
    .workspace dd { margin: 0; }
    @media (prefers-reduced-motion: reduce) {
      .spinner { animation: none; }
    }
  </style>
</head>
<body>
  <main class="card" aria-label="科学发现工作台">
    <div class="brand">
      ${mark ? `<div class="brand-emblem">
        <span class="workspace-column" aria-hidden="true"></span>
        <div class="mark" aria-hidden="true">${mark}</div>
        <span class="workspace-column" aria-hidden="true"></span>
      </div>` : ''}
      <h1>${PRODUCT}</h1>
    </div>
    <div class="brand-rule" aria-hidden="true"></div>
    <div class="divider-meander" aria-hidden="true"></div>
    <p class="status${failed ? ' failure' : ''}" role="${failed ? 'alert' : 'status'}">
      ${failed ? '' : '<span class="spinner" aria-hidden="true"></span>'}${escapeHtml(status)}
    </p>
    ${workspace ? `<dl class="workspace"><dt>工作区</dt><dd>${escapeHtml(workspace)}</dd></dl>` : ''}
    ${failed ? `<p class="detail">${escapeHtml(errorDetail)}</p>` : ''}
  </main>
</body>
</html>`;
  loadingUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  void win.loadURL(loadingUrl).catch((error) => {
    // A fast server startup can supersede this temporary data URL before its
    // navigation commits. Chromium reports that expected hand-off as aborted.
    if (error && error.code === 'ERR_ABORTED') return;
    console.error('[ariadne] failed to show loading page:', error);
  });
}

async function loadAppUrl(url, generation) {
  const win = createMainWindow();
  try {
    await win.loadURL(url);
    if (generation === serverGeneration) loadingUrl = null;
    await verifyDesktopSmoke(url, generation);
  } catch (error) {
    handleServerFailure('无法加载 AriadneBuddy 界面', error.message, generation);
  }
}

function attachNavigationGuards(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isSameServerOrigin(url)) void openExternalUrl(url);
    return { action: 'deny' };
  });
  const guard = (event, url) => {
    if (url === loadingUrl || isSameServerOrigin(url)) return;
    event.preventDefault();
    void openExternalUrl(url);
  };
  win.webContents.on('will-navigate', guard);
  win.webContents.on('will-redirect', guard);
}

function isSameServerOrigin(candidate) {
  if (serverUrl === null) return false;
  try {
    return new URL(candidate).origin === new URL(serverUrl).origin;
  } catch {
    return false;
  }
}

async function openExternalUrl(candidate) {
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      console.warn('[ariadne] blocked external URL protocol:', url.protocol);
      await warnBlockedUrl(url);
      return;
    }
    await shell.openExternal(url.href);
  } catch (error) {
    console.warn('[ariadne] could not open external URL:', error.message);
  }
}

async function warnBlockedUrl(url) {
  if (typeof dialog !== 'object' || dialog === null || typeof dialog.showMessageBox !== 'function') return;
  try {
    await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '已阻止的链接',
      message: '为了你的安全，AriadneBuddy 不会打开该类型的链接。',
      detail: url.href,
      buttons: ['好'],
      defaultId: 0,
      noLink: true,
    });
  } catch (error) {
    console.warn('[ariadne] could not show blocked-link dialog:', error.message);
  }
}

function copyToClipboard(text) {
  if (typeof clipboard === 'undefined' || clipboard === null || typeof clipboard.writeText !== 'function') return;
  try {
    clipboard.writeText(text);
  } catch (error) {
    console.warn('[ariadne] could not copy link address:', error.message);
  }
}

async function chooseWorkspace() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择工作目录',
    buttonLabel: '打开',
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: currentWorkspace,
  });
  if (result.canceled || !result.filePaths[0]) return;
  const directory = path.resolve(result.filePaths[0]);
  try {
    saveSettings({ ...loadSettings(), workspaceDir: directory });
  } catch (error) {
    dialog.showErrorBox('无法保存设置', error.message);
    return;
  }
  await queueServerStart(directory);
}

function applyColorScheme(scheme) {
  if (!isColorScheme(scheme) || desktopColorScheme === scheme) return;
  desktopColorScheme = scheme;
  if (typeof nativeTheme === 'object' && nativeTheme !== null) {
    try {
      nativeTheme.themeSource = scheme;
    } catch (error) {
      console.warn('[ariadne] could not apply theme source:', error.message);
    }
  }
  persistColorScheme(scheme);
  buildMenu();
}

function persistColorScheme(scheme) {
  if (DESKTOP_SMOKE) return;
  try {
    saveSettings({ ...loadSettings(), colorScheme: scheme });
  } catch (error) {
    console.warn('[ariadne] could not save appearance:', error.message);
  }
}

function buildMenu() {
  const template = [];
  if (process.platform === 'darwin') {
    template.push({
      label: PRODUCT,
      submenu: [
        { role: 'about', label: `关于 ${PRODUCT}` },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: `隐藏 ${PRODUCT}` },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { role: 'quit', label: `退出 ${PRODUCT}` },
      ],
    });
  }
  template.push(
    {
      label: '文件',
      submenu: [
        { label: '打开工作目录…', accelerator: 'CmdOrCtrl+O', click: () => void chooseWorkspace() },
        {
          label: '重启引擎',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => void queueServerStart(currentWorkspace),
        },
        { type: 'separator' },
        { label: '打开日志目录', click: () => revealLogs() },
        { label: '在文件管理器中显示工作目录', click: () => revealWorkspace() },
        { type: 'separator' },
        { role: 'reload', label: '刷新界面' },
        ...(!app.isPackaged || process.env.ARIADNE_DEBUG === '1'
          ? [{ role: 'toggleDevTools', label: '开发者工具' }]
          : []),
        { type: 'separator' },
        { role: 'quit', label: `退出 ${PRODUCT}` },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'pasteAndMatchStyle', label: '粘贴并匹配样式' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        {
          label: '外观',
          submenu: [
            { label: '跟随系统', type: 'radio', checked: desktopColorScheme === 'system', click: () => applyColorScheme('system') },
            { label: '浅色', type: 'radio', checked: desktopColorScheme === 'light', click: () => applyColorScheme('light') },
            { label: '深色', type: 'radio', checked: desktopColorScheme === 'dark', click: () => applyColorScheme('dark') },
          ],
        },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: `关于 ${PRODUCT}`, click: () => showAboutWindow() },
        { type: 'separator' },
        { label: '打开日志目录', click: () => revealLogs() },
        { type: 'separator' },
        { label: '报告问题…', click: () => void openExternalUrl(ISSUE_TRACKER_URL) },
      ],
    },
  );
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function attachContextMenu(win) {
  win.webContents.on('context-menu', (_event, params) => {
    const items = [];
    if (params.linkURL) {
      items.push({ label: '在浏览器中打开链接', click: () => void openExternalUrl(params.linkURL) });
      items.push({ label: '复制链接地址', click: () => copyToClipboard(params.linkURL) });
    }
    if (params.isEditable) {
      items.push(
        { role: 'cut', label: '剪切', enabled: params.editFlags.canCut },
        { role: 'copy', label: '复制', enabled: params.editFlags.canCopy },
        { role: 'paste', label: '粘贴', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { role: 'selectAll', label: '全选' },
      );
    } else if (params.selectionText) {
      items.push({ role: 'copy', label: '复制' });
    }
    if (items.length > 0) Menu.buildFromTemplate(items).popup({ window: win });
  });
}

function validateLocalServerUrl(candidate) {
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const loopback = hostname === '127.0.0.1' || hostname === '::1' || hostname === 'localhost';
    if (
      url.protocol !== 'http:' ||
      !loopback ||
      !url.hash.startsWith('#token=') ||
      url.hash.length <= '#token='.length
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function writeCompleteEngineLogLines(text, onLine) {
  const lines = text.split('\n');
  const remainder = lines.pop() || '';
  for (const line of lines) {
    process.stdout.write(`[engine] ${redactSecrets(line)}\n`);
    appendEngineLog(line);
    onLine(line);
  }
  return remainder.slice(-MAX_ENGINE_BUFFER_BYTES);
}

function resolveEngineLogPath() {
  if (engineLogPath !== null) return engineLogPath;
  let logsDir;
  try {
    logsDir = app.getPath('logs');
  } catch {
    return null;
  }
  if (typeof logsDir !== 'string' || logsDir === '') return null;
  engineLogPath = path.join(logsDir, 'engine.log');
  return engineLogPath;
}

function appendEngineLog(line) {
  try {
    const target = resolveEngineLogPath();
    if (target === null) return;
    const entry = `${redactSecrets(line)}\n`;
    try {
      if (fs.existsSync(target) && fs.statSync(target).size > MAX_ENGINE_LOG_BYTES) {
        const kept = fs.readFileSync(target, 'utf8').slice(-MAX_ENGINE_LOG_BYTES);
        fs.writeFileSync(target, kept);
      }
    } catch {
      // A missing or unreadable log never blocks engine output handling.
    }
    fs.appendFileSync(target, entry);
  } catch {
    // Engine logging is best-effort and must never crash startup or the probe.
  }
}

function logsDirectory() {
  try {
    const dir = app.getPath('logs');
    return typeof dir === 'string' && dir !== '' ? dir : null;
  } catch {
    return null;
  }
}

function revealInFileManager(targetPath) {
  if (typeof targetPath !== 'string' || targetPath === '') return;
  if (typeof shell !== 'object' || shell === null || typeof shell.openPath !== 'function') return;
  void Promise.resolve(shell.openPath(targetPath))
    .then((errorMessage) => {
      if (errorMessage) console.warn('[ariadne] could not reveal path:', targetPath, errorMessage);
    })
    .catch((error) => console.warn('[ariadne] could not reveal path:', error.message));
}

function revealLogs() {
  const dir = logsDirectory();
  if (dir === null) {
    console.warn('[ariadne] logs directory is unavailable');
    return;
  }
  revealInFileManager(dir);
}

function revealWorkspace() {
  revealInFileManager(currentWorkspace);
}

function productVersion() {
  try {
    return typeof app.getVersion === 'function' ? app.getVersion() : '';
  } catch {
    return '';
  }
}

function aboutIconPath() {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'web-ui', 'favicon.ico'), path.join(process.resourcesPath, 'brand', 'logo.svg')]
    : [path.join(__dirname, 'build', 'icon.png'), path.join(__dirname, 'build', 'logo.svg')];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function configureAboutPanel() {
  if (typeof app.setAboutPanelOptions !== 'function') return;
  try {
    const version = productVersion();
    const options = {
      applicationName: PRODUCT,
      applicationVersion: version,
      version,
      copyright: `© ${String(new Date().getFullYear())} AriadneBuddy contributors`,
    };
    const icon = aboutIconPath();
    if (icon) options.iconPath = icon;
    app.setAboutPanelOptions(options);
  } catch (error) {
    console.warn('[ariadne] could not configure the about panel:', error.message);
  }
}

function resourceBaseDir() {
  return app.isPackaged ? path.join(process.resourcesPath, 'licenses') : path.join(__dirname, 'licenses');
}

function resolveResourcePath(target) {
  try {
    if (target === 'LICENSE') return path.join(__dirname, 'LICENSE');
    const base = resourceBaseDir();
    const resolved = path.resolve(base, target);
    if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
    return resolved;
  } catch {
    return null;
  }
}

function revealResource(target) {
  const resolved = resolveResourcePath(target);
  if (resolved === null) return;
  revealInFileManager(resolved);
}

function showAboutWindow() {
  if (aboutWindow !== null && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();
    return;
  }
  if (typeof BrowserWindow !== 'function') return;
  aboutWindow = new BrowserWindow({
    width: 440,
    height: 640,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow ?? undefined,
    modal: mainWindow != null,
    backgroundColor: desktopPaper(),
    title: `关于 ${PRODUCT}`,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  attachAboutActions(aboutWindow);
  void aboutWindow
    .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(aboutHtml(productVersion()))}`)
    .catch((error) => console.warn('[ariadne] could not open the about window:', error.message));
  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

function attachAboutActions(win) {
  const handle = (raw) => {
    if (typeof raw !== 'string') return false;
    if (raw.startsWith('ariadne-close:')) {
      if (!win.isDestroyed()) win.close();
      return true;
    }
    if (raw.startsWith('ariadne-reveal:')) {
      revealResource(decodeURIComponent(raw.slice('ariadne-reveal:'.length)));
      return true;
    }
    return false;
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    handle(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (handle(url)) event.preventDefault();
  });
}

function aboutHtml(version) {
  const mark = brandMarkSvg();
  const year = String(new Date().getFullYear());
  const emblem = mark
    ? `<div class="brand-emblem" aria-hidden="true">
         <span class="workspace-column"></span>
         <div class="mark">${mark}</div>
         <span class="workspace-column"></span>
       </div>`
    : '';
  return `<!doctype html>
<html lang="zh-CN" data-color-scheme="${desktopColorScheme}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'">
  <meta name="viewport" content="width=device-width">
  <meta name="color-scheme" content="${desktopColorScheme === 'system' ? 'light dark' : desktopColorScheme}">
  <title>关于 ${PRODUCT}</title>
  <style>
    ${desktopAppearanceCss()}
    ${desktopDisplayFontCss()}
    * { box-sizing: border-box; }
    body {
      min-height: 100vh; margin: 0; padding: 22px;
      display: grid; place-items: center;
      background: var(--tb-paper, light-dark(#fbfbfa, #171717));
      color: var(--tb-ink, light-dark(#1c1d1c, #e7e8e5));
      font: 14px/1.55 var(--font-ui, system-ui, sans-serif);
    }
    .card {
      width: min(100%, 360px); padding: 24px 22px 18px; text-align: center;
      border: var(--rule-hairline); border-radius: var(--radius-stele);
      background: var(--tb-paper-raised, light-dark(#fff, #202020));
      box-shadow: var(--shadow-stele);
    }
    .brand-emblem { display: flex; align-items: center; justify-content: center; gap: 14px; }
    .brand-emblem .workspace-column { --column-height: 4rem; }
    .mark {
      display: grid; place-items: center; width: 66px; height: 66px;
      border-radius: var(--radius-pill);
      background: var(--marble-highlight);
      box-shadow: var(--shadow-medallion), 0 0 0 4px var(--tb-paper-raised, #fff), 0 0 0 5px var(--tb-line, #d2d4d1);
    }
    .mark svg { width: 46px; height: 46px; color: var(--color-text-strong, currentColor); }
    h1 { margin: 12px 0 0; font: 500 30px/1.1 var(--workspace-heading-font, "Cormorant Garamond Variable", Georgia, serif); }
    .version { margin: 4px 0 0; color: var(--tb-ink-muted, light-dark(#525452, #afb0ac)); font-size: 12px; letter-spacing: .04em; }
    .tagline { margin: 10px 0 0; color: var(--tb-ink-muted, light-dark(#525452, #afb0ac)); font-size: 13px; }
    .brand-rule { height: 10px; margin: 16px 0 0; background: var(--rule-egg-and-dart); }
    .divider-meander { margin: 12px 0 0; }
    .actions { display: grid; gap: 8px; margin: 16px 0 0; }
    .action {
      display: block; padding: 9px 12px; text-align: center; text-decoration: none;
      border: 1px solid var(--color-line-strong); border-radius: var(--radius-stele);
      background: var(--marble-highlight); color: var(--tb-ink-strong, currentColor);
      font: 500 13px/1.2 var(--font-ui, system-ui, sans-serif); cursor: pointer;
    }
    .action:hover { border-color: var(--color-accent, var(--tb-aegean)); color: var(--color-accent, var(--tb-aegean)); }
    .action.primary { background: var(--tb-aegean); border-color: var(--tb-aegean); color: var(--color-text-on-accent, #fff); }
    .copyright { margin: 14px 0 0; color: var(--tb-ink-faint, light-dark(#707070, #a3a3a3)); font-size: 11px; }
  </style>
</head>
<body>
  <main class="card" aria-label="关于 ${PRODUCT}">
    ${emblem}
    <h1>${PRODUCT}</h1>
    <p class="version">${version ? `版本 ${escapeHtml(version)}` : '桌面工作台'}</p>
    <p class="tagline">多智能体科学发现工作台</p>
    <div class="brand-rule" aria-hidden="true"></div>
    <div class="divider-meander" aria-hidden="true"></div>
    <div class="actions">
      <a class="action" href="ariadne-reveal:THIRD_PARTY_NOTICES.md">第三方声明</a>
      <a class="action" href="ariadne-reveal:SBOM.spdx.json">软件物料清单 (SBOM)</a>
      <a class="action" href="ariadne-reveal:LICENSE">许可协议</a>
      <a class="action primary" href="ariadne-close:">关闭</a>
    </div>
    <p class="copyright">© ${year} AriadneBuddy 贡献者</p>
  </main>
</body>
</html>`;
}

function trayIconPath() {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'web-ui', 'favicon.ico'), path.join(process.resourcesPath, 'brand', 'logo.svg')]
    : [path.join(__dirname, 'build', 'icon.png'), path.join(__dirname, 'build', 'logo.svg')];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function revealMainWindow() {
  if (mainWindow === null) {
    if (serverUrl !== null) {
      void loadAppUrl(serverUrl, serverGeneration);
    } else {
      showLoading('正在连接科研工作台…');
    }
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray !== null || typeof Tray !== 'function') return;
  const iconPath = trayIconPath();
  if (iconPath === undefined) return;
  try {
    tray = new Tray(iconPath);
  } catch (error) {
    console.warn('[ariadne] could not create the tray icon:', error.message);
    tray = null;
    return;
  }
  tray.setToolTip(PRODUCT);
  if (typeof Menu === 'object' && Menu !== null && typeof Menu.buildFromTemplate === 'function') {
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: `显示 ${PRODUCT}`, click: () => revealMainWindow() },
      { label: '重启引擎', click: () => void queueServerStart(currentWorkspace) },
      { type: 'separator' },
      { label: `退出 ${PRODUCT}`, click: () => app.quit() },
    ]));
  }
  tray.on('click', () => revealMainWindow());
  tray.on('error', (error) => {
    console.warn('[ariadne] tray icon error:', error?.message ?? error);
  });
}

function setWindowsAppUserModelId() {
  if (process.platform !== 'win32' || typeof app.setAppUserModelId !== 'function') return;
  try {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  } catch (error) {
    console.warn('[ariadne] could not set the Windows app user model id:', error.message);
  }
}

function researchServer() {
  if (serverUrl === null) return null;
  try {
    const parsed = new URL(serverUrl);
    const token = decodeURIComponent(parsed.hash.slice('#token='.length));
    if (token === '') return null;
    return { origin: parsed.origin, token };
  } catch {
    return null;
  }
}

function startResearchMonitor() {
  if (researchMonitorTimer !== null) return;
  scheduleResearchPoll();
}

function scheduleResearchPoll() {
  if (isQuitting) {
    researchMonitorTimer = null;
    return;
  }
  researchMonitorTimer = setTimeout(() => {
    researchMonitorTimer = null;
    void pollResearchTasks().finally(() => {
      if (!isQuitting) scheduleResearchPoll();
    });
  }, RESEARCH_POLL_INTERVAL_MS);
  if (researchMonitorTimer && typeof researchMonitorTimer.unref === 'function') researchMonitorTimer.unref();
}

async function pollResearchTasks() {
  if (DESKTOP_SMOKE || isQuitting) return;
  const server = researchServer();
  if (server === null) return;
  let tasks;
  try {
    const response = await fetch(`${server.origin}/api/v1/ariadne/research`, {
      headers: { authorization: `Bearer ${server.token}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return;
    const payload = await response.json();
    tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
  } catch {
    return;
  }
  for (const task of tasks) {
    if (task && typeof task.id === 'string') await evaluateResearchTask(task, server);
  }
}

async function evaluateResearchTask(task, server) {
  const previous = researchTaskStates.get(task.id) ?? { waiting: false };
  const waiting = task.status === 'waiting';
  researchTaskStates.set(task.id, { waiting });
  if (!waiting || previous.waiting) return;

  const objective = typeof task.objective === 'string' && task.objective !== '' ? task.objective : task.id;
  const detail = await fetchResearchTaskDetail(task.id, server);
  const failedJob = Array.isArray(detail?.assignments)
    ? detail.assignments.find((assignment) => assignment && assignment.status === 'failed')
    : undefined;
  if (failedJob) {
    notifyResearch('研究任务执行失败', `${truncateForNotification(objective)}\n某个计算步骤失败，请在 Research Desk 中重试或查看日志。`);
  } else {
    const gate = typeof task.waitingReason === 'string' ? researchGateLabel(task.waitingReason) : '等待你的决策';
    notifyResearch('研究任务等待处理', `${truncateForNotification(objective)}\n${gate}`);
  }
}

async function fetchResearchTaskDetail(taskId, server) {
  try {
    const response = await fetch(`${server.origin}/api/v1/ariadne/research/${encodeURIComponent(taskId)}`, {
      headers: { authorization: `Bearer ${server.token}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function researchGateLabel(kind) {
  switch (kind) {
    case 'environment_readiness':
      return '运行环境尚未就绪，请在 Research Desk 中检查并重试。';
    case 'afpk_nomination_review':
      return '候选提名已就绪，等待你的评审。';
    case 'budget_exhausted':
      return '任务预算已用尽，需要你授权新的研究任务。';
    case 'integrity':
      return '交接产物校验未通过，需要你处理。';
    default:
      return '等待你的决策。';
  }
}

function truncateForNotification(text) {
  const value = String(text).replace(/\s+/g, ' ').trim();
  return value.length > 80 ? `${value.slice(0, 79)}…` : value;
}

function notifyResearch(title, body) {
  if (typeof Notification !== 'function') return;
  try {
    const notification = new Notification({ title, body });
    notification.on('click', () => revealMainWindow());
  } catch (error) {
    console.warn('[ariadne] could not post a research notification:', error.message);
  }
}

function redactSecrets(text) {
  return text.replace(/(#token=)[^\s]+/g, '$1<redacted>');
}

function stripAnsi(text) {
  return text.replace(ANSI_ESCAPE_PATTERN, '');
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isDirectory(directory) {
  try {
    return fs.statSync(directory).isDirectory();
  } catch {
    return false;
  }
}

function isRegularFile(filePath) {
  try {
    return fs.lstatSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isUsableDirectory(directory) {
  if (!isDirectory(directory)) return false;
  try {
    fs.accessSync(directory, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  ipcMain.on('ariadne:color-scheme', (event, scheme) => {
    const frame = event.senderFrame;
    if (!frame || event.sender !== mainWindow?.webContents || frame !== event.sender.mainFrame ||
        !isSameServerOrigin(frame.url) || !isColorScheme(scheme)) return;
    applyColorScheme(scheme);
  });
  app.on('second-instance', () => {
    const win = createMainWindow();
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.whenReady().then(() => {
    if (DESKTOP_SMOKE) {
      desktopSmokeTimer = setTimeout(() => {
        failDesktopSmoke(
          `desktop application did not become ready within ${String(DESKTOP_SMOKE_TIMEOUT_MS)}ms`,
        );
      }, DESKTOP_SMOKE_TIMEOUT_MS);
    }
    configureAboutPanel();
    buildMenu();
    const settings = loadSettings();
    desktopColorScheme = settings.colorScheme ?? 'light';
    nativeTheme.themeSource = desktopColorScheme;
    nativeTheme.on('updated', () => mainWindow?.setBackgroundColor(desktopPaper()));
    currentWorkspace = settings.workspaceDir || app.getPath('home');
    setWindowsAppUserModelId();
    createTray();
    startResearchMonitor();
    showLoading('正在初始化…');
    void queueServerStart(currentWorkspace);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length > 0) return;
      if (serverUrl !== null) {
        void loadAppUrl(serverUrl, serverGeneration);
      } else {
        showLoading('正在连接科研工作台…');
      }
    });
  });

  app.on('before-quit', (event) => {
    if (quitCleanupDone) return;
    event.preventDefault();
    if (quitCleanupStarted) return;
    quitCleanupStarted = true;
    isQuitting = true;
    serverGeneration++;
    void stopServer()
      .catch((error) => {
        console.warn('[ariadne] server cleanup failed during quit:', error.message);
      })
      .finally(() => {
        quitCleanupDone = true;
        app.quit();
      });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
