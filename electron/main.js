import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  screen,
  shell,
  Tray,
} from 'electron';
import { nearestEdge, dockedBounds } from './dock.js';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateGrowthSummary, readStore, writeStore, mergeGeneration, todayKey, appendFed, pendingFedTexts, clearFed, buildPortablePrompt, looksLikeGeneration, parseGeneration } from '../scripts/growth.mjs';
import { createTrayMenuTemplate } from './tray-menu.js';
import { createUpdateController, parseReleaseFromUrl } from './update-controller.js';
import { bottomRightBounds, isVisibleOnAnyDisplay } from './window-placement.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.TS_DEV_URL || '';

const FULL = { w: 236, h: 348 };
const PEEK = { w: 56, h: 104 };
let mainWin = null;
let tray = null;
let collapsed = false;
let dockSide = 'right'; // 收起态停在哪一边，跟着用户拖动走
let updateController = {
  enabled: false,
  start() {},
  check: async () => {},
  dispose() {},
};

function cursorDisplay() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

function fullBoundsFor(display = cursorDisplay()) {
  return bottomRightBounds(display.workArea, { width: FULL.w, height: FULL.h });
}

function createWindow() {
  const initialBounds = fullBoundsFor();
  const win = new BrowserWindow({
    width: FULL.w,
    height: FULL.h,
    x: initialBounds.x,
    y: initialBounds.y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: { preload: path.join(dir, 'preload.cjs') },
  });
  // 'floating' 层级仅 macOS 生效，其它系统忽略该参数，仍是普通置顶
  win.setAlwaysOnTop(true, 'floating');
  // 跨工作区/全屏跟随：macOS 支持；Windows/Linux 部分桌面环境不支持，失败也不影响主功能
  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch { /* 某些 Linux 桌面环境不支持，忽略 */ }
  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(dir, '..', 'dist', 'index.html'));
  mainWin = win;
  win.once('ready-to-show', ensureSpriteVisible);
  win.on('closed', () => { if (mainWin === win) mainWin = null; });
}

// ---- 成长日记独立窗口 ----
let journalWin = null;
function journalPath() { return path.join(app.getPath('userData'), 'growth-journal.json'); }
function openJournalWindow() {
  if (journalWin && !journalWin.isDestroyed()) { journalWin.show(); journalWin.focus(); return; }
  journalWin = new BrowserWindow({
    width: 560, height: 780, minWidth: 420, minHeight: 480,
    title: appLocale() === 'en' ? 'Growth Journal' : '成长日记',
    backgroundColor: '#f6f2ea',
    show: false, // 等页面画好再露面，省掉一段空白窗；窗口一出现就是加载态
    webPreferences: { preload: path.join(dir, 'preload.cjs') },
  });
  journalWin.removeMenu?.();
  const showJournal = () => {
    if (!journalWin || journalWin.isDestroyed() || journalWin.isVisible()) return;
    journalWin.show();
    journalWin.focus();
  };
  journalWin.once('ready-to-show', showJournal);
  setTimeout(showJournal, 1500); // 兜底：加载异常也别让窗口永远不出现
  if (DEV_URL) journalWin.loadURL(DEV_URL.replace(/\/$/, '') + '/journal.html');
  else journalWin.loadFile(path.join(dir, '..', 'dist', 'journal.html'));
  journalWin.on('closed', () => { journalWin = null; });
}

function ensureSpriteVisible() {
  if (!mainWin || mainWin.isDestroyed()) return;
  const workAreas = screen.getAllDisplays().map((display) => display.workArea);
  if (!isVisibleOnAnyDisplay(mainWin.getBounds(), workAreas)) {
    mainWin.setBounds(fullBoundsFor());
    collapsed = false;
    mainWin.webContents.send('window:recalled');
  }
}

function recallSprite() {
  if (!mainWin || mainWin.isDestroyed()) {
    createWindow();
    return;
  }
  collapsed = false;
  mainWin.setBounds(fullBoundsFor());
  mainWin.webContents.send('window:recalled');
  mainWin.show();
  mainWin.setAlwaysOnTop(true, 'floating');
  mainWin.moveTop();
  mainWin.focus();
}

// 收起=贴边缘缩成探头；展开=还原全尺寸。都保持当前竖直位置，并贴用户上次拖到的那一边。
function setCollapsed(win, isCollapsed) {
  const cur = win.getBounds();
  const wa = screen.getDisplayNearestPoint(cur).workArea;
  win.setBounds(dockedBounds(dockSide, isCollapsed ? PEEK : FULL, cur.y, wa));
}

function autoLaunchEnabled() {
  try { return app.getLoginItemSettings().openAtLogin; } catch { return false; }
}

function setAutoLaunch(on) {
  try {
    app.setLoginItemSettings({ openAtLogin: !!on });
    return autoLaunchEnabled();
  } catch { return false; }
}

// 主进程 UI（托盘/更新弹窗）跟随系统语言：zh* → 中文，其余 → 英文。
// （渲染层可在菜单里手动切语言，主进程这层为简单起见按系统语言走。）
function appLocale() {
  return /^zh/i.test(app.getLocale()) ? 'zh' : 'en';
}

