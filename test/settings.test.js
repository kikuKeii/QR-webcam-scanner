const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { defaults, validateSettings, createStore } = require('../electron/settings-manager');

test('settings validation rejects malformed values and strips unknown fields', () => {
  assert.deepEqual(validateSettings({ ...defaults, extra: 'ignored' }), defaults);
  for (const patch of [
    { suffix: 'Escape' }, { cooldown: -1 }, { cooldown: 1.5 },
    { scanDelay: 0 }, { cameraId: 5 }, { resolution: 'bad' },
    { backgroundScanning: 'true' }
  ]) assert.throws(() => validateSettings({ ...defaults, ...patch }));
});

test('settings and scan history persist and clear locally', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webcam-scanner-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const store = createStore(dir);
  const settings = { ...defaults, suffix: 'Tab' };
  const entry = { value: 'sample', format: 'QR_CODE', timestamp: new Date().toISOString() };
  store.setSettings(settings);
  store.add(entry);
  assert.throws(() => store.add({ ...entry, format: '../invalid' }));
  assert.deepEqual(createStore(dir).get(), { settings, history: [entry] });
  store.clear();
  assert.deepEqual(createStore(dir).get().history, []);
});
