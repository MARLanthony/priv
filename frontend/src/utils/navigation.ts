/* ==========================================================================
   Navigation map
   --------------------------------------------------------------------------
   One place that answers two questions:

   * where does a role land after signing in (`roleHome`), and
   * which sidebar entries belong to that role (`NAV_ITEMS`).

   The icon field is a key into the icon map in `components/Sidebar.tsx`, so
   this module stays free of React imports and can be used by the router, the
   guards and the sidebar alike.
   ========================================================================== */

import type { SidebarItem, UserRole } from '../types';

/** Landing route for each role — also used to bounce users out of 403s. */
export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin/dashboard',
  lawyer: '/lawyer/dashboard',
  staff: '/staff/dashboard',
  client: '/client/dashboard',
};

export function roleHome(role: UserRole | null | undefined): string {
  return role ? ROLE_HOME[role] : '/login';
}

export const NAV_ITEMS: Record<UserRole, SidebarItem[]> = {
  /* The admin/owner sees the whole firm. */
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: 'dashboard', section: 'Firm' },
    { label: 'Cases', path: '/admin/cases', icon: 'cases', section: 'Firm' },
    { label: 'Clients', path: '/admin/clients', icon: 'clients', section: 'Records' },
    { label: 'Consultations', path: '/admin/consultations', icon: 'consultations', section: 'Records' },
    { label: 'Appointments', path: '/admin/appointments', icon: 'appointments', section: 'Records' },
    { label: 'Documents', path: '/admin/documents', icon: 'documents', section: 'Records' },
    { label: 'Team', path: '/admin/team', icon: 'team', section: 'Records' },
    { label: 'Knowledge Base', path: '/admin/knowledge-base', icon: 'knowledge', section: 'Administration' },
    { label: 'Legal Services', path: '/admin/services', icon: 'services', section: 'Administration' },
    { label: 'Settings', path: '/admin/settings', icon: 'settings', section: 'Administration' },
  ],

  /* A lawyer lives in their docket. */
  lawyer: [
    { label: 'Dashboard', path: '/lawyer/dashboard', icon: 'dashboard', section: 'My practice' },
    { label: 'My Cases', path: '/lawyer/cases', icon: 'cases', section: 'My practice' },
    { label: 'Clients', path: '/lawyer/clients', icon: 'clients', section: 'Clients & schedule' },
    { label: 'Consultations', path: '/lawyer/consultations', icon: 'consultations', section: 'Clients & schedule' },
    { label: 'My Appointments', path: '/lawyer/appointments', icon: 'appointments', section: 'Clients & schedule' },
    { label: 'My Availability', path: '/lawyer/availability', icon: 'availability', section: 'Clients & schedule' },
    { label: 'Documents', path: '/lawyer/documents', icon: 'documents', section: 'Files' },
    { label: 'Knowledge Base', path: '/lawyer/knowledge-base', icon: 'knowledge', section: 'Files' },
    { label: 'Settings', path: '/lawyer/settings', icon: 'settings', section: 'Account' },
  ],

  /* Staff run intake, scheduling and the filing cabinet. */
  staff: [
    { label: 'Dashboard', path: '/staff/dashboard', icon: 'dashboard', section: 'Front desk' },
    { label: 'Intake Queue', path: '/staff/consultations', icon: 'consultations', section: 'Front desk' },
    { label: 'Appointments', path: '/staff/appointments', icon: 'appointments', section: 'Front desk' },
    { label: 'Calendar', path: '/staff/calendar', icon: 'calendar', section: 'Front desk' },
    { label: 'Clients', path: '/staff/clients', icon: 'clients', section: 'Records' },
    { label: 'Cases', path: '/staff/cases', icon: 'cases', section: 'Records' },
    { label: 'Documents', path: '/staff/documents', icon: 'documents', section: 'Records' },
    { label: 'Settings', path: '/staff/settings', icon: 'settings', section: 'Account' },
  ],

  /* A client only ever sees their own matter. */
  client: [
    { label: 'Dashboard', path: '/client/dashboard', icon: 'dashboard', section: 'My matter' },
    { label: 'Get Suggestions', path: '/client/suggestions', icon: 'suggestions', section: 'My matter' },
    { label: 'My Cases', path: '/client/cases', icon: 'cases', section: 'My matter' },
    { label: 'Appointments', path: '/client/appointments', icon: 'appointments', section: 'Schedule & files' },
    { label: 'My Documents', path: '/client/documents', icon: 'documents', section: 'Schedule & files' },
    { label: 'FAQs', path: '/client/faqs', icon: 'knowledge', section: 'Resources' },
    { label: 'Notifications', path: '/client/inbox', icon: 'inbox', section: 'Resources' },
    { label: 'Profile', path: '/client/profile', icon: 'profile', section: 'Account' },
  ],
};

/** Sidebar entries for a role (empty array for signed-out visitors). */
export function navItemsFor(role: UserRole | null | undefined): SidebarItem[] {
  return role ? NAV_ITEMS[role] ?? [] : [];
}
