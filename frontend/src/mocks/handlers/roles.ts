/* ==========================================================================
   Roles & permissions handlers — `/api/permissions`, `/api/roles/*`
   --------------------------------------------------------------------------
   The matrix lives in `db.rolePermissions` (seeded from `ROLE_PERMISSIONS`) so
   the admin's settings screen can toggle a cell and see the change persist for
   the session — the same effect as updating `role_permissions` in Postgres.
   ========================================================================== */

import { http } from 'msw';
import { db } from '../db';
import type { Permission, RolePermission, UserRole } from '../../types';
import { PERMISSION_LABELS, ROLE_PERMISSIONS } from '../../utils/rbac';
import {
  badRequest,
  currentUser,
  forbidden,
  isUserRole,
  latency,
  notFound,
  ok,
  readJson,
  recordActivity,
  unauthorized,
} from '../utils';

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

function isMockUser(value: unknown): value is NonNullable<ReturnType<typeof currentUser>> {
  return typeof value === 'object' && value !== null && 'role' in value;
}

/** Admin-only gate for writes; reads are open to any signed-in user. */
function requireAdmin(request: Request) {
  const user = currentUser(request);
  if (!user) return unauthorized();
  if (user.role !== 'admin') return forbidden('Only the administrator may change the permission matrix.');
  return user;
}

export const roleHandlers = [
  /** `GET /permissions` — every permission the system knows. */
  http.get('/api/permissions', async ({ request }) => {
    await latency(100);
    if (!currentUser(request)) return unauthorized();
    return ok(ALL_PERMISSIONS);
  }),

  /** `GET /roles/permissions` — the whole matrix, one row per role/permission. */
  http.get('/api/roles/permissions', async ({ request }) => {
    await latency();
    if (!currentUser(request)) return unauthorized();
    return ok(db.rolePermissions);
  }),

  /** `GET /roles/:role/permissions` */
  http.get('/api/roles/:role/permissions', async ({ request, params }) => {
    await latency(120);
    if (!currentUser(request)) return unauthorized();

    const role = String(params.role);
    if (!isUserRole(role)) return notFound(`Role "${role}"`);

    const rows: Permission[] = db.rolePermissions
      .filter(entry => entry.role === role)
      .map(entry => entry.permission);
    // Fall back to the in-code matrix if the table was emptied.
    return ok(rows.length > 0 ? rows : ROLE_PERMISSIONS[role]);
  }),

  /**
   * `PUT /roles/:role/permissions` — replaces the role's grants.
   * Body: `{ permissions: Permission[] }`.
   */
  http.put('/api/roles/:role/permissions', async ({ request, params }) => {
    await latency();
    const actor = requireAdmin(request);
    if (!isMockUser(actor)) return actor;

    const role = String(params.role);
    if (!isUserRole(role)) return notFound(`Role "${role}"`);

    const body = await readJson<{ permissions: Permission[] }>(request);
    const requested = Array.isArray(body.permissions) ? body.permissions : null;
    if (!requested) return badRequest('A `permissions` array is required.');

    const unknown = requested.filter(permission => !ALL_PERMISSIONS.includes(permission));
    if (unknown.length > 0) return badRequest(`Unknown permission(s): ${unknown.join(', ')}.`);

    // Keep the admin locked out of nothing: the owner always keeps every grant.
    const effective: Permission[] =
      role === 'admin' ? ALL_PERMISSIONS : Array.from(new Set(requested));

    const stamp = new Date().toISOString();
    const others = db.rolePermissions.filter(entry => entry.role !== role);
    const updated: RolePermission[] = effective.map((permission, index) => ({
      id: (db.rolePermissions.length + 1) * 10 + index,
      role,
      permission,
      createdAt: stamp,
    }));

    db.rolePermissions.splice(0, db.rolePermissions.length, ...others, ...updated);

    recordActivity(
      actor,
      'role.update',
      `Set ${role} permissions to ${effective.length} grant(s).`,
    );
    return ok(db.rolePermissions);
  }),
];
