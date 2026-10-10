/* ==========================================================================
   Dashboard + activity APIs (Flask `/api/dashboard`, `/api/activity`)
   ========================================================================== */

import { apiClient } from './apiClient';
import type { ActivityLog, DashboardStats } from '../types';

/**
 * `GET /dashboard/stats`
 *
 * The API returns the counters the caller is allowed to see: a client gets
 * their own cases/documents, a lawyer their assigned work, an admin the whole
 * firm (plus `users`).
 */
export function getDashboardStats(): Promise<DashboardStats> {
  return apiClient.get<DashboardStats>('/dashboard/stats');
}

/** `GET /dashboard/overview` — extra series used by the admin charts. */
export interface DashboardOverview {
  casesByStatus: { label: string; value: number }[];
  consultationsByStatus: { label: string; value: number }[];
  appointmentsByMonth: { label: string; value: number }[];
  topLawyers: { id: number; name: string; cases: number }[];
}

export function getDashboardOverview(): Promise<DashboardOverview> {
  return apiClient.get<DashboardOverview>('/dashboard/overview');
}

/** `GET /activity` — audit trail (admin sees everything, others their own). */
export function listActivity(limit = 25): Promise<ActivityLog[]> {
  return apiClient.get<ActivityLog[]>('/activity', { limit });
}

export const dashboardService = {
  getDashboardStats,
  getDashboardOverview,
  listActivity,
};
