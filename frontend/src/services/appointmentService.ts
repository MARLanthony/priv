/* ==========================================================================
   Appointments + availability API (Flask `/api/appointments`, `/api/availability`)
   ========================================================================== */

import { apiClient } from './apiClient';
import type { Appointment, AppointmentSlot, AppointmentStatus, Availability } from '../types';

export interface AppointmentPayload {
  clientId?: number;
  consultationId?: number | null;
  lawyerId: number | null;
  date: string;
  startTime: string;
  endTime: string;
  status?: AppointmentStatus;
  notes?: string;
}

export interface AppointmentQuery {
  status?: AppointmentStatus | '';
  clientId?: number;
  lawyerId?: number;
  from?: string;
  to?: string;
}

/** `GET /appointments` */
export function listAppointments(query: AppointmentQuery = {}): Promise<Appointment[]> {
  return apiClient.get<Appointment[]>('/appointments', {
    status: query.status || undefined,
    clientId: query.clientId,
    lawyerId: query.lawyerId,
    from: query.from,
    to: query.to,
  });
}

/** `GET /appointments/:id` */
export function getAppointment(id: number): Promise<Appointment> {
  return apiClient.get<Appointment>(`/appointments/${id}`);
}

/** `POST /appointments` */
export function createAppointment(payload: AppointmentPayload): Promise<Appointment> {
  return apiClient.post<Appointment>('/appointments', payload);
}

/** `PUT /appointments/:id` */
export function updateAppointment(
  id: number,
  payload: Partial<AppointmentPayload>,
): Promise<Appointment> {
  return apiClient.put<Appointment>(`/appointments/${id}`, payload);
}

/** `PATCH /appointments/:id/status` */
export function updateAppointmentStatus(
  id: number,
  status: AppointmentStatus,
  reason?: string,
): Promise<Appointment> {
  return apiClient.patch<Appointment>(`/appointments/${id}/status`, { status, reason });
}

/** `DELETE /appointments/:id` */
export function deleteAppointment(id: number): Promise<void> {
  return apiClient.del<void>(`/appointments/${id}`);
}

/**
 * `GET /appointments/slots` — free slots for a lawyer on a given day.
 * Falls back to the weekly availability when no lawyer is chosen.
 */
export function listSlots(lawyerId: number | null, date: string): Promise<AppointmentSlot[]> {
  return apiClient.get<AppointmentSlot[]>('/appointments/slots', { lawyerId, date });
}

/* ------------------------------------------------------------ Availability */

/** `GET /availability` — weekly schedule (optionally for one lawyer). */
export function listAvailability(lawyerId?: number): Promise<Availability[]> {
  return apiClient.get<Availability[]>('/availability', { lawyerId });
}

/** `PUT /availability` — a lawyer publishes their weekly schedule. */
export function saveAvailability(entries: Availability[]): Promise<Availability[]> {
  return apiClient.put<Availability[]>('/availability', { entries });
}

export const appointmentService = {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  listSlots,
  listAvailability,
  saveAvailability,
};
