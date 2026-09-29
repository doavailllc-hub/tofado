import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import axios from 'axios';
let token, refresh, version = 0, adapter;
const storage = {
  clearSession: async () => { version++; token = refresh = null; },
  getToken: async () => token,
  getRefreshToken: async () => refresh,
  getSessionVersion: () => version,
  saveSession: async (next, user, nextRefresh, expected) => {
    if (expected !== version) return false;
    token = next; refresh = nextRefresh; return true;
  },
};
globalThis.__mobileTestStore = storage;
process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:9999/api';
axios.defaults.adapter = config => adapter(config);
let source = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8');
source = source.replace('from "axios"', 'from "' + import.meta.resolve('axios') + '"')
  .replace(/import \{[\s\S]*?\} from "\.\/tokenStore";/, 'const { clearSession, getRefreshToken, getToken, getSessionVersion, saveSession } = globalThis.__mobileTestStore;');
const { default: api, setSessionExpiredHandler } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const ok = (config, data) => ({ status: 200, data, config, headers: {} });
const fail = (config, status) => Promise.reject(new axios.AxiosError('Failed', 'ERR_BAD_RESPONSE', config, null, { status, data: {}, config }));
function seed() { version++; token = 'expired'; refresh = 'refresh1'; }
test('mobile startup refreshes auth/me with a bounded timeout', async () => {
  seed(); let refreshes = 0;
  adapter = async config => {
    if (config.url.endsWith('/auth/refresh')) { refreshes++; assert.equal(config.timeout, 15000); return ok(config, { token: 'valid', refresh_token: 'refresh2', user: { id: 1 } }); }
    return config.headers.Authorization === 'Bearer valid' ? ok(config, { id: 1 }) : fail(config, 401);
  };
  assert.equal((await api.get('/auth/me')).data.id, 1); assert.equal(refreshes, 1);
});
test('mobile transient failures preserve login but revoked refresh clears it', async () => {
  seed();
  adapter = config => fail(config, config.url.endsWith('/auth/refresh') ? 503 : 401);
  await assert.rejects(api.get('/auth/me'), error => error.response.status === 503);
  assert.equal(refresh, 'refresh1');
  let expired = 0; setSessionExpiredHandler(() => expired++);
  adapter = config => fail(config, 401);
  await assert.rejects(api.get('/auth/me'));
  assert.equal(refresh, null); assert.equal(expired, 1);
});
test('mobile logout during a refresh does not restore credentials', async () => {
  seed(); let release;
  adapter = config => config.url.endsWith('/auth/refresh')
    ? new Promise(resolve => { release = () => resolve(ok(config, { token: 'valid', refresh_token: 'refresh2', user: { id: 1 } })); })
    : fail(config, 401);
  const request = api.get('/auth/me');
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  await storage.clearSession(); release();
  await assert.rejects(request); assert.equal(token, null);
});
