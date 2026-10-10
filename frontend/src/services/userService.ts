/* ==========================================================================
   Users API (Flask `/api/users`) — admin-only account management
   ========================================================================== */

import { apiClient } from './apiClient';
import type { ActivityLog, User, UserRole } from '../types';

export interface UserPayload {
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

export interface UserQuery {
  role?: UserRole | '';
  isActive?: boolean;
  q?: string;
}

/** `GET /users` */
export function listUsers(query: UserQuery = {}): Promise<User[]> {
  return apiClient.get<User[]>('/users', {
    role: query.role || undefined,
    isActive: query.isActive,
    q: query.q || undefined,
  });
}

/** `GET /users/directory` — the minimal list used by pickers (lawyer, staff). */
export function listDirectory(role?: UserRole): Promise<User[]> {
  return apiClient.get<User[]>('/users/directory', { role: role || undefined });
}

/** `GET /users/:id` */
export function getUser(id: number): Promise<User> {
  return apiClient.get<User>(`/users/${id}`);
}

/** `POST /users` — admin creates a lawyer, staff member or client account. */
export function createUser(payload: UserPayload): Promise<User> {
  return apiClient.post<User>('/users', payload);
}

/** `PUT /users/:id` */
export function updateUser(id: number, payload: Partial<UserPayload>): Promise<User> {
  return apiClient.put<User>(`/users/${id}`, payload);
}

/** `PATCH /users/:id/status` — enable/disable instead of hard-deleting. */
export function setUserActive(id: number, isActive: boolean): Promise<User> {
  return apiClient.patch<User>(`/users/${id}/status`, { isActive });
}

/** `DELETE /users/:id` */
export function deleteUser(id: number): Promise<void> {
  return apiClient.del<void>(`/users/${id}`);
}

/** `GET /users/:id/activity` — audit trail shown on the admin user page. */
export function getUserActivity(id: number, limit = 20): Promise<ActivityLog[]> {
  return apiClient.get<ActivityLog[]>(`/users/${id}/activity`, { limit });
}

export const userService = {
  listUsers,
  listDirectory,
  getUser,
  createUser,
  updateUser,
  setUserActive,
  deleteUser,
  getUserActivity,
};
