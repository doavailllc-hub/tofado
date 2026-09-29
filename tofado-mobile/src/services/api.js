import axios from "axios";

import {
  clearSession,
  getRefreshToken,
  getToken,
  getSessionVersion,
  saveSession,
} from "./tokenStore";

const DEFAULT_API_BASE_URL = "https://api.tofado.com/api";

export const API_BASE_URL = String(
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

const inflightGets = new Map();
let refreshPromise = null;
let sessionExpiredHandler = null;

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = typeof handler === "function" ? handler : null;
}

api.interceptors.request.use(async (config) => {
  config._sessionVersion = getSessionVersion();
  const token = await getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.data && typeof error.response.data === "string") {
      error.response.data = { message: "The server returned an unexpected response." };
    }

    const original = error.config;
    const canRefresh =
      error.response?.status === 401 &&
      original &&
      original._sessionVersion === getSessionVersion() &&
      !original._sessionRetried &&
      (!String(original.url || "").includes("/auth/") || String(original.url).split("?")[0] === "/auth/me");

    if (canRefresh) {
      original._sessionRetried = true;
      try {
        if (!refreshPromise) {
          const version = getSessionVersion();
          refreshPromise = (async () => {
            const refreshToken = await getRefreshToken();
            if (!refreshToken) throw error;
            const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refresh_token: refreshToken,
            }, { timeout: 15000 });
            const saved = await saveSession(data.token, data.user, data.refresh_token, version);
            if (!saved) throw new axios.CanceledError("Session changed");
            return data.token;
          })().finally(() => {
            refreshPromise = null;
          });
        }
        const token = await refreshPromise;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshError) {
        if (original._sessionVersion === getSessionVersion() && [401, 403].includes(refreshError.response?.status)) {
          await clearSession();
          sessionExpiredHandler?.();
        }
        return Promise.reject(refreshError);
      }
    }
    if (error.response?.status === 401 && original?._sessionRetried && original._sessionVersion === getSessionVersion()) {
      await clearSession();
      sessionExpiredHandler?.();
    }
    return Promise.reject(error);
  }
);

export async function getOnce(url, config = {}) {
  const key = `${getSessionVersion()}:${url}:${JSON.stringify(config.params || {})}`;
  if (inflightGets.has(key)) return inflightGets.get(key);
  const request = api.get(url, config).finally(() => inflightGets.delete(key));
  inflightGets.set(key, request);
  return request;
}

export default api;
