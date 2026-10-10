/* ==========================================================================
   Auth handlers — `/api/auth/*`
   --------------------------------------------------------------------------
   Login checks the seeded password (`password123` for every demo account) and
   hands back a `mock-token.<id>.<role>` bearer token, which is exactly the
   shape the real Flask API returns.
   ========================================================================== */

import { http } from 'msw';
import { DEMO_PASSWORD, db, newId, settingsFor } from '../db';
import type { MockUser } from '../db';
import type { AuthResponse, NotificationSettings, RegisterCredentials, User } from '../../types';
import {
  badRequest,
  conflict,
  currentUser,
  latency,
  ok,
  publicUser,
  readJson,
  tokenFor,
  unauthorized,
} from '../utils';

interface LoginBody {
  email: string;
  password: string;
}

interface PasswordBody {
  currentPassword: string;
  newPassword: string;
}

/** Creates the `clients` row that a client account is linked to. */
function attachClientProfile(user: MockUser, contact: string, address: string): void {
  db.clients.push({
    id: db.clients.length + 1,
    userId: user.id,
    fullName: user.name,
    email: user.email,
    contact,
    address,
    createdAt: new Date().toISOString(),
  });
}

export const authHandlers = [
  /** `POST /auth/login` */
  http.post('/api/auth/login', async ({ request }) => {
    await latency();
    const body = await readJson<LoginBody>(request);
    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';

    if (!email || !password) return badRequest('Email and password are required.');

    const user = db.users.find(entry => entry.email.toLowerCase() === email);
    // Same message either way: never reveal which accounts exist.
    if (!user || user.password !== password) return unauthorized('Incorrect email or password.');
    if (!user.isActive) return unauthorized('This account has been deactivated. Contact the firm.');

    const response: AuthResponse = { user: publicUser(user), token: tokenFor(user) };
    return ok(response);
  }),

  /** `POST /auth/register` — self-service sign-up always creates a client. */
  http.post('/api/auth/register', async ({ request }) => {
    await latency();
    const body = await readJson<RegisterCredentials & { password: string }>(request);
    const name = (body.name ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase();
    const password = body.password ?? '';

    if (!name || !email || !password) return badRequest('Name, email and password are required.');
    if (password.length < 6) return badRequest('The password must be at least 6 characters.');
    if (db.users.some(entry => entry.email.toLowerCase() === email)) {
      return conflict('An account with this email already exists.');
    }

    const stamp = new Date().toISOString();
    const user: MockUser = {
      id: newId(),
      name,
      email,
      password,
      role: 'client',
      phone: body.phone,
      address: body.address,
      isActive: true,
      createdAt: stamp,
      updatedAt: stamp,
    };
    db.users.push(user);
    attachClientProfile(user, body.phone ?? '', body.address ?? '');

    const response: AuthResponse = { user: publicUser(user), token: tokenFor(user) };
    return ok(response, 201);
  }),

  /** `POST /auth/logout` — stateless in the mock. */
  http.post('/api/auth/logout', async () => {
    await latency(80);
    return ok({ success: true });
  }),

  /** `GET /auth/me` — rehydrates the session from the stored token. */
  http.get('/api/auth/me', async ({ request }) => {
    await latency(120);
    const user = currentUser(request);
    if (!user) return unauthorized();
    return ok(publicUser(user));
  }),

  /** `PUT /auth/profile` — the signed-in user edits their own details. */
  http.put('/api/auth/profile', async ({ request }) => {
    await latency();
    const user = currentUser(request);
    if (!user) return unauthorized();

    const body = await readJson<User>(request);
    // Identity fields are not editable from the profile form.
    const { id: _id, role: _role, email: _email, ...editable } = body;

    Object.assign(user, editable, { updatedAt: new Date().toISOString() });

    // Keep the linked client profile in step with the account.
    const record = db.clients.find(client => client.userId === user.id);
    if (record) {
      record.fullName = user.name;
      record.contact = user.phone ?? record.contact;
      record.address = user.address ?? record.address;
    }

    return ok(publicUser(user));
  }),

  /** `POST /auth/password` */
  http.post('/api/auth/password', async ({ request }) => {
    await latency();
    const user = currentUser(request);
    if (!user) return unauthorized();

    const body = await readJson<PasswordBody>(request);
    const current = body.currentPassword ?? '';
    const next = body.newPassword ?? '';

    if (user.password !== current) return badRequest('The current password is incorrect.');
    if (next.length < 6) return badRequest('The new password must be at least 6 characters.');

    user.password = next;
    user.updatedAt = new Date().toISOString();
    return ok({ success: true });
  }),

  /** `GET /auth/settings` — notification preferences. */
  http.get('/api/auth/settings', async ({ request }) => {
    await latency(120);
    const user = currentUser(request);
    if (!user) return unauthorized();
    return ok(settingsFor(user.id));
  }),

  /** `PUT /auth/settings` — `settingsFor` returns the stored object, so the merge persists. */
  http.put('/api/auth/settings', async ({ request }) => {
    await latency(150);
    const user = currentUser(request);
    if (!user) return unauthorized();

    const body = await readJson<NotificationSettings>(request);
    const merged = Object.assign(settingsFor(user.id), body);
    return ok(merged);
  }),
];

/** The demo credentials shown on the sign-in screen. */
export const DEMO_ACCOUNTS = (['admin', 'lawyer', 'staff', 'client'] as const).map(role => ({
  role,
  email: `${role}@jurisflow.com`,
  password: DEMO_PASSWORD,
}));

