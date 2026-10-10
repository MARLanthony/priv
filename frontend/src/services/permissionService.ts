/* ==========================================================================
   Roles & permissions API (Flask `/api/roles`, `/api/permissions`)
   --------------------------------------------------------------------------
   RBAC is enforced by the backend on every route; these calls let the UI show
   or hide navigation and actions so a user never hits a "forbidden" screen.
   ========================================================================== */

import { apiClient } from './apiClient';
import type { Permission, RolePermission, UserRole } from '../types';

/** `GET /permissions` — the full catalogue of permissions. */
export function listPermissions(): Promise<Permission[]> {
  return apiClient.get<Permission[]>('/permissions');
}

/** `GET /roles/permissions` — the role → permission matrix. */
export function listRolePermissions(): Promise<RolePermission[]> {
  return apiClient.get<RolePermission[]>('/roles/permissions');
}

/** `GET /roles/:role/permissions` — one row of the matrix. */
export function listPermissionsForRole(role: UserRole): Promise<Permission[]> {
  return apiClient.get<Permission[]>(`/roles/${role}/permissions`);
}

/** `PUT /roles/:role/permissions` — admin edits the matrix (settings page). */
export function saveRolePermissions(
  role: UserRole,
  permissions: Permission[],
): Promise<RolePermission[]> {
  return apiClient.put<RolePermission[]>(`/roles/${role}/permissions`, { permissions });
}

export const permissionService = {
  listPermissions,
  listRolePermissions,
  listPermissionsForRole,
  saveRolePermissions,
};
