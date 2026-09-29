import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import axios from 'axios';

const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
const source = (await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8'))
  .replace("from 'axios'", "from '" + import.meta.resolve('axios') + "'")
  .replaceAll('import.meta.env', '({ PROD: false })');
let adapter;
axios.defaults.adapter = config => adapter(config);
const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const api = module.default;
const response = (config, data) => ({ status: 200, statusText: 'OK', data, config, headers: {} });
const reject = (config, status) => Promise.reject(new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, { status, config, data: {} }));
function seed() { values.clear(); module.storeSession({ token: 'expired', refresh_token: 'refresh1', user: { id: 1 } }); }

test('concurrent protected requests including auth/me refresh once and retry', async () => {
  seed(); let refreshes = 0;
  adapter = async config => {
    if (config.url === '/auth/refresh') { refreshes++; await new Promise(resolve => setTimeout(resolve, 20)); return response(config, { token: 'renewed', refresh_token: 'refresh2', user: { id: 1 } }); }
    if (config.headers.Authorization !== 'Bearer renewed') return reject(config, 401);
    return response(config, { id: 1 });
  };
  const results = await Promise.all([api.get('/auth/me'), api.get('/retailer/orders')]);
  assert.equal(results.length, 2); assert.equal(refreshes, 1);
  assert.equal(localStorage.getItem('tofado_refresh_token'), 'refresh2');
});
test('transient refresh failure preserves the session and propagates 503', async () => {
  seed();
  adapter = config => reject(config, config.url === '/auth/refresh' ? 503 : 401);
  await assert.rejects(api.get('/auth/me'), error => error.response.status === 503);
  assert.equal(localStorage.getItem('tofado_refresh_token'), 'refresh1');
});
test('revoked refresh clears credentials and notifies auth context', async () => {
  seed(); let expired = 0; module.setSessionExpiredHandler(() => { expired++; });
  adapter = config => reject(config, 401);
  await assert.rejects(api.get('/auth/me'));
  assert.equal(localStorage.getItem('tofado_token'), null); assert.equal(expired, 1);
});
test('malformed cached user does not crash startup', () => {
  values.set('tofado_user', '{');
  assert.equal(module.getStoredUser(), null);
});
test('logout during refresh cannot resurrect credentials', async () => {
  seed(); let release;
  adapter = config => config.url === '/auth/refresh'
    ? new Promise(resolve => { release = () => resolve(response(config, { token: 'renewed', refresh_token: 'refresh2', user: { id: 1 } })); })
    : reject(config, 401);
  const request = api.get('/auth/me');
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  module.clearSession(); release();
  await assert.rejects(request);
  assert.equal(localStorage.getItem('tofado_token'), null);
});
