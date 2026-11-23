const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, clipboard, nativeImage, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs/promises');
const { createStore } = require('./settings-manager');
const { typeText, cancel } = require('./keyboard-manager');

let window;
let tray;
let store;
let scanning = false;
let typing = false;
let quitting = false;
const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
app.on('second-instance', () => {
  if (window) { window.show(); window.focus(); }
});

function command(value) {
  if (window && !window.isDestroyed()) window.webContents.send('command', value);
}

function updateTray() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open scanner', click: () => { window.show(); window.focus(); } },
    { label: scanning ? 'Stop scanning' : 'Start scanning', click: () => command(scanning ? 'stop' : 'start') },
    { type: 'separator' },
    { label: 'Exit', click: () => { quitting = true; app.quit(); } }
  ]));
}

function validSender(event) {
  return window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame.url === pathToFileURL(path.join(__dirname, '../src/index.html')).href;
}

function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!validSender(event)) throw new Error('Unauthorized request.');
    return fn(...args);
  });
}

if (hasLock) app.whenReady().then(() => {
  store = createStore(app.getPath('userData'));
  session.defaultSession.setPermissionCheckHandler((webContents, permission, _origin, details) =>
    webContents === window?.webContents && permission === 'media' && details?.mediaType !== 'audio');
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(webContents === window?.webContents && permission === 'media' &&
      details.mediaTypes?.every(type => type === 'video'));
  });
  window = new BrowserWindow({
    width: 1100, height: 800, minWidth: 760, minHeight: 600,
    title: 'Webcam Keyboard Scanner',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, backgroundThrottling: false
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.on('minimize', event => {
    event.preventDefault();
    if (!store.get().settings.backgroundScanning) command('stop');
    window.hide();
  });
  window.on('close', event => {
    if (!quitting) {
      event.preventDefault();
      if (!store.get().settings.backgroundScanning) command('stop');
      window.hide();
    }
  });
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, '../src/assets/tray.png')));
  tray.setToolTip('Webcam Keyboard Scanner');
  tray.on('double-click', () => { window.show(); window.focus(); });
  updateTray();
  handle('load', () => store.get());
  handle('settings', settings => {
    const result = store.setSettings(settings);
    if (process.platform === 'win32' && app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: result.startWithWindows, path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath });
    }
    return result;
  });
  handle('state', value => {
    if (typeof value !== 'boolean') throw new Error('Invalid scanner state.');
    scanning = value;
    if (!value) cancel();
    updateTray();
  });
  handle('scan', async (value, format) => {
    if (!scanning || typing) throw new Error('Scanner is stopped or keyboard output is busy.');
    if (typeof value !== 'string' || value.length === 0 || value.length > 2048 ||
        typeof format !== 'string' || !/^[A-Z0-9_]{1,40}$/.test(format)) throw new Error('Invalid scan.');
    typing = true;
    try {
      await typeText(value, store.get().settings.suffix);
      const entry = { value, format, timestamp: new Date().toISOString() };
      store.add(entry);
      return entry;
    } finally { typing = false; }
  });
  handle('clear-history', () => store.clear());
  handle('copy', value => {
    if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid value.');
    clipboard.writeText(value);
  });
  handle('export-history', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(window, { defaultPath: 'scan-history.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (canceled || !filePath) return false;
    const quote = value => {
      const text = String(value);
      return `"${(/^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
    };
    const rows = store.get().history.map(entry => [entry.value, entry.format, entry.timestamp].map(quote).join(','));
    await fs.writeFile(filePath, '\ufeffValue,Format,Timestamp\r\n' + rows.join('\r\n'), 'utf8');
    return true;
  });
  window.loadFile(path.join(__dirname, '../src/index.html'));
});

app.on('before-quit', () => { quitting = true; cancel(); });
