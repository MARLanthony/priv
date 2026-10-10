/* ==========================================================================
   FAQs API (Flask `/api/faqs`) + legal-services catalogue (`/api/services`)
   ========================================================================== */

import { apiClient } from './apiClient';
import type { FAQ, LegalService } from '../types';

export interface FaqPayload {
  question: string;
  answer: string;
  category: string;
}

export interface FaqQuery {
  category?: string;
  q?: string;
}

/* ------------------------------------------------------------------ FAQs */

/** `GET /faqs` — visible to every role (clients read them on the portal). */
export function listFaqs(query: FaqQuery = {}): Promise<FAQ[]> {
  return apiClient.get<FAQ[]>('/faqs', {
    category: query.category || undefined,
    q: query.q || undefined,
  });
}

/** `POST /faqs` — admin/lawyer/staff maintain the list. */
export function createFaq(payload: FaqPayload): Promise<FAQ> {
  return apiClient.post<FAQ>('/faqs', payload);
}

/** `PUT /faqs/:id` */
export function updateFaq(id: number, payload: Partial<FaqPayload>): Promise<FAQ> {
  return apiClient.put<FAQ>(`/faqs/${id}`, payload);
}

/** `DELETE /faqs/:id` */
export function deleteFaq(id: number): Promise<void> {
  return apiClient.del<void>(`/faqs/${id}`);
}

/* ------------------------------------------------------- Legal services */

/** `GET /services` — the firm's practice areas (pricing/consultation types). */
export function listLegalServices(activeOnly = true): Promise<LegalService[]> {
  return apiClient.get<LegalService[]>('/services', { isActive: activeOnly ? true : undefined });
}

/** `POST /services` — admin only. */
export function createLegalService(payload: {
  name: string;
  description: string;
  isActive?: boolean;
}): Promise<LegalService> {
  return apiClient.post<LegalService>('/services', payload);
}

/** `PUT /services/:id` */
export function updateLegalService(
  id: number,
  payload: Partial<LegalService>,
): Promise<LegalService> {
  return apiClient.put<LegalService>(`/services/${id}`, payload);
}

/** `DELETE /services/:id` */
export function deleteLegalService(id: number): Promise<void> {
  return apiClient.del<void>(`/services/${id}`);
}

export const faqService = { listFaqs, createFaq, updateFaq, deleteFaq };

export const catalogService = {
  listLegalServices,
  createLegalService,
  updateLegalService,
  deleteLegalService,
};
