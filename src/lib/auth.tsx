import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from './api';

interface User {
  id: string;
  email: string;
  name: string | null;
  role?: string;
  plan?: string;
  twoFactorEnabled?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  /** Profil degisikliklerini (ad, e-posta, 2FA) ve yeni oturum jetonunu uygular. */
  updateUser: (patch: Partial<User>, token?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  updateUser: () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const res = await api.get('/auth/me');
    setUser(res.data);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await refreshMe();
        } catch (error: any) {
          // Yalnizca sunucu jetonu reddettiyse cikis yapilir. Onceden her hata
          // (gecici ag kesintisi, 500) kullaniciyi oturumdan atiyordu.
          const status = error?.response?.status;
          if (status === 401 || status === 403 || status === 404) localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [refreshMe]);

  const login = (token: string, loggedIn: User) => {
    localStorage.setItem('token', token);
    setUser(loggedIn);
    // Rol/plan/2FA gibi alanlar icin tam profili tazele.
    refreshMe().catch(() => {});
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (patch: Partial<User>, token?: string) => {
    if (token) localStorage.setItem('token', token);
    setUser(prev => (prev ? { ...prev, ...patch } : prev));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
