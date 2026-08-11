import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  screen,
  shell,
  Tray,
} from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLocalUsage } from '../scripts/usage.mjs';
import { generateGrowthSummary, readJournal, saveEntry, todayKey } from '../scripts/growth.mjs';
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
    webPreferences: { preload: path.join(dir, 'preload.cjs') },
  });
  journalWin.removeMenu?.();
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

// 收起=贴右边缘缩成探头；展开=还原全尺寸，都保持当前竖直位置
function setCollapsed(win, collapsed) {
  const wa = screen.getDisplayNearestPoint(win.getBounds()).workArea;
  const size = collapsed ? PEEK : FULL;
  const cur = win.getBounds();
  const y = Math.min(Math.max(cur.y, wa.y), wa.y + wa.height - size.h);
  const x = wa.x + wa.width - size.w;
  win.setBounds({ x, y, width: size.w, height: size.h });
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
  // 开机自启：macOS / Windows 原生支持；Linux 用 XDG autostart，个别桌面环境可能不生效
  const autoLaunchSupported = process.platform === 'darwin' || process.platform === 'win32';
  ipcMain.handle('autolaunch:supported', () => autoLaunchSupported);
  ipcMain.handle('usage:get', () => computeLocalUsage());
  ipcMain.on('journal:open', () => openJournalWindow());
  ipcMain.handle('journal:list', () => readJournal(journalPath()));
  ipcMain.handle('journal:generate', async () => {
    const res = await generateGrowthSummary({ locale: appLocale() });
    if (!res.ok) return res;
    const date = todayKey();
    const entry = { text: res.text, tools: res.tools, count: res.count, at: Date.now() };
    await saveEntry(journalPath(), date, entry);
    return { ok: true, date, entry };
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
  ipcMain.on('window:setCollapsed', (e, collapsed) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) {
      collapsed = !!collapsed;
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
