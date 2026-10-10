/* ==========================================================================
   Role-based access control
   --------------------------------------------------------------------------
   The backend is the authority: every Flask route re-checks the caller's role
   before touching the database. This module mirrors that matrix in the browser
   so navigation, buttons and route guards can hide what the API would refuse,
   instead of letting a user walk into a "403" screen.

   Keep it in sync with `database/seeders/002_role_permissions.sql` and
   `backend/app/utils/rbac.py`.
   ========================================================================== */

import type { Permission, UserRole } from '../types';

/** Every permission granted to each role. */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  /* The admin/owner runs the firm: full access, including roles and settings. */
  admin: [
    'users.read', 'users.write',
    'roles.manage',
    'clients.read', 'clients.write',
    'cases.read', 'cases.write',
    'consultations.read', 'consultations.review',
    'appointments.read', 'appointments.write',
    'documents.read', 'documents.write',
    'nlp.run',
    'faqs.read', 'faqs.write',
    'notifications.read', 'notifications.settings',
    'reports.read',
    'activity.read',
    'settings.manage',
  ],

  /* The lawyer works cases, consults clients and reviews documents. */
  lawyer: [
    'clients.read', 'clients.write',
    'cases.read', 'cases.write',
    'consultations.read', 'consultations.review',
    'appointments.read', 'appointments.write',
    'documents.read', 'documents.write',
    'nlp.run',
    'faqs.read', 'faqs.write',
    'notifications.read', 'notifications.settings',
    'reports.read',
    'activity.read',
  ],

  /* Staff handle intake and scheduling; they may not review or manage roles. */
  staff: [
    'clients.read', 'clients.write',
    'cases.read', 'cases.write',
    'consultations.read',
    'appointments.read', 'appointments.write',
    'documents.read', 'documents.write',
    'nlp.run',
    'faqs.read',
    'notifications.read', 'notifications.settings',
    'activity.read',
  ],

  /*
   * The client only ever sees their own records — the API scopes every query
   * by the client id behind the token, so no extra permission is needed here.
   */
  client: [
    'cases.read',
    'consultations.read',
    'appointments.read', 'appointments.write',
    'documents.read', 'documents.write',
    'nlp.run',
    'faqs.read',
    'notifications.read', 'notifications.settings',
  ],
};

/** True when the role grants the permission. An unknown role grants nothing. */
export function roleHasPermission(
  role: UserRole | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** True when *any* of the permissions is granted (used to show a menu entry). */
export function roleHasAnyPermission(
  role: UserRole | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some(permission => roleHasPermission(role, permission));
}

/** Human-readable labels for the permission matrix screen. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  'users.read': 'View users',
  'users.write': 'Create / edit users',
  'roles.manage': 'Manage roles & permissions',
  'clients.read': 'View clients',
  'clients.write': 'Create / edit clients',
  'cases.read': 'View cases',
  'cases.write': 'Create / edit cases',
  'consultations.read': 'View consultations',
  'consultations.review': 'Approve / decline consultations',
  'appointments.read': 'View appointments',
  'appointments.write': 'Schedule / edit appointments',
  'documents.read': 'View documents',
  'documents.write': 'Upload / manage documents',
  'nlp.run': 'Run AI case analysis',
  'faqs.read': 'View FAQs',
  'faqs.write': 'Manage FAQs',
  'notifications.read': 'View notifications',
  'notifications.settings': 'Change notification settings',
  'reports.read': 'View reports',
  'activity.read': 'View activity logs',
  'settings.manage': 'Manage firm settings',
};

/** Permissions grouped for the settings screen (admin only). */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: 'Users & roles', permissions: ['users.read', 'users.write', 'roles.manage'] },
  { label: 'Clients', permissions: ['clients.read', 'clients.write'] },
  { label: 'Cases', permissions: ['cases.read', 'cases.write'] },
  { label: 'Consultations', permissions: ['consultations.read', 'consultations.review'] },
  { label: 'Appointments', permissions: ['appointments.read', 'appointments.write'] },
  { label: 'Documents', permissions: ['documents.read', 'documents.write'] },
  { label: 'AI analysis', permissions: ['nlp.run'] },
  { label: 'Knowledge & FAQs', permissions: ['faqs.read', 'faqs.write'] },
  { label: 'Notifications', permissions: ['notifications.read', 'notifications.settings'] },
  { label: 'Firm', permissions: ['reports.read', 'activity.read', 'settings.manage'] },
];
