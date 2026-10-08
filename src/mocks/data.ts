import { User, Case, Document, InboxMessage, Article, Appointment, Availability, TeamMember } from '../types';

/*
 * FRESH-INSTALL DATASET
 *
 * The app ships EMPTY on purpose: a brand-new firm has no cases, documents,
 * inbox threads, knowledge-base articles, appointments or office hours, and no
 * staff accounts — the user sees a system with nothing in it yet.
 *
 * Only the system administrator is provisioned, because the admin is the one who
 * builds the rest of the firm from inside the app:
 *
 *   staff   → Team Management (/admin/team) creates the attorney / secretary
 *             AND their sign-in account (default password `password123`, see
 *             handlers/team.ts; the member can change it in Settings)
 *   clients → self sign-up (/signup → POST /api/auth/register)
 *   cases, documents, articles, appointments, office hours → created by the
 *             roles that own them, through the normal screens
 *
 * Everything is held in memory by MSW, so a page reload returns to this empty
 * state. Nothing here is a placeholder person: a seeded name would show up in a
 * picker or a list, which is exactly what this dataset must not do.
 */

/** The single account that exists on a fresh install. */
export const ADMIN_EMAIL = 'admin@firm.com';
export const ADMIN_PASSWORD = 'password123';

export const users: (User & { password: string })[] = [
  { id: 1, name: 'Admin User', email: ADMIN_EMAIL, role: 'system_admin', password: ADMIN_PASSWORD, phone: '(555) 100-0001', createdAt: '2024-01-15' },
];

/** Opened by the admin/secretary once attorneys and clients exist. */
export const cases: Case[] = [];

/** Uploaded against a case. */
export const documents: Document[] = [];

/** Written by staff and clients as they communicate. */
export const inboxMessages: InboxMessage[] = [];

/** Written by the admin in the knowledge base. */
export const articles: Article[] = [];

/** Booked from the availability each attorney publishes. */
export const appointments: Appointment[] = [];

/** Office hours, published by each attorney. */
export const availability: Availability[] = [];

/** The firm directory (staff only) — the admin is the one seeded row. */
export const teamMembers: TeamMember[] = [
  { id: 1, name: 'Admin User', email: ADMIN_EMAIL, role: 'system_admin', phone: '(555) 100-0001', department: 'Administration', joinDate: '2024-01-15', status: 'active' },
];
