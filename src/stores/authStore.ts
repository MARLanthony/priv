import { create } from 'zustand';
import { RegisterCredentials, User, UserRole } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

/** Persists the session the same way for both login and registration. */
const persistSession = (data: { user: User; token: string }) => {
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
};

/**
 * Reads an `/api/auth/*` response defensively.
 *
 * When the API in `server/` is not running, Vite's dev proxy answers 500 with an
 * EMPTY body, so `response.json()` throws "Unexpected end of JSON input" — an
 * error that names the parser, not the problem. Reading text first lets the form
 * say what is actually wrong.
 */
async function readResponse(response: Response): Promise<{ user?: User; token?: string; error?: string }> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as { user?: User; token?: string; error?: string };
  } catch {
    return {};
  }
}

/** The message shown in the form when a request does not succeed. */
function authFailureMessage(
  response: Response,
  payload: { error?: string },
  fallback: string,
): string {
  if (payload.error) return payload.error;
  // 5xx (proxy could not reach the API) or 404 (no API at this address at all).
  if (response.status >= 500 || response.status === 404) {
    return 'The account server is not responding. Start it with `npm run api` and try again.';
  }
  return fallback;
}

/** Guards against a 2xx that carries no session, so the store never half-signs-in. */
function sessionFrom(payload: { user?: User; token?: string }): { user: User; token: string } {
  if (!payload.user || !payload.token) {
    throw new Error('The account server returned an unexpected response.');
  }
  return { user: payload.user, token: payload.token };
}

/** A network-level failure (fetch rejects) means the server was never reached. */
const isNetworkError = (error: unknown): boolean => error instanceof TypeError;

/** Shown whenever the app cannot reach the API at all. */
const UNREACHABLE = 'Cannot reach the account server. Start it with `npm run api` and try again.';

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
      const payload = await readResponse(res);
      if (!res.ok) throw new Error(authFailureMessage(res, payload, 'Login failed'));
      const session = sessionFrom(payload);
      persistSession(session);
      set({ user: session.user, token: session.token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: isNetworkError(err) ? UNREACHABLE : err.message, isLoading: false });
    }
  },

  register: async (credentials: RegisterCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const payload = await readResponse(res);
      if (!res.ok) throw new Error(authFailureMessage(res, payload, 'Registration failed'));
      const session = sessionFrom(payload);
      persistSession(session);
      set({ user: session.user, token: session.token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: isNetworkError(err) ? UNREACHABLE : err.message, isLoading: false });
    }
  },

  logout: async () => {
    // Signing out must never depend on the server: if the API is unreachable the
    // `await` would throw before the session was cleared, leaving the user stuck
    // signed in with a token they asked to drop.
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* offline — the local session is cleared below regardless */
    }
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
