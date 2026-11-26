import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/endpoints';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('relaydesk_token');
    if (!token) {
      setLoading(false);
      return;
    }

    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => {
        localStorage.removeItem('relaydesk_token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    localStorage.setItem('relaydesk_token', res.token);
    setUser(res.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await authApi.register(name, email, password);
    localStorage.setItem('relaydesk_token', res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('relaydesk_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