function createTray() {
  if (process.platform !== 'darwin') return;
  const icon = nativeImage
    .createFromPath(path.join(app.getAppPath(), 'build', 'tray-icon.png'))
    .resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip('Token 小精灵');
  tray.setContextMenu(Menu.buildFromTemplate(createTrayMenuTemplate({
    version: app.getVersion(),
    autoLaunch: autoLaunchEnabled(),
    updateEnabled: updateController.enabled,
    onRecall: recallSprite,
    onCheckUpdates: () => updateController.check({ userInitiated: true }),
    onToggleAutoLaunch: setAutoLaunch,
    onQuit: () => app.quit(),
    locale: appLocale(),
  })));
  tray.on('click', recallSprite);
}

// 用量扫描放到子进程里跑：日志解析是同步的，几个 GB 的日志会把主进程卡死十几秒。
// 拿上一次的结果兜底，这样即使某次超时，界面也有数可显示，不会闪空。
const EMPTY_USAGE = {
  total: 0, recentTokens: 0, todayTokens: 0, lastActivityAt: 0,
  breakdown: [], daily: {}, hourly: new Array(24).fill(0),
};
let lastUsage = null;         // 上一次算成功的结果
let usageInFlight = null;

function computeUsageOutOfProcess() {
  if (usageInFlight) return usageInFlight; // 上一轮还没算完就别再开一个
  usageInFlight = new Promise((resolve) => {
    const done = (value) => { usageInFlight = null; resolve(value || EMPTY_USAGE); };
    let child;
    try {
      child = fork(path.join(dir, '..', 'scripts', 'usage-worker.mjs'), [], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        stdio: 'ignore',
      });
    } catch {
      return done(lastUsage); // 起不了子进程就用上次的，别让界面拿到空数据
    }
    const timer = setTimeout(() => { try { child.kill(); } catch {} done(lastUsage); }, 90000);
    child.on('message', (msg) => {
      clearTimeout(timer);
      if (msg && msg.ok && msg.data) lastUsage = msg.data;
      try { child.kill(); } catch {}
      done(lastUsage);
    });
    child.on('error', () => { clearTimeout(timer); done(lastUsage); });
    child.on('exit', () => { clearTimeout(timer); done(lastUsage); });
  });
  return usageInFlight;
}

const RELEASE_REPO = 'shiyubao78/token-sprite';

