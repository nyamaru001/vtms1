import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const ROLE_HOME = {
  OFFICER: '/officer',
  DRIVER: '/driver',
  TRANSPORT_OFFICER: '/transport',
  R3: '/r3',
  HPMU: '/hpmu',
  ADMIN: '/admin',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('vtms_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('vtms_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((res) => {
        setUser(res.data);
        localStorage.setItem('vtms_user', JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem('vtms_token');
        localStorage.removeItem('vtms_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('vtms_token', res.data.token);
    localStorage.setItem('vtms_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('vtms_token');
    localStorage.removeItem('vtms_user');
    localStorage.removeItem('vtms_training_token');
    localStorage.removeItem('vtms_training_portal');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, roleHome: user ? ROLE_HOME[user.role] : '/login' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
