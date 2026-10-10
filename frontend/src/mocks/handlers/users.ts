/* ==========================================================================
   User handlers — `/api/users`
   --------------------------------------------------------------------------
   Account administration is the admin's job; every other role gets the
   read-only `/users/directory` slice used by the assign/pick dropdowns.
   ========================================================================== */

import { http } from 'msw';
import { newId, db } from '../db';
import type { MockUser } from '../db';
import type { ActivityLog, User, UserRole } from '../../types';
import {
  asBoolean,
  asNumber,
  asString,
  badRequest,
  conflict,
  currentUser,
  forbidden,
  latency,
  matches,
  notFound,
  ok,
  publicUser,
  query,
  readJson,
  recordActivity,
  unauthorized,
} from '../utils';

interface UserBody {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string;
  address?: string;
  specialization?: string;
  barNumber?: string;
  isActive?: boolean;
}

/** Admin-only gate; returns the admin or the error response to send back. */
function requireAdmin(request: Request): MockUser | ReturnType<typeof forbidden> {
  const user = currentUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden('Only the firm administrator may manage accounts.');
  return user;
}

function isAdmin(value: MockUser | ReturnType<typeof forbidden>): value is MockUser {
  return (value as MockUser).role === 'admin';
}

export const userHandlers = [
  /** `GET /users/directory` — active accounts only, optionally filtered by role. */
  http.get('/api/users/directory', async ({ request }) => {
    await latency(100);
    if (!currentUser(request)) return unauthorized();

    const role = query(request, 'role');
    const rows = db.users
      .filter(user => user.isActive)
      .filter(user => (role ? user.role === role : true))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(user => publicUser(user));

    return ok(rows);
  }),

  /** `GET /users?role=&isActive=&q=` */
  http.get('/api/users', async ({ request }) => {
    await latency();
    const actor = currentUser(request);
    if (!actor) return unauthorized();
    if (actor.role === 'client') return forbidden('Clients cannot browse the user directory.');

    const role = query(request, 'role');
    const activeOnly = asBoolean(query(request, 'isActive'));
    const term = query(request, 'q');

    const rows = db.users
      .filter(user => (role ? user.role === role : true))
      .filter(user => (activeOnly === undefined ? true : user.isActive === activeOnly))
      .filter(user => matches(term, user.name, user.email, user.specialization))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(user => publicUser(user));

    return ok(rows);
  }),

  /** `GET /users/:id/activity` — the audit trail shown on the user drawer. */
  http.get('/api/users/:id/activity', async ({ request, params }) => {
    await latency();
    if (!currentUser(request)) return unauthorized();

    const id = Number(params.id);
    const limit = asNumber(query(request, 'limit')) ?? 20;
    const rows: ActivityLog[] = db.activityLogs
      .filter(entry => entry.userId === id)
      .slice(0, limit);
    return ok(rows);
  }),

  /** `GET /users/:id` */
  http.get('/api/users/:id', async ({ request, params }) => {
    await latency(120);
    if (!currentUser(request)) return unauthorized();

    const id = Number(params.id);
    const user = db.users.find(entry => entry.id === id);
    if (!user) return notFound(`User #${id}`);
    return ok(publicUser(user));
  }),

  /** `POST /users` — the admin creates lawyer, staff or client accounts. */
  http.post('/api/users', async ({ request }) => {
    await latency();
    const actor = requireAdmin(request);
    if (!isAdmin(actor)) return actor;

    const body = await readJson<UserBody>(request);
    const name = asString(body.name).trim();
    const email = asString(body.email).trim().toLowerCase();
    const role = body.role;

    if (!name || !email || !role) return badRequest('Name, email and role are required.');
    if (db.users.some(entry => entry.email.toLowerCase() === email)) {
      return conflict('An account with this email already exists.');
    }

    const stamp = new Date().toISOString();
    const user: MockUser = {
      id: newId(),
      name,
      email,
      password: body.password && body.password.length >= 6 ? body.password : 'password123',
      role,
      phone: body.phone,
      address: body.address,
      specialization: body.specialization,
      barNumber: body.barNumber,
      isActive: body.isActive ?? true,
      createdAt: stamp,
      updatedAt: stamp,
    };
    db.users.push(user);

    // A client account always gets a matching row in `clients`.
    if (role === 'client') {
      db.clients.push({
        id: db.clients.length + 1,
        userId: user.id,
        fullName: user.name,
        email: user.email,
        contact: user.phone ?? '',
        address: user.address ?? '',
        createdAt: stamp,
      });
    }

    recordActivity(actor, 'user.create', `Created the ${role} account for ${name}.`);
    return ok(publicUser(user), 201);
  }),

  /** `PUT /users/:id` */
  http.put('/api/users/:id', async ({ request, params }) => {
    await latency();
    const actor = requireAdmin(request);
    if (!isAdmin(actor)) return actor;

    const id = Number(params.id);
    const user = db.users.find(entry => entry.id === id);
    if (!user) return notFound(`User #${id}`);

    const body = await readJson<UserBody>(request);
    const nextEmail = asString(body.email, user.email).trim().toLowerCase();
    if (nextEmail !== user.email && db.users.some(entry => entry.email.toLowerCase() === nextEmail)) {
      return conflict('Another account already uses this email.');
    }
    if (body.password && body.password.length < 6) {
      return badRequest('The password must be at least 6 characters.');
    }

    Object.assign(user, {
      name: asString(body.name, user.name),
      email: nextEmail,
      role: body.role ?? user.role,
      phone: body.phone ?? user.phone,
      address: body.address ?? user.address,
      specialization: body.specialization ?? user.specialization,
      barNumber: body.barNumber ?? user.barNumber,
      isActive: body.isActive ?? user.isActive,
      ...(body.password ? { password: body.password } : {}),
      updatedAt: new Date().toISOString(),
    } satisfies Partial<MockUser>);

    const record = db.clients.find(client => client.userId === user.id);
    if (record) {
      record.fullName = user.name;
      record.email = user.email;
      record.contact = user.phone ?? record.contact;
      record.address = user.address ?? record.address;
    }

    recordActivity(actor, 'user.update', `Updated the account of ${user.name}.`);
    return ok(publicUser(user));
  }),

  /** `PATCH /users/:id/status` — deactivate instead of deleting. */
  http.patch('/api/users/:id/status', async ({ request, params }) => {
    await latency();
    const actor = requireAdmin(request);
    if (!isAdmin(actor)) return actor;

    const id = Number(params.id);
    const user = db.users.find(entry => entry.id === id);
    if (!user) return notFound(`User #${id}`);

    const body = await readJson<{ isActive: boolean }>(request);
    if (user.id === actor.id && body.isActive === false) {
      return badRequest('You cannot deactivate your own account.');
    }

    user.isActive = body.isActive ?? user.isActive;
    user.updatedAt = new Date().toISOString();

    recordActivity(
      actor,
      user.isActive ? 'user.activate' : 'user.deactivate',
      `${user.isActive ? 'Activated' : 'Deactivated'} the account of ${user.name}.`,
    );
    return ok(publicUser(user));
  }),

  /** `DELETE /users/:id` */
  http.delete('/api/users/:id', async ({ request, params }) => {
    await latency();
    const actor = requireAdmin(request);
    if (!isAdmin(actor)) return actor;

    const id = Number(params.id);
    const index = db.users.findIndex(entry => entry.id === id);
    if (index === -1) return notFound(`User #${id}`);

    const [removed] = db.users.splice(index, 1);
    if (removed.id === actor.id) {
      db.users.splice(index, 0, removed);
      return badRequest('You cannot delete your own account.');
    }
    db.clients = db.clients.filter(client => client.userId !== removed.id);

    recordActivity(actor, 'user.delete', `Deleted the account of ${removed.name}.`);
    return new Response(null, { status: 204 });
  }),
];

