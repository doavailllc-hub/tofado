import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "tofado_token";
const REFRESH_TOKEN_KEY = "tofado_refresh_token";
const USER_KEY = "tofado_user";
const INSTALL_MARKER_KEY = "tofado_install_marker_v1";

export async function ensureCurrentInstallation() {
  if (Platform.OS === "web") return;
  const marker = await AsyncStorage.getItem(INSTALL_MARKER_KEY);
  if (!marker) {
    await clearSession();
    await AsyncStorage.setItem(INSTALL_MARKER_KEY, "installed");
  }
}

function webGet(key) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function webSet(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function webRemove(key) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

async function persistSession(token, user, refreshToken) {
  if (Platform.OS === "web") {
    webSet(TOKEN_KEY, token);
    if (refreshToken) webSet(REFRESH_TOKEN_KEY, refreshToken);
    webSet(USER_KEY, JSON.stringify(user));
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getToken() {
  if (Platform.OS === "web") {
    return webGet(TOKEN_KEY);
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getRefreshToken() {
  if (Platform.OS === "web") {
    return webGet(REFRESH_TOKEN_KEY);
  }

  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function getStoredUser() {
  let value;

  if (Platform.OS === "web") {
    value = webGet(USER_KEY);
  } else {
    value = await SecureStore.getItemAsync(USER_KEY);
  }

  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function updateStoredUser(user) {
  const value = JSON.stringify(user);

  if (Platform.OS === "web") {
    webSet(USER_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(USER_KEY, value);
}

async function clearStoredSession() {
  if (Platform.OS === "web") {
    webRemove(TOKEN_KEY);
    webRemove(REFRESH_TOKEN_KEY);
    webRemove(USER_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

// Serialize writes so logout cannot race a rotating refresh token back into storage.
let sessionVersion = 0;
let mutationQueue = Promise.resolve();
export const getSessionVersion = () => sessionVersion;
function enqueue(operation) {
  const result = mutationQueue.then(operation);
  mutationQueue = result.catch(() => {});
  return result;
}
export function saveSession(token, user, refreshToken, expectedVersion) {
  const version = expectedVersion === undefined ? ++sessionVersion : expectedVersion;
  return enqueue(async () => {
    if (version !== sessionVersion) return false;
    await persistSession(token, user, refreshToken);
    return true;
  });
}
export function clearSession() {
  sessionVersion++;
  return enqueue(clearStoredSession);
}
