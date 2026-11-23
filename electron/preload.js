const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('scanner', {
  load: () => ipcRenderer.invoke('load'),
  settings: value => ipcRenderer.invoke('settings', value),
  state: value => ipcRenderer.invoke('state', value),
  scan: (value, format) => ipcRenderer.invoke('scan', value, format),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  copy: value => ipcRenderer.invoke('copy', value),
  exportHistory: () => ipcRenderer.invoke('export-history'),
  onCommand: callback => ipcRenderer.on('command', (_event, command) => callback(command))
});
