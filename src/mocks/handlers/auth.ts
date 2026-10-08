import { http, HttpResponse } from 'msw';
import { users } from '../data';
import { passwordPolicyError } from '../../utils/passwordPolicy';
import type { UserRole } from '../../types';

/** The fields the mocked data routes actually need from the signed-in user. */
export interface SessionUser {
  id: number;
  name: string;
  email?: string;
  role: UserRole;
  /** Present only for the bundled demo accounts (`src/mocks/data.ts`). */
  password?: string;
}

/**
 * The signed-in user for the mocked data routes.
 *
 * Normally set by the mock login/register handlers below. When
 * `VITE_AUTH_BACKEND=mysql` those handlers are not registered at all (auth goes
 * to the real API in `server/`), so nothing would ever assign this variable and
 * every filtered route would answer 401. The fallback reads the session the app
 * itself persisted — the same source `checkAuth()` uses on reload.
 */
let currentUser: SessionUser | null = null;

function persistedUser(): SessionUser | null {
  try {
    const saved = globalThis.localStorage?.getItem('user');
    if (!saved) return null;
    const parsed = JSON.parse(saved) as SessionUser;
    return parsed && typeof parsed.id === 'number' && parsed.role ? parsed : null;
  } catch {
    // No localStorage (node tests, SSR) or an unreadable value.
    return null;
  }
}

export const getCurrentUser = (): SessionUser | null => currentUser ?? persistedUser();
export const setCurrentUser = (user: SessionUser | null) => { currentUser = user; };

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    const email = body.email?.trim().toLowerCase() ?? '';
    const user = users.find(u => u.email.toLowerCase() === email && u.password === body.password);
    if (!user) {
      return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    currentUser = user;
    const { password: _, ...safeUser } = user;
    return HttpResponse.json({ user: safeUser, token: 'mock-jwt-token-' + user.id });
  }),

  // Client self-registration. Staff accounts (attorney, secretary, admin) are
  // provisioned by the firm through the admin team screen.
  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json() as { name?: string; email?: string; password?: string; phone?: string };
    const name = body.name?.trim() ?? '';
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';

    if (!name || !email || !password) {
      return HttpResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return HttpResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }
    if (password.length < 8) {
      return HttpResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    // The mock stands in for the real backend, so it enforces the same policy
    // as the sign-up form (see utils/passwordPolicy).
    const passwordError = passwordPolicyError(password);
    if (passwordError) {
      return HttpResponse.json({ error: passwordError }, { status: 400 });
    }
    if (users.some(u => u.email.toLowerCase() === email)) {
      return HttpResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const newUser = {
      id: Math.max(...users.map(u => u.id)) + 1,
      name,
      email,
      password,
      role: 'user' as const,
      phone: body.phone?.trim() || undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };

    users.push(newUser);
    currentUser = newUser;

    const { password: _created, ...safeUser } = newUser;
    return HttpResponse.json({ user: safeUser, token: 'mock-jwt-token-' + newUser.id }, { status: 201 });
  }),

  http.post('/api/auth/logout', () => {
    currentUser = null;
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/auth/me', () => {
    if (!currentUser) {
      return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { password: _, ...safeUser } = currentUser;
    return HttpResponse.json(safeUser);
  }),
];
