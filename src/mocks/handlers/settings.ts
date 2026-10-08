import { http, HttpResponse } from 'msw';
import { users } from '../data';
import { getCurrentUser } from './auth';

export const settingsHandlers = [
  http.get('/api/users/profile', () => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { password: _, ...safeUser } = user;
    return HttpResponse.json(safeUser);
  }),

  http.put('/api/users/profile', async ({ request }) => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      Object.assign(users[idx], body);
    }
    return HttpResponse.json({ ...user, ...body });
  }),

  http.put('/api/users/password', async ({ request }) => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json() as { currentPassword: string; newPassword: string };
    // In MySQL auth mode the password lives in MySQL, not in this mock, so it
    // cannot be verified here — say so rather than rejecting a correct password.
    if (user.password === undefined) {
      return HttpResponse.json(
        { error: 'Password changes are handled by the account server.' },
        { status: 400 },
      );
    }
    if (body.currentPassword !== user.password) {
      return HttpResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const idx = users.findIndex(u => u.id === user.id);
    if (idx !== -1) {
      users[idx].password = body.newPassword;
    }
    return HttpResponse.json({ success: true });
  }),
];
