'use strict';

const $ = id => document.getElementById(id);
const video = $('video');
let reader = new ZXing.BrowserMultiFormatReader();
const fields = ['cameraId', 'resolution', 'suffix', 'preventDuplicates', 'cooldown', 'scanDelay', 'backgroundScanning', 'startWithWindows'];
const elements = { cameraId: $('camera'), ...Object.fromEntries(fields.filter(x => x !== 'cameraId').map(x => [x, $(x)])) };
let settings;
let history = [];
let stream = null;
let running = false;
let starting = false;
let generation = 0;
let timer;
let busy = false;
let lastSeen = null;

function message(text) {
  $('message').textContent = text;
  $('message').hidden = !text;
}

function renderHistory() {
  const list = $('history');
  list.replaceChildren();
  $('last').textContent = history[0]?.value || 'No scans yet';
  if (!history.length) {
    const item = document.createElement('li');
    item.textContent = 'No scans yet.';
    list.append(item);
  }
  for (const entry of history) {
    const item = document.createElement('li');
    const info = document.createElement('div');
    const value = document.createElement('strong');
    const detail = document.createElement('small');
    const copy = document.createElement('button');
    value.textContent = entry.value;
    detail.textContent = `${entry.format} · ${new Date(entry.timestamp).toLocaleString()}`;
    copy.textContent = 'Copy';
    copy.addEventListener('click', () => window.scanner.copy(entry.value).catch(error => message(error.message)));
    info.append(value, detail);
    item.append(info, copy);
    list.append(item);
  }
}

async function cameras() {
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
  const select = elements.cameraId;
  select.replaceChildren(new Option('Default camera', ''));
  devices.forEach((device, index) => select.add(new Option(device.label || `Camera ${index + 1}`, device.deviceId)));
  if (settings.cameraId && !devices.some(device => device.deviceId === settings.cameraId)) {
    if (running) { await stop(); message('The selected camera was disconnected.'); }
    settings.cameraId = '';
    await window.scanner.settings(settings);
  }
  select.value = settings.cameraId;
}

function updateControls() {
  $('status').textContent = running ? 'Scanning' : starting ? 'Starting…' : 'Stopped';
  $('status').classList.toggle('active', running);
  $('start').disabled = running || starting;
  $('stop').disabled = !running && !starting;
  elements.cameraId.disabled = starting;
  elements.resolution.disabled = starting;
  video.classList.toggle('active', running);
  $('placeholder').hidden = running;
}

async function stop() {
  ++generation;
  running = false;
  starting = false;
  clearTimeout(timer);
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  video.srcObject = null;
  reader = new ZXing.BrowserMultiFormatReader();
  lastSeen = null;
  updateControls();
  await window.scanner.state(false);
}

async function start() {
  if (running || starting) return;
  const current = ++generation;
  starting = true;
  updateControls();
  message('');
  try {
    const [width, height] = settings.resolution.split('x').map(Number);
    const acquired = await navigator.mediaDevices.getUserMedia({
      audio: false, video: { ...(settings.cameraId ? { deviceId: { exact: settings.cameraId } } : {}), width: { ideal: width }, height: { ideal: height } }
    });
    if (current !== generation) { acquired.getTracks().forEach(track => track.stop()); return; }
    stream = acquired;
    acquired.getVideoTracks()[0].addEventListener('ended', () => {
      if (stream === acquired) stop().then(() => message('Camera disconnected or access was lost.')).catch(error => message(error.message));
    });
    video.srcObject = stream;
    await video.play();
    if (current !== generation) return;
    running = true;
    await window.scanner.state(true);
    if (current !== generation) return;
    updateControls();
    await cameras();
    if (current === generation && running) loop(current);
  } catch (error) {
    if (current === generation) {
      await stop();
      message(`Could not start camera: ${error.message}`);
    }
  } finally {
    if (current === generation) {
      starting = false;
      updateControls();
    }
  }
}

async function loop(current) {
  if (!running || current !== generation) return;
  let result;
  try {
    if (video.readyState >= 2 && video.videoWidth) result = reader.decode(video);
  } catch (error) {
    if (!(error instanceof ZXing.NotFoundException) && !(error instanceof ZXing.ChecksumException) && !(error instanceof ZXing.FormatException)) {
      await stop();
      message(`Decoder error: ${error.message}`);
      return;
    }
  }
  const now = Date.now();
  if (result) {
    const value = result.getText();
    const format = ZXing.BarcodeFormat[result.getBarcodeFormat()];
    const same = lastSeen && lastSeen.value === value && lastSeen.format === format;
    const allowed = !settings.preventDuplicates || !same || now - lastSeen.sent >= settings.cooldown;
    if (!same) lastSeen = { value, format, sent: 0, seen: now };
    lastSeen.seen = now;
    if (allowed && !busy && value) {
      lastSeen.sent = now;
      busy = true;
      try {
        const entry = await window.scanner.scan(value, format);
        history.unshift(entry);
        history = history.slice(0, 500);
        renderHistory();
        $('feedback').textContent = '✓ Scan sent';
        setTimeout(() => { $('feedback').textContent = ''; }, 2000);
      } catch (error) {
        if (current === generation) { await stop(); message(`Keyboard output failed: ${error.message}`); }
      } finally { busy = false; }
    }
  } else if (lastSeen && now - lastSeen.seen > Math.max(1000, settings.scanDelay * 3)) {
    lastSeen = null;
  }
  if (running && current === generation) timer = setTimeout(() => loop(current), settings.scanDelay);
}

async function saveSettings() {
  const next = {};
  for (const field of fields) {
    const element = elements[field];
    next[field] = element.type === 'checkbox' ? element.checked : element.type === 'number' ? Number(element.value) : element.value;
  }
  try {
    const restart = running && (next.cameraId !== settings.cameraId || next.resolution !== settings.resolution);
    settings = await window.scanner.settings(next);
    message('');
    if (restart) { await stop(); await start(); }
  } catch (error) {
    message(`Invalid settings: ${error.message}`);
    setFields();
  }
}

function setFields() {
  for (const field of fields) {
    if (elements[field].type === 'checkbox') elements[field].checked = settings[field];
    else elements[field].value = settings[field];
  }
}

async function init() {
  const data = await window.scanner.load();
  settings = data.settings;
  history = data.history;
  setFields();
  await cameras();
  renderHistory();
  for (const field of fields) elements[field].addEventListener('change', saveSettings);
  $('start').addEventListener('click', () => start());
  $('stop').addEventListener('click', () => stop().catch(error => message(error.message)));
  $('clear').addEventListener('click', async () => {
    try { await window.scanner.clearHistory(); history = []; renderHistory(); } catch (error) { message(error.message); }
  });
  $('export').addEventListener('click', () => window.scanner.exportHistory().catch(error => message(error.message)));
  navigator.mediaDevices.addEventListener('devicechange', () => cameras().catch(error => message(error.message)));
  window.scanner.onCommand(command => {
    if (command === 'start') start();
    if (command === 'stop') stop().catch(error => message(error.message));
  });
}

init().catch(error => message(`Initialization failed: ${error.message}`));
