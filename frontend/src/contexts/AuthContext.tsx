import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER' | 'STUDENT';
  studentId?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
      localStorage.setItem('elt-cert-user', JSON.stringify(res.data));
    } catch (err) {
      console.error('Refresh user error:', err);
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('elt-cert-token');
    const savedUser = localStorage.getItem('elt-cert-user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      // Validate token
      api.get('/auth/me').then(res => {
        setUser(res.data);
        localStorage.setItem('elt-cert-user', JSON.stringify(res.data));
      }).catch(() => {
        localStorage.removeItem('elt-cert-token');
        localStorage.removeItem('elt-cert-user');
        setToken(null);
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { user: userData, token: userToken } = res.data;
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('elt-cert-token', userToken);
    localStorage.setItem('elt-cert-user', JSON.stringify(userData));
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    setUser(null);
    setToken(null);
    localStorage.removeItem('elt-cert-token');
    localStorage.removeItem('elt-cert-user');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      logout, 
      isAdmin: user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'VIEWER',
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
