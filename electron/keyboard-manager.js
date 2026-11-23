const { spawn } = require('node:child_process');
const { app } = require('electron');
const path = require('node:path');
let activeChild;

function cancel() {
  if (activeChild) activeChild.kill();
}

function typeText(text, suffix) {
  if (process.platform !== 'win32') {
    return Promise.reject(new Error('Keyboard output is available on Windows only.'));
  }
  return new Promise((resolve, reject) => {
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const script = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'keyboard.ps1')
      : path.join(__dirname, 'keyboard.ps1');
    const child = spawn(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], {
      windowsHide: true, stdio: ['pipe', 'ignore', 'pipe']
    });
    activeChild = child;
    let error = '';
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      finish(new Error('Keyboard output timed out.'));
    }, 15000);
    function finish(err) {
      if (settled) return;
      settled = true;
      if (activeChild === child) activeChild = null;
      clearTimeout(timeout);
      if (err) reject(err); else resolve();
    }
    child.stderr.on('data', chunk => { error = (error + chunk.toString()).slice(0, 2000); });
    child.on('error', finish);
    child.stdin.on('error', () => {});
    child.on('close', code => finish(code === 0 ? null : new Error(error.trim() || 'Keyboard output failed.')));
    child.stdin.end(JSON.stringify({ text, suffix }), 'utf8');
  });
}

module.exports = { typeText, cancel };
