const fs = require('node:fs');
const path = require('node:path');

const defaults = Object.freeze({
  cameraId: '', resolution: '1280x720', suffix: 'Enter',
  preventDuplicates: true, cooldown: 3000, scanDelay: 250,
  backgroundScanning: true, startWithWindows: false
});

function validateSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings) ||
      typeof settings.cameraId !== 'string' || settings.cameraId.length > 1024 ||
      !['640x480', '1280x720', '1920x1080'].includes(settings.resolution) ||
      !['Enter', 'Tab', 'None'].includes(settings.suffix) ||
      typeof settings.preventDuplicates !== 'boolean' ||
      !Number.isInteger(settings.cooldown) || settings.cooldown < 250 || settings.cooldown > 600000 ||
      !Number.isInteger(settings.scanDelay) || settings.scanDelay < 100 || settings.scanDelay > 10000 ||
      typeof settings.backgroundScanning !== 'boolean' ||
      typeof settings.startWithWindows !== 'boolean') throw new Error('Invalid settings.');
  return Object.fromEntries(Object.keys(defaults).map(key => [key, settings[key]]));
}

function createStore(directory) {
  const file = path.join(directory, 'scanner-data.json');
  let state = { settings: { ...defaults }, history: [] };
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    state.settings = validateSettings({ ...defaults, ...saved.settings });
    if (Array.isArray(saved.history)) {
      state.history = saved.history.filter(validEntry).slice(0, 500);
    }
  } catch { /* Start with defaults if the file is absent or invalid. */ }
  function save() {
    fs.mkdirSync(directory, { recursive: true });
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(temp, file);
  }
  return {
    get: () => structuredClone(state),
    setSettings(settings) { state.settings = validateSettings(settings); save(); return state.settings; },
    add(entry) { if (!validEntry(entry)) throw new Error('Invalid scan.'); state.history.unshift(entry); state.history = state.history.slice(0, 500); save(); },
    clear() { state.history = []; save(); }
  };
}

function validEntry(entry) {
  return entry && typeof entry === 'object' &&
    typeof entry.value === 'string' && entry.value.length > 0 && entry.value.length <= 2048 &&
    typeof entry.format === 'string' && /^[A-Z0-9_]{1,40}$/.test(entry.format) &&
    typeof entry.timestamp === 'string' && Number.isFinite(Date.parse(entry.timestamp));
}

module.exports = { defaults, validateSettings, createStore, validEntry };
