/* ==========================================================================
   Consultations API (Flask `/api/consultations`)
   --------------------------------------------------------------------------
   Flow: a client submits a consultation ("concern"). Staff/lawyer review it
   and move it to `approved` or `declined`; an approved consultation is what
   the appointment booking hangs off.
   ========================================================================== */

import { apiClient } from './apiClient';
import type { Consultation, ConsultationStatus } from '../types';

export interface ConsultationPayload {
  clientId?: number;
  serviceId?: number | null;
  concern: string;
}

export interface ConsultationQuery {
  status?: ConsultationStatus | '';
  clientId?: number;
  q?: string;
}

/** `GET /consultations` */
export function listConsultations(query: ConsultationQuery = {}): Promise<Consultation[]> {
  return apiClient.get<Consultation[]>('/consultations', {
    status: query.status || undefined,
    clientId: query.clientId,
    q: query.q || undefined,
  });
}

/** `GET /consultations/:id` */
export function getConsultation(id: number): Promise<Consultation> {
  return apiClient.get<Consultation>(`/consultations/${id}`);
}

/** `POST /consultations` — a client raises a concern. */
export function createConsultation(payload: ConsultationPayload): Promise<Consultation> {
  return apiClient.post<Consultation>('/consultations', payload);
}

/** `PUT /consultations/:id` */
export function updateConsultation(
  id: number,
  payload: Partial<ConsultationPayload>,
): Promise<Consultation> {
  return apiClient.put<Consultation>(`/consultations/${id}`, payload);
}

/**
 * `PATCH /consultations/:id/status` — approve or decline.
 * The API records the reviewer from the bearer token, so no id is sent.
 */
export function reviewConsultation(id: number, status: ConsultationStatus): Promise<Consultation> {
  return apiClient.patch<Consultation>(`/consultations/${id}/status`, { status });
}

/** `DELETE /consultations/:id` */
export function deleteConsultation(id: number): Promise<void> {
  return apiClient.del<void>(`/consultations/${id}`);
}

export const consultationService = {
  listConsultations,
  getConsultation,
  createConsultation,
  updateConsultation,
  reviewConsultation,
  deleteConsultation,
};
