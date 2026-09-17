import { create } from 'zustand';
import { User, UserRole } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Login failed');
      }
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    if (savedUser && savedToken) {
      set({ user: JSON.parse(savedUser), token: savedToken, isAuthenticated: true });
    }
  },

  clearError: () => set({ error: null }),
}));

export const getRoleBasePath = (role: UserRole): string => {
  switch (role) {
    case 'system_admin': return '/admin';
    case 'attorney': return '/attorney';
    case 'legal_secretary': return '/secretary';
    case 'user': return '/user';
  }
};
