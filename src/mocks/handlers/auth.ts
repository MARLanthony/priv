import { http, HttpResponse } from 'msw';
import { users } from '../data';

let currentUser: typeof users[0] | null = null;

export const getCurrentUser = () => currentUser;
export const setCurrentUser = (user: typeof users[0] | null) => { currentUser = user; };

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    const user = users.find(u => u.email === body.email && u.password === body.password);
    if (!user) {
      return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    currentUser = user;
    const { password: _, ...safeUser } = user;
    return HttpResponse.json({ user: safeUser, token: 'mock-jwt-token-' + user.id });
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
