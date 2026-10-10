import { create } from 'zustand';
import { getAuthToken, setAuthToken } from '../services/apiClient';
import * as authApi from '../services/authService';
import type { AuthCredentials, Permission, RegisterCredentials, User, UserRole } from '../types';
import { ROLE_PERMISSIONS, roleHasAnyPermission, roleHasPermission } from '../utils/rbac';

/**
 * Authentication + role state.
 *
 * The token lives in `localStorage` (owned by `apiClient`), the profile in this
 * store. `permissions` is derived from the role so components can ask
 * `hasPermission('cases.write')` without importing the RBAC matrix.
 */

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous';

export interface AuthState {
  user: User | null;
  status: AuthStatus;
  /** Set when a login/registration attempt fails, cleared on the next try. */
  error: string | null;
  permissions: Permission[];

  /** Sends credentials, stores the token and the profile. */
  login: (credentials: AuthCredentials) => Promise<User>;
  /** Creates a client account and signs it in. */
  register: (payload: RegisterCredentials) => Promise<User>;
  /** Clears the session locally and on the server. */
  logout: () => Promise<void>;
  /** Rehydrates the session from the stored token (called on boot). */
  loadSession: () => Promise<User | null>;
  /** Local profile updates (after `PUT /auth/profile` succeeded). */
  setUser: (user: User | null) => void;
  /** Clears a previous error (e.g. when the form is reopened). */
  clearError: () => void;

  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
}

function permissionsFor(user: User | null): Permission[] {
  if (!user) return [];
  // One source of truth: the matrix in `utils/rbac` (mirrored by the backend).
  return ROLE_PERMISSIONS[user.role] ?? [];
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  error: null,
  permissions: [],

  login: async (credentials) => {
    set({ status: 'loading', error: null });
    try {
      const { user } = await authApi.login(credentials);
      set({ user, status: 'authenticated', permissions: permissionsFor(user), error: null });
      return user;
    } catch (error) {
      setAuthToken(null);
      set({
        user: null,
        status: 'anonymous',
        permissions: [],
        error: error instanceof Error ? error.message : 'Login failed.',
      });
      throw error;
    }
  },

  register: async (payload) => {
    set({ status: 'loading', error: null });
    try {
      const { user } = await authApi.register(payload);
      set({ user, status: 'authenticated', permissions: permissionsFor(user), error: null });
      return user;
    } catch (error) {
      setAuthToken(null);
      set({
        user: null,
        status: 'anonymous',
        permissions: [],
        error: error instanceof Error ? error.message : 'Registration failed.',
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      setAuthToken(null);
      set({ user: null, status: 'anonymous', permissions: [], error: null });
    }
  },

  loadSession: async () => {
    const token = getAuthToken();
    if (!token) {
      set({ user: null, status: 'anonymous', permissions: [] });
      return null;
    }

    set({ status: 'loading' });
    try {
      const user = await authApi.me();
      set({ user, status: 'authenticated', permissions: permissionsFor(user) });
      return user;
    } catch {
      setAuthToken(null);
      set({ user: null, status: 'anonymous', permissions: [] });
      return null;
    }
  },

  setUser: (user) => set({ user, permissions: permissionsFor(user) }),

  clearError: () => set({ error: null }),

  hasRole: (role) => {
    const current = get().user?.role;
    if (!current) return false;
    return Array.isArray(role) ? role.includes(current) : current === role;
  },

  hasPermission: (permission) => roleHasPermission(get().user?.role, permission),

  hasAnyPermission: (permissions) => roleHasAnyPermission(get().user?.role, permissions),
}));

export { ROLE_PERMISSIONS } from '../utils/rbac';
