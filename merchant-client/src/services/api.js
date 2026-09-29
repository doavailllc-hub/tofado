import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');
const api = axios.create({ baseURL, timeout: 15000 });
const sessionApi = axios.create({ baseURL, timeout: 15000 });
let refreshPromise;
let expiredHandler = () => {};
let sessionGeneration = 0;
export const setSessionExpiredHandler = handler => { expiredHandler = handler || (() => {}); };
export function clearSession() {
  sessionGeneration++;
  for (const key of ['tofado_token', 'tofado_refresh_token', 'tofado_user']) localStorage.removeItem(key);
}
export function storeSession(data) {
  sessionGeneration++;
  localStorage.setItem('tofado_token', data.token);
  localStorage.setItem('tofado_refresh_token', data.refresh_token);
  localStorage.setItem('tofado_user', JSON.stringify(data.user));
}
export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('tofado_user') || 'null'); }
  catch { clearSession(); return null; }
}
export async function revokeSession() {
  const refresh_token = localStorage.getItem('tofado_refresh_token');
  clearSession();
  if (refresh_token) await sessionApi.post('/auth/logout', { refresh_token });
}
api.interceptors.request.use(config => {
  const token = localStorage.getItem('tofado_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  config._sessionGeneration = sessionGeneration;
  return config;
});
api.interceptors.response.use(response => response, async error => {
  const original = error.config;
  if (error.response?.status !== 401 || !original || original._sessionGeneration !== sessionGeneration) throw error;
  const path = String(original.url || '').split('?')[0];
  if (path.startsWith('/auth/') && path !== '/auth/me') throw error;
  if (original._sessionRetried) {
    clearSession(); expiredHandler(); throw error;
  }
  original._sessionRetried = true;
  try {
    if (!refreshPromise) {
      const generation = sessionGeneration;
      const refresh_token = localStorage.getItem('tofado_refresh_token');
      refreshPromise = (async () => {
        if (!refresh_token) throw error;
        const { data } = await sessionApi.post('/auth/refresh', { refresh_token });
        if (generation !== sessionGeneration) throw new axios.CanceledError('Session changed');
        // Refresh is not a new login: concurrent requests retain their generation.
        localStorage.setItem('tofado_token', data.token);
        localStorage.setItem('tofado_refresh_token', data.refresh_token);
        localStorage.setItem('tofado_user', JSON.stringify(data.user));
        return data.token;
      })().finally(() => { refreshPromise = null; });
    }
    await refreshPromise;
  } catch (refreshError) {
    if (original._sessionGeneration === sessionGeneration && [401, 403].includes(refreshError.response?.status)) {
      clearSession(); expiredHandler();
    }
    // Surface transient refresh failures as such, not as the original 401.
    throw refreshError;
  }
  return api(original);
});
export default api;
