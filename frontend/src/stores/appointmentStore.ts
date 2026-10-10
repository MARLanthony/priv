import { create } from 'zustand';
import * as appointmentApi from '../services/appointmentService';
import type { AppointmentPayload } from '../services/appointmentService';
import type { Appointment, AppointmentSlot, AppointmentStatus, Availability } from '../types';

/** Appointment + availability state (calendar, booking, lawyer schedule). */

export interface AppointmentState {
  items: Appointment[];
  selected: Appointment | null;
  availability: Availability[];
  slots: AppointmentSlot[];
  loading: boolean;
  saving: boolean;
  error: string | null;

  fetchAppointments: (params?: {
    status?: AppointmentStatus | '';
    lawyerId?: number;
    clientId?: number;
  }) => Promise<Appointment[]>;
  fetchAppointment: (id: number) => Promise<Appointment | null>;
  book: (payload: AppointmentPayload) => Promise<Appointment>;
  update: (id: number, payload: Partial<AppointmentPayload>) => Promise<Appointment>;
  setStatus: (id: number, status: AppointmentStatus, reason?: string) => Promise<Appointment>;
  remove: (id: number) => Promise<void>;

  fetchAvailability: (lawyerId?: number) => Promise<Availability[]>;
  saveAvailability: (entries: Availability[]) => Promise<Availability[]>;
  loadSlots: (lawyerId: number | null, date: string) => Promise<AppointmentSlot[]>;
  reset: () => void;
}

const message = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const upsert = (items: Appointment[], item: Appointment): Appointment[] =>
  items.some(entry => entry.id === item.id)
    ? items.map(entry => (entry.id === item.id ? item : entry))
    : [item, ...items];

export const useAppointmentStore = create<AppointmentState>((set, get) => ({
  items: [],
  selected: null,
  availability: [],
  slots: [],
  loading: false,
  saving: false,
  error: null,

  fetchAppointments: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const items = await appointmentApi.listAppointments({
        status: params.status || undefined,
        lawyerId: params.lawyerId,
        clientId: params.clientId,
      });
      set({ items, loading: false });
      return items;
    } catch (error) {
      set({ loading: false, error: message(error, 'Could not load appointments.') });
      return [];
    }
  },

  fetchAppointment: async (id) => {
    set({ loading: true, error: null });
    try {
      const item = await appointmentApi.getAppointment(id);
      set(state => ({ loading: false, selected: item, items: upsert(state.items, item) }));
      return item;
    } catch (error) {
      set({ loading: false, error: message(error, 'Could not load this appointment.') });
      return null;
    }
  },

  book: async (payload) => {
    set({ saving: true, error: null });
    try {
      const created = await appointmentApi.createAppointment(payload);
      set(state => ({ saving: false, items: [created, ...state.items], slots: [] }));
      return created;
    } catch (error) {
      set({ saving: false, error: message(error, 'Could not book the appointment.') });
      throw error;
    }
  },

  update: async (id, payload) => {
    set({ saving: true, error: null });
    try {
      const updated = await appointmentApi.updateAppointment(id, payload);
      set(state => ({
        saving: false,
        items: upsert(state.items, updated),
        selected: state.selected?.id === id ? updated : state.selected,
      }));
      return updated;
    } catch (error) {
      set({ saving: false, error: message(error, 'Could not update the appointment.') });
      throw error;
    }
  },

  setStatus: async (id, status, reason) => {
    try {
      const updated = await appointmentApi.updateAppointmentStatus(id, status, reason);
      set(state => ({
        items: upsert(state.items, updated),
        selected: state.selected?.id === id ? updated : state.selected,
      }));
      return updated;
    } catch (error) {
      set({ error: message(error, 'Could not change the appointment status.') });
      throw error;
    }
  },

  remove: async (id) => {
    await appointmentApi.deleteAppointment(id);
    set(state => ({
      items: state.items.filter(entry => entry.id !== id),
      selected: state.selected?.id === id ? null : state.selected,
    }));
  },

  fetchAvailability: async (lawyerId) => {
    set({ loading: true, error: null });
    try {
      const availability = await appointmentApi.listAvailability(lawyerId);
      set({ availability, loading: false });
      return availability;
    } catch (error) {
      set({ loading: false, error: message(error, 'Could not load availability.') });
      return [];
    }
  },

  saveAvailability: async (entries) => {
    set({ saving: true, error: null });
    try {
      const availability = await appointmentApi.saveAvailability(entries);
      set({ saving: false, availability });
      return availability;
    } catch (error) {
      set({ saving: false, error: message(error, 'Could not save availability.') });
      throw error;
    }
  },

  loadSlots: async (lawyerId, date) => {
    try {
      const slots = await appointmentApi.listSlots(lawyerId, date);
      set({ slots });
      return slots;
    } catch (error) {
      set({ slots: [], error: message(error, 'Could not load available slots.') });
      return [];
    }
  },

  reset: () =>
    set({ items: [], selected: null, availability: [], slots: [], error: null }),
}));
