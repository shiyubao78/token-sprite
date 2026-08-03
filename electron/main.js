import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLocalUsage } from '../scripts/usage.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.TS_DEV_URL || '';

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const w = 280;
  const h = 420;
  const win = new BrowserWindow({
    width: w,
    height: h,
    x: workArea.x + workArea.width - w - 24,
    y: workArea.y + workArea.height - h - 24,
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
