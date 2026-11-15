import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, setStoredToken } from '../lib/api.ts';
import type { OrganizationType, User } from '../types.ts';

interface SignupInput {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  organizationType: OrganizationType;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (data: SignupInput) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: User }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<User> => {
    const data = await apiFetch<{ user: User; token?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const signup = async (payload: SignupInput): Promise<User> => {
    const data = await apiFetch<{ user: User; token?: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.token) setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await apiFetch<{ message: string }>('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, logout, refreshUser, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
