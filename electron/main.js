import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  screen,
  Tray,
} from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLocalUsage } from '../scripts/usage.mjs';
import { createTrayMenuTemplate } from './tray-menu.js';
import { createUpdateController } from './update-controller.js';
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

function createTray() {
  if (process.platform !== 'darwin') return;
  const icon = nativeImage
    .createFromPath(path.join(app.getAppPath(), 'build', 'icon.png'))
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
  })));
  tray.on('click', recallSprite);
}

async function initializeUpdates() {
  const enabled = app.isPackaged && process.platform === 'darwin';
  if (!enabled) return;
  try {
    const updaterModule = await import('electron-updater');
    const updater = updaterModule.autoUpdater || updaterModule.default?.autoUpdater;
    if (!updater) throw new Error('electron-updater autoUpdater unavailable');
    updateController = createUpdateController({ updater, dialog, isEnabled: true });
  } catch (error) {
    console.error('自动更新初始化失败', error);
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();
else app.on('second-instance', recallSprite);

if (hasSingleInstanceLock) app.whenReady().then(() => {
  // 开机自启：macOS / Windows 原生支持；Linux 用 XDG autostart，个别桌面环境可能不生效
  const autoLaunchSupported = process.platform === 'darwin' || process.platform === 'win32';
  ipcMain.handle('autolaunch:supported', () => autoLaunchSupported);
  ipcMain.handle('usage:get', () => computeLocalUsage());
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
  await initializeUpdates();
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
