import { createContext, useContext, useEffect, useState } from 'react';
import api, { getStoredUser, revokeSession, setSessionExpiredHandler, storeSession } from '../services/api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const saveSession = data => { storeSession(data); setUser(data.user); setSessionError(''); return data.user; };
  const requestEmailCode = async email => (await api.post('/auth/email/request', { email: String(email || '').trim().toLowerCase() })).data;
  const verifyEmailCode = async (email, code, role) => {
    setLoading(true);
    try { return saveSession((await api.post('/auth/email/verify', { email: String(email || '').trim().toLowerCase(), code: String(code || '').trim(), role: role || undefined })).data); }
    finally { setLoading(false); }
  };
  const googleLogin = async (idToken, role) => {
    setLoading(true);
    try { return saveSession((await api.post('/auth/google', { id_token: idToken, role: role || undefined })).data); }
    finally { setLoading(false); }
  };
  const logout = () => { revokeSession().catch(() => {}); setUser(null); setSessionError(''); };
  const restoreSession = async () => {
    setBooting(true); setSessionError('');
    try {
      if (!getStoredUser()) { setUser(null); return; }
      const { data } = await api.get('/auth/me');
      setUser(data); localStorage.setItem('tofado_user', JSON.stringify(data));
    } catch (error) {
      if ([401, 403].includes(error.response?.status)) logout();
      else setSessionError('We could not connect to your account. Check your connection and try again.');
    } finally { setBooting(false); }
  };
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    restoreSession();
    return () => setSessionExpiredHandler(null);
  }, []);
  return <AuthContext.Provider value={{ user, requestEmailCode, verifyEmailCode, googleLogin, logout, loading, booting, sessionError, restoreSession }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