// 查最新 Release：走 github.com 网页重定向（不碰限流的 api.github.com）。
// 跟随重定向到 .../releases/tag/<ver>，从最终 URL 解析版本；无 Release 时重定向到列表页→返回 null。
async function fetchLatestRelease() {
  const res = await fetch(`https://github.com/${RELEASE_REPO}/releases/latest`, {
    redirect: 'follow',
    headers: { 'User-Agent': 'token-sprite' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return parseReleaseFromUrl(res.url);
}

function initializeUpdates() {
  // 正式打包版才检查更新（开发态保持不联网）；轻量提醒无需签名，各系统通用。
  updateController = createUpdateController({
    currentVersion: app.getVersion(),
    fetchLatest: fetchLatestRelease,
    dialog,
    openExternal: (url) => shell.openExternal(url),
    isEnabled: app.isPackaged,
    locale: appLocale(),
  });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();
else app.on('second-instance', recallSprite);

if (hasSingleInstanceLock) app.whenReady().then(() => {
  // 开发态跑起来的桌宠是终端的子进程，终端/agent 会话一结束它就没了，也不会开机自启。
  // 这行提示是给「用 npm start 当安装交差」的人和 agent 看的。
  if (!app.isPackaged) {
    console.log('\n⚠️  这是开发态：关掉这个终端（或 agent 会话结束）桌宠就会退出，也不会开机自启。');
    console.log('   要装成常驻 app：npm run install:local\n');
  }
  // 开机自启：macOS / Windows 原生支持；Linux 用 XDG autostart，个别桌面环境可能不生效
  const autoLaunchSupported = process.platform === 'darwin' || process.platform === 'win32';
  ipcMain.handle('autolaunch:supported', () => autoLaunchSupported);
  ipcMain.handle('usage:get', () => computeUsageOutOfProcess());
  ipcMain.on('journal:open', () => openJournalWindow());
  ipcMain.handle('journal:get', () => readStore(journalPath()));
  // 拖到桌宠身上的文本：先收进队列，等下次生成小结时一起消化。
  // 不当场调 AI——那要十几秒，喂个东西卡一下体验就毁了。
  // 复制 + 快捷键：比"选中再拖"门槛低得多，复制是所有人的肌肉记忆。
  // 只在按下快捷键那一刻读剪贴板——不做后台监听，不碰你平时复制的任何东西。
  const feedFromClipboard = async () => {
    const text = (clipboard.readText() || '').trim();
    const win = mainWin && !mainWin.isDestroyed() ? mainWin : null;
    if (!text) { win?.webContents.send('journal:fed', { ok: false, reason: 'empty' }); return; }
    try {
      const store = await readStore(journalPath());
      const next = appendFed(store, text, 'clipboard');
      await writeStore(journalPath(), next);
      win?.webContents.send('journal:fed', { ok: true, pending: (next.fed || []).length });
    } catch {
      win?.webContents.send('journal:fed', { ok: false, reason: 'error' });
    }
  };
  try {
    globalShortcut.register('CommandOrControl+Shift+V', feedFromClipboard);
  } catch { /* 快捷键被别的应用占了就算了，拖拽那条路还在 */ }

  ipcMain.handle('journal:ingest', async (e, text, source) => {
    const clean = String(text || '').trim();
    if (!clean) return { ok: false, reason: 'empty' };
    const store = await readStore(journalPath());

    // 粘回来的是别的 AI 按我们的指令生成好的结果 → 直接进日记，不用本机 AI 再算一遍。
    // 这条路是给本机没装 Claude/Codex CLI 的人的（只用网页版的），否则他们永远生成不了。
    if (looksLikeGeneration(clean)) {
      const date = todayKey();
      const merged = mergeGeneration(store, date, parseGeneration(clean), { tools: ['external'], count: 0, at: Date.now() });
      await writeStore(journalPath(), merged); // 注意不清 fed：喂进来的素材还没被消化，留着
      if (journalWin && !journalWin.isDestroyed()) journalWin.webContents.send('journal:updated');
      return { ok: true, kind: 'result', date };
    }

    const next = appendFed(store, clean, source || 'drop');
    await writeStore(journalPath(), next);
    return { ok: true, kind: 'material', pending: (next.fed || []).length };
  });

  // 让别的 AI 帮忙生成时用的指令（单一来源，界面从这里取）
  ipcMain.handle('journal:portablePrompt', () => buildPortablePrompt(appLocale()));
  ipcMain.handle('journal:generate', async () => {
    const store = await readStore(journalPath());
    // 把已知长期记忆当背景喂进去，让小结越来越懂用户（记忆对用户隐藏，只在后台起作用）
    const res = await generateGrowthSummary({
      locale: appLocale(),
      memory: (store.memory || []).map((m) => m.text),
      // 已在追踪的待办里，别把「今天待刷新的 AI 待办」算进去（那批会被替换），只把要保留的当背景喂给 AI 别重复
      openTodos: (store.todos || []).filter((t) => !t.done && !(t.from === 'ai' && t.day === todayKey())).map((t) => t.text),
      fed: pendingFedTexts(store), // 拖进来的内容和当天对话一起分析
    });
    if (!res.ok) return res;
    const date = todayKey();
    // 消化完就清掉投喂队列，别下次再分析一遍
    const merged = clearFed(mergeGeneration(store, date, res.parsed, { tools: res.tools, count: res.count, at: Date.now() }));
    await writeStore(journalPath(), merged);
    return { ok: true, date, store: merged };
  });
  ipcMain.handle('journal:saveLists', async (_e, lists) => {
    const store = await readStore(journalPath());
    if (Array.isArray(lists && lists.todos)) store.todos = lists.todos;
    if (Array.isArray(lists && lists.memory)) store.memory = lists.memory;
    await writeStore(journalPath(), store);
    return { ok: true };
  });
  ipcMain.on('app:quit', () => app.quit());
  ipcMain.handle('autolaunch:get', () => {
    return autoLaunchEnabled();
  });
  ipcMain.handle('autolaunch:set', (_e, on) => setAutoLaunch(on));
  ipcMain.handle('window:getPos', (e) => BrowserWindow.fromWebContents(e.sender)?.getPosition() || [0, 0]);
  ipcMain.on('window:setPos', (e, x, y) => {
    BrowserWindow.fromWebContents(e.sender)?.setPosition(Math.round(x), Math.round(y));
  });
  // 收起态拖完松手：吸到最近的那条边，并记住这一边
  ipcMain.on('window:snapEdge', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w || !collapsed) return;
    const b = w.getBounds();
    const wa = screen.getDisplayNearestPoint(b).workArea;
    dockSide = nearestEdge(b.x, b.width, wa);
    w.setBounds(dockedBounds(dockSide, PEEK, b.y, wa));
  });
  ipcMain.on('window:setCollapsed', (e, next) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) {
      collapsed = !!next; // 注意别用 collapsed 当参数名，会遮住上面的模块变量
      setCollapsed(w, collapsed);
    }
  });
  // 打包后首次运行默认开启开机自启（用户可在菜单里关掉）
  if (app.isPackaged && autoLaunchSupported) {
    try {
      if (!app.getLoginItemSettings().wasOpenedAtLogin) {
        app.setLoginItemSettings({ openAtLogin: true });
      }
    } catch { /* 平台不支持则跳过 */ }
  }
  createWindow();
  initializeUpdates();
  createTray();
  updateController.start();
  screen.on('display-added', ensureSpriteVisible);
  screen.on('display-removed', ensureSpriteVisible);
  screen.on('display-metrics-changed', ensureSpriteVisible);
  powerMonitor.on('resume', ensureSpriteVisible);
  if (process.platform === 'darwin') app.dock.hide();
  app.on('activate', () => {
    recallSprite();
  });
});

app.on('before-quit', () => updateController.dispose());
app.on('window-all-closed', () => app.quit());

app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch {}
});
