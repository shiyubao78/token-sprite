const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tokenSprite', {
  getUsage: () => ipcRenderer.invoke('usage:get'),
  quit: () => ipcRenderer.send('app:quit'),
  getAutoLaunch: () => ipcRenderer.invoke('autolaunch:get'),
  setAutoLaunch: (on) => ipcRenderer.invoke('autolaunch:set', on),
  getWindowPos: () => ipcRenderer.invoke('window:getPos'),
  setWindowPos: (x, y) => ipcRenderer.send('window:setPos', x, y),
  setCollapsed: (collapsed) => ipcRenderer.send('window:setCollapsed', collapsed),
});
