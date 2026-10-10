/* ==========================================================================
   Demo accounts
   --------------------------------------------------------------------------
   The single source of truth for the four seeded sign-in accounts used by
   `pages/Login.tsx` (one-click fill) and by the MSW demo database
   (`mocks/db.ts`), which imports `DEMO_PASSWORD` from here.

   These accounts exist in two places by design:

     * the MSW mock API (browser demo, `VITE_USE_MOCKS=true`, the default), and
     * `database/seeders/001_users.sql` + `server` seed script (Flask + Supabase).

   Keep the e-mail addresses and the password in sync with that seeder.
   ========================================================================== */

import { ROLE_LABELS, type UserRole } from '../types';

/** Password shared by every seeded demo account. */
export const DEMO_PASSWORD = 'password123';

export interface DemoAccount {
  role: UserRole;
  /** Human label for the sign-in tiles (`ROLE_LABELS`). */
  label: string;
  /** One-line description of what that account can do. */
  blurb: string;
  email: string;
  password: string;
}

/** Seeded accounts, in the order a reviewer should try them. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'admin',
    label: ROLE_LABELS.admin,
    blurb: 'Runs the firm — every record, role and setting.',
    email: 'admin@jurisflow.com',
    password: DEMO_PASSWORD,
  },
  {
    role: 'lawyer',
    label: ROLE_LABELS.lawyer,
    blurb: 'Works the docket, consults clients, reviews documents.',
    email: 'lawyer@jurisflow.com',
    password: DEMO_PASSWORD,
  },
  {
    role: 'staff',
    label: ROLE_LABELS.staff,
    blurb: 'Front desk — intake, scheduling and filing.',
    email: 'staff@jurisflow.com',
    password: DEMO_PASSWORD,
  },
  {
    role: 'client',
    label: ROLE_LABELS.client,
    blurb: 'Client portal — own matter, AI suggestions, files.',
    email: 'client@jurisflow.com',
    password: DEMO_PASSWORD,
  },
];

/**
 * Demo tiles for the sign-in screen.
 * Pass one or more roles to show a subset (staff pages use their own subset).
 */
export function demoAccountsFor(roles?: UserRole[]): DemoAccount[] {
  if (!roles || roles.length === 0) return DEMO_ACCOUNTS;
  return DEMO_ACCOUNTS.filter(account => roles.includes(account.role));
}

/** The account for a single role (used by route hints and tests). */
export function demoAccountFor(role: UserRole): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find(account => account.role === role);
}

/** `true` when the given e-mail belongs to a seeded demo account. */
export function isDemoEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.some(account => account.email === normalized);
}

export default DEMO_ACCOUNTS;
