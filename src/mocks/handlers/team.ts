import { http, HttpResponse } from 'msw';
import { teamMembers, users } from '../data';
import { getCurrentUser } from './auth';
import type { TeamMember, UserRole } from '../../types';

/**
 * Team management (system admin only).
 *
 * Adding an attorney / secretary / admin here ALSO creates their sign-in account,
 * so the staff the admin provisions can actually log in. The dataset ships with
 * no staff accounts at all (see src/mocks/data.ts), which makes this handler the
 * place where a firm account is born.
 *
 * The two records are linked by email, which is unique per account:
 *   team member  → the directory card shown on the Team page
 *   user account → the credentials + role the login screen checks
 *
 * Deleting a member deletes the account too, except for the last system
 * administrator — removing that one would lock the firm out of its admin screens.
 */

/** Password given to a staff account created from the Team page. */
export const DEFAULT_STAFF_PASSWORD = 'password123';

/** The roles that can be created here: the firm's staff (clients self-register). */
const STAFF_ROLES: UserRole[] = ['system_admin', 'attorney', 'legal_secretary'];

const isStaffRole = (role: unknown): role is UserRole => STAFF_ROLES.includes(role as UserRole);
const normalizeEmail = (email: unknown) => String(email ?? '').trim().toLowerCase();
const today = () => new Date().toISOString().split('T')[0];
const nextId = (rows: { id: number }[]) => (rows.length > 0 ? Math.max(...rows.map(row => row.id)) + 1 : 1);

let teamData: TeamMember[] = [...teamMembers];

/** The sign-in account that belongs to a team member (matched by email). */
const accountFor = (email: string) => users.find(u => normalizeEmail(u.email) === email);

export const teamHandlers = [
  http.get('/api/team', () => {
    const user = getCurrentUser();
    if (!user) return HttpResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'system_admin') return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });
    return HttpResponse.json(teamData);
  }),

  http.post('/api/team', async ({ request }) => {
    const user = getCurrentUser();
    if (!user || user.role !== 'system_admin') return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json() as Partial<TeamMember>;

    if (!body.name?.trim() || !body.email?.trim()) {
      return HttpResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }
    if (!isStaffRole(body.role)) {
      return HttpResponse.json(
        { error: 'Role must be attorney, legal_secretary or system_admin' },
        { status: 400 },
      );
    }

    const email = normalizeEmail(body.email);
    if (users.some(u => normalizeEmail(u.email) === email)) {
      return HttpResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const newMember: TeamMember = {
      id: nextId(teamData),
      name: body.name.trim(),
      email,
      role: body.role,
      phone: body.phone ?? '',
      department: body.department || 'General',
      joinDate: today(),
      status: 'active',
      specialization: body.specialization || undefined,
    };
    teamData.push(newMember);

    // The sign-in account — without it the new attorney could never log in.
    users.push({
      id: nextId(users),
      name: newMember.name,
      email: newMember.email,
      role: newMember.role,
      password: DEFAULT_STAFF_PASSWORD,
      phone: newMember.phone,
      specialization: newMember.specialization,
      createdAt: newMember.joinDate,
    });

    return HttpResponse.json(newMember, { status: 201 });
  }),

  http.put('/api/team/:id', async ({ params, request }) => {
    const user = getCurrentUser();
    if (!user || user.role !== 'system_admin') return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });

    const idx = teamData.findIndex(m => m.id === Number(params.id));
    if (idx === -1) return HttpResponse.json({ error: 'Not found' }, { status: 404 });

    const previous = teamData[idx];
    const body = await request.json() as Partial<TeamMember>;

    if (body.role !== undefined && !isStaffRole(body.role)) {
      return HttpResponse.json(
        { error: 'Role must be attorney, legal_secretary or system_admin' },
        { status: 400 },
      );
    }

    const nextEmail = body.email ? normalizeEmail(body.email) : previous.email;
    const account = accountFor(previous.email);
    if (
      account &&
      nextEmail !== previous.email &&
      users.some(u => u.id !== account.id && normalizeEmail(u.email) === nextEmail)
    ) {
      return HttpResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    teamData[idx] = { ...previous, ...body, email: nextEmail };
    const updated = teamData[idx];

    // Keep the credentials in step with the directory card.
    if (account) {
      Object.assign(account, {
        name: updated.name,
        email: nextEmail,
        role: updated.role,
        phone: updated.phone,
        specialization: updated.specialization,
      });
    }

    return HttpResponse.json(updated);
  }),

  http.delete('/api/team/:id', ({ params }) => {
    const user = getCurrentUser();
    if (!user || user.role !== 'system_admin') return HttpResponse.json({ error: 'Forbidden' }, { status: 403 });

    const member = teamData.find(m => m.id === Number(params.id));
    if (!member) return HttpResponse.json({ error: 'Not found' }, { status: 404 });

    if (member.role === 'system_admin' && teamData.filter(m => m.role === 'system_admin').length <= 1) {
      return HttpResponse.json({ error: 'The last system administrator cannot be removed' }, { status: 400 });
    }

    teamData = teamData.filter(m => m.id !== member.id);

    const accountIdx = users.findIndex(u => normalizeEmail(u.email) === normalizeEmail(member.email));
    if (accountIdx !== -1) users.splice(accountIdx, 1);

    return HttpResponse.json({ success: true });
  }),
];
