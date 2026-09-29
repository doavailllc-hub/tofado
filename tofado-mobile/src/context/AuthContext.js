import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import api, { setSessionExpiredHandler } from "../services/api";
import {
  clearSession,
  ensureCurrentInstallation,
  getRefreshToken,
  getStoredUser,
  getToken,
  saveSession,
  updateStoredUser,
} from "../services/tokenStore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const logout = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      api.post("/auth/logout", { refresh_token: refreshToken }).catch(() => {});
    }
    await clearSession();
    setSessionError("");
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  const restoreSession = useCallback(async () => {
    setBooting(true);
    setSessionError("");
    try {
      await ensureCurrentInstallation();
      const [token, storedUser] = await Promise.all([
        getToken(),
        getStoredUser(),
      ]);

      if (!token || !storedUser) {
        setUser(null);
        return;
      }

      setUser(storedUser);

      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
        await updateStoredUser(data);
      } catch (error) {
        if ([401, 403].includes(error.response?.status)) await logout();
        else setSessionError("We could not connect to your account. Check your connection and try again.");
      }
    } catch {
      setSessionError("We could not restore your account. Please try again.");
    } finally {
      setBooting(false);
    }
  }, [logout]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const googleLogin = useCallback(async (idToken, role) => {
    try {
      setSigningIn(true);
      const { data } = await api.post("/auth/google", {
        id_token: idToken,
        role,
      });
      await saveSession(data.token, data.user, data.refresh_token);
      setUser(data.user);
      return data.user;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const requestEmailCode = useCallback(async (email) => {
    const { data } = await api.post("/auth/email/request", {
      email: String(email || "").trim().toLowerCase(),
    });
    return data;
  }, []);

  const verifyEmailCode = useCallback(async (email, code, role) => {
    try {
      setSigningIn(true);
      const { data } = await api.post("/auth/email/verify", {
        email: String(email || "").trim().toLowerCase(),
        code: String(code || "").trim(),
        role,
      });
      await saveSession(data.token, data.user, data.refresh_token);
      setUser(data.user);
      return data.user;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
    await updateStoredUser(data);
    return data;
  }, []);

  const value = useMemo(
    () => ({
      user,
      booting,
      sessionError,
      restoreSession,
      signingIn,
      googleLogin,
      requestEmailCode,
      verifyEmailCode,
      logout,
      refreshUser,
    }),
    [user, booting, sessionError, restoreSession, signingIn, googleLogin, requestEmailCode, verifyEmailCode, logout, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
