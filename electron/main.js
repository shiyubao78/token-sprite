import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLocalUsage } from '../scripts/usage.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.TS_DEV_URL || '';

const FULL = { w: 236, h: 348 };
const PEEK = { w: 56, h: 104 };
let mainWin = null;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    width: FULL.w,
    height: FULL.h,
    x: workArea.x + workArea.width - FULL.w - 24,
    y: workArea.y + workArea.height - FULL.h - 24,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    webPreferences: { preload: path.join(dir, 'preload.cjs') },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(dir, '..', 'dist', 'index.html'));
  mainWin = win;
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

app.whenReady().then(() => {
  ipcMain.handle('usage:get', () => computeLocalUsage());
  ipcMain.on('app:quit', () => app.quit());
  ipcMain.handle('autolaunch:get', () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle('autolaunch:set', (_e, on) => {
    app.setLoginItemSettings({ openAtLogin: !!on });
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle('window:getPos', (e) => BrowserWindow.fromWebContents(e.sender)?.getPosition() || [0, 0]);
  ipcMain.on('window:setPos', (e, x, y) => {
    BrowserWindow.fromWebContents(e.sender)?.setPosition(Math.round(x), Math.round(y));
  });
  ipcMain.on('window:setCollapsed', (e, collapsed) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) setCollapsed(w, !!collapsed);
  });
  // 打包后首次运行默认开启开机自启（用户可在菜单里关掉）
  if (app.isPackaged && !app.getLoginItemSettings().wasOpenedAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true });
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
