/* ==========================================================================
   MSW helpers
   --------------------------------------------------------------------------
   Shortcuts shared by every handler: the response envelope, error shapes, the
   bearer-token lookup and the two side effects the API performs on its own
   (writing an activity log and notifying a user).
   ========================================================================== */

import { HttpResponse, delay } from 'msw';
import type { DefaultBodyType } from 'msw';
import { db } from './db';
import type { MockUser } from './db';
import type { ActivityLog, Notification, NotificationType, User, UserRole } from '../types';

/** Simulated network latency, in milliseconds. */
export const MOCK_LATENCY = 250;

export async function latency(ms = MOCK_LATENCY): Promise<void> {
  if (ms > 0) await delay(ms);
}

/* ------------------------------------------------------------- responses */

/** Every handler returns this shape, so resolvers can `return ok(...)` directly. */
type MockResponse = HttpResponse<DefaultBodyType>;

export function ok(data: unknown, status = 200): MockResponse {
  return HttpResponse.json(data as Record<string, unknown>, { status });
}

export function error(status: number, message: string): MockResponse {
  return HttpResponse.json({ error: message }, { status });
}

export const badRequest = (message: string): MockResponse => error(400, message);
export const unauthorized = (message = 'Authentication required. Sign in to continue.'): MockResponse =>
  error(401, message);
export const forbidden = (message = 'Your role does not allow this action.'): MockResponse =>
  error(403, message);
export const notFound = (what: string): MockResponse => error(404, `${what} was not found.`);
export const conflict = (message: string): MockResponse => error(409, message);


/* ------------------------------------------------------------- the token */

/** Deterministic, human-readable token: `mock-token.<userId>.<role>`. */
export function tokenFor(user: User): string {
  return `mock-token.${user.id}.${user.role}`;
}

/** Strips the password before a user record leaves the API. */
export function publicUser(user: MockUser): User {
  const { password: _password, ...safe } = user;
  return safe;
}

function readToken(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? request.headers.get('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** The signed-in user behind the request, or `null` when the token is bad. */
export function currentUser(request: Request): MockUser | null {
  const token = readToken(request);
  if (!token) return null;

  const id = Number(token.split('.')[1]);
  if (!Number.isFinite(id)) return null;

  const user = db.users.find(entry => entry.id === id);
  if (!user || !user.isActive) return null;
  return user;
}

/** The linked `clients` row of a client user (the API's per-client scoping). */
export function clientRecordFor(user: User) {
  return db.clients.find(client => client.userId === user.id) ?? null;
}

export function displayName(userId: number | null | undefined): string | undefined {
  if (userId === null || userId === undefined) return undefined;
  return db.users.find(user => user.id === userId)?.name;
}

/* --------------------------------------------------------------- bodies */

/** JSON body of a request, or `{}` when the body is empty/unreadable. */
export async function readJson<T extends object = Record<string, unknown>>(
  request: Request,
): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}

/** `?key=` from the query string. */
export function query(request: Request, key: string): string | undefined {
  const value = new URL(request.url).searchParams.get(key);
  return value === null || value === '' ? undefined : value;
}

export function isUserRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'lawyer' || value === 'staff' || value === 'client';
}

/** Case-insensitive "does any field contain the term" used by the search boxes. */
export function matches(
  term: string | undefined,
  ...fields: (string | undefined | null)[]
): boolean {
  if (!term) return true;
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return fields.some(field => (field ?? '').toLowerCase().includes(needle));
}

/* --------------------------------------------------------- side effects */

/** Appends an audit-trail row, exactly as the Flask service layer does. */
export function recordActivity(user: User, action: string, details: string): ActivityLog {
  const entry: ActivityLog = {
    id: db.activityLogs.length + 1,
    userId: user.id,
    userName: user.name,
    action,
    details,
    createdAt: new Date().toISOString(),
  };
  db.activityLogs.unshift(entry);
  return entry;
}

/** Creates an in-app notification for one user. */
export function notify(userId: number, type: NotificationType, message: string): Notification {
  const entry: Notification = {
    id: db.notifications.length + 1,
    userId,
    type,
    message,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  db.notifications.unshift(entry);
  return entry;
}

/** Next `JF-YYYY-NNNN` case number. */
export function nextCaseNumber(): string {
  const year = new Date().getFullYear();
  const highest = db.cases.reduce((max, item) => {
    const tail = Number(item.caseNumber.split('-').pop());
    return Number.isFinite(tail) && tail > max ? tail : max;
  }, 0);
  return `JF-${year}-${String(highest + 1).padStart(4, '0')}`;
}

