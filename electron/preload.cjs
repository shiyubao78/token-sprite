const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tokenSprite', {
  getUsage: () => ipcRenderer.invoke('usage:get'),
  openJournal: () => ipcRenderer.send('journal:open'),
  journalList: () => ipcRenderer.invoke('journal:list'),
  journalGenerate: () => ipcRenderer.invoke('journal:generate'),
  quit: () => ipcRenderer.send('app:quit'),
  getAutoLaunch: () => ipcRenderer.invoke('autolaunch:get'),
  setAutoLaunch: (on) => ipcRenderer.invoke('autolaunch:set', on),
  getAutoLaunchSupported: () => ipcRenderer.invoke('autolaunch:supported'),
  platform: process.platform,
  getWindowPos: () => ipcRenderer.invoke('window:getPos'),
  setWindowPos: (x, y) => ipcRenderer.send('window:setPos', x, y),
  setCollapsed: (collapsed) => ipcRenderer.send('window:setCollapsed', collapsed),
  onRecall: (callback) => ipcRenderer.on('window:recalled', callback),
});
