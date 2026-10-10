/* ==========================================================================
   Cases API (Flask `/api/cases`)
   ========================================================================== */

import { apiClient } from './apiClient';
import type { Case, CasePriority, CaseStatus } from '../types';

export interface CasePayload {
  clientId: number;
  caseNumber?: string;
  title: string;
  type: string;
  status?: CaseStatus;
  priority?: CasePriority;
  assignedLawyerId?: number | null;
  description?: string;
}

export interface CaseQuery {
  status?: CaseStatus | '';
  priority?: CasePriority | '';
  clientId?: number;
  lawyerId?: number;
  q?: string;
}

/** `GET /cases` — the list is already scoped to the caller's role by the API. */
export function listCases(query: CaseQuery = {}): Promise<Case[]> {
  return apiClient.get<Case[]>('/cases', {
    status: query.status || undefined,
    priority: query.priority || undefined,
    clientId: query.clientId,
    lawyerId: query.lawyerId,
    q: query.q || undefined,
  });
}

/** `GET /cases/:id` */
export function getCase(id: number): Promise<Case> {
  return apiClient.get<Case>(`/cases/${id}`);
}

/** `POST /cases` */
export function createCase(payload: CasePayload): Promise<Case> {
  return apiClient.post<Case>('/cases', payload);
}

/** `PUT /cases/:id` */
export function updateCase(id: number, payload: Partial<CasePayload>): Promise<Case> {
  return apiClient.put<Case>(`/cases/${id}`, payload);
}

/** `PATCH /cases/:id/status` — the status board and detail page use this. */
export function updateCaseStatus(id: number, status: CaseStatus): Promise<Case> {
  return apiClient.patch<Case>(`/cases/${id}/status`, { status });
}

/** `PATCH /cases/:id/assign` — admin/lawyer (re)assigns a case. */
export function assignCase(id: number, lawyerId: number | null): Promise<Case> {
  return apiClient.patch<Case>(`/cases/${id}/assign`, { assignedLawyerId: lawyerId });
}

/** `DELETE /cases/:id` */
export function deleteCase(id: number): Promise<void> {
  return apiClient.del<void>(`/cases/${id}`);
}

export const caseService = {
  listCases,
  getCase,
  createCase,
  updateCase,
  updateCaseStatus,
  assignCase,
  deleteCase,
};
