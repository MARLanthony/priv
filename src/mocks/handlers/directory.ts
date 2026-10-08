import { http, HttpResponse } from 'msw';
import { users } from '../data';
import { getCurrentUser } from './auth';
import type { UserRole } from '../../types';

/**
 * Read-only people pickers for the create forms.
 *
 * The dataset ships empty (see src/mocks/data.ts), so nothing may be hard-coded
 * into a form: a case has to be assigned to a real attorney and linked to a real
 * client, and an appointment/office-hours slot has to belong to a real attorney.
 * These two endpoints expose exactly the fields a picker needs — never a password
 * and never a phone number.
 *
 *   GET /api/attorneys   any signed-in user (clients pick one when booking)
 *   GET /api/clients     staff only (filing a case or booking on their behalf)
 */

/** Roles allowed to read the client list. */
const STAFF_ROLES: UserRole[] = ['system_admin', 'attorney', 'legal_secretary'];

export const directoryHandlers = [
  http.get('/api/attorneys', () => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const attorneys = users
      .filter(u => u.role === 'attorney')
      .map(u => ({ id: u.id, name: u.name, specialization: u.specialization || 'General Practice' }));

    return HttpResponse.json(attorneys);
  }),

  http.get('/api/clients', () => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!STAFF_ROLES.includes(user.role)) {
      return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const clients = users
      .filter(u => u.role === 'user')
      .map(u => ({ id: u.id, name: u.name, email: u.email ?? '' }));

    return HttpResponse.json(clients);
  }),
];
