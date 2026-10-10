/* ==========================================================================
   Clients API (Flask `/api/clients`)
   ========================================================================== */

import { apiClient } from './apiClient';
import type { Client } from '../types';

export interface ClientPayload {
  fullName: string;
  email?: string;
  contact: string;
  address: string;
  /** Optional: create the linked login at the same time (admin only). */
  userId?: number;
  password?: string;
}

export interface ClientQuery {
  q?: string;
}

/** `GET /clients` */
export function listClients(query: ClientQuery = {}): Promise<Client[]> {
  return apiClient.get<Client[]>('/clients', { q: query.q || undefined });
}

/** `GET /clients/:id` */
export function getClient(id: number): Promise<Client> {
  return apiClient.get<Client>(`/clients/${id}`);
}

/** `GET /clients/me` — the profile of the signed-in client. */
export function getMyClientProfile(): Promise<Client> {
  return apiClient.get<Client>('/clients/me');
}

/** `POST /clients` */
export function createClient(payload: ClientPayload): Promise<Client> {
  return apiClient.post<Client>('/clients', payload);
}

/** `PUT /clients/:id` */
export function updateClient(id: number, payload: Partial<ClientPayload>): Promise<Client> {
  return apiClient.put<Client>(`/clients/${id}`, payload);
}

/** `DELETE /clients/:id` */
export function deleteClient(id: number): Promise<void> {
  return apiClient.del<void>(`/clients/${id}`);
}

export const clientService = {
  listClients,
  getClient,
  getMyClientProfile,
  createClient,
  updateClient,
  deleteClient,
};
