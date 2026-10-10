import { create } from 'zustand';
import * as consultationApi from '../services/consultationService';
import type { ConsultationPayload } from '../services/consultationService';
import type { Consultation, ConsultationStatus } from '../types';

/** Consultation state: the intake queue the staff reviews. */

export interface ConsultationState {
  items: Consultation[];
  selected: Consultation | null;
  status: ConsultationStatus | '';
  loading: boolean;
  saving: boolean;
  error: string | null;

  fetchConsultations: (status?: ConsultationStatus | '') => Promise<Consultation[]>;
  fetchConsultation: (id: number) => Promise<Consultation | null>;
  submit: (payload: ConsultationPayload) => Promise<Consultation>;
  update: (id: number, payload: Partial<ConsultationPayload>) => Promise<Consultation>;
  review: (id: number, status: ConsultationStatus) => Promise<Consultation>;
  remove: (id: number) => Promise<void>;
  reset: () => void;
}

const message = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const upsert = (items: Consultation[], item: Consultation): Consultation[] =>
  items.some(entry => entry.id === item.id)
    ? items.map(entry => (entry.id === item.id ? item : entry))
    : [item, ...items];

export const useConsultationStore = create<ConsultationState>((set, get) => ({
  items: [],
  selected: null,
  status: '',
  loading: false,
  saving: false,
  error: null,

  fetchConsultations: async (status) => {
    const next = status ?? get().status;
    set({ loading: true, error: null, status: next });
    try {
      const items = await consultationApi.listConsultations({ status: next || undefined });
      set({ items, loading: false });
      return items;
    } catch (error) {
      set({ loading: false, error: message(error, 'Could not load consultations.') });
      return [];
    }
  },

  fetchConsultation: async (id) => {
    set({ loading: true, error: null });
    try {
      const item = await consultationApi.getConsultation(id);
      set(state => ({ loading: false, selected: item, items: upsert(state.items, item) }));
      return item;
    } catch (error) {
      set({ loading: false, error: message(error, 'Could not load this consultation.') });
      return null;
    }
  },

  submit: async (payload) => {
    set({ saving: true, error: null });
    try {
      const created = await consultationApi.createConsultation(payload);
      set(state => ({ saving: false, items: [created, ...state.items] }));
      return created;
    } catch (error) {
      set({ saving: false, error: message(error, 'Could not submit your request.') });
      throw error;
    }
  },

  update: async (id, payload) => {
    set({ saving: true, error: null });
    try {
      const updated = await consultationApi.updateConsultation(id, payload);
      set(state => ({
        saving: false,
        items: upsert(state.items, updated),
        selected: state.selected?.id === id ? updated : state.selected,
      }));
      return updated;
    } catch (error) {
      set({ saving: false, error: message(error, 'Could not update the consultation.') });
      throw error;
    }
  },

  review: async (id, status) => {
    try {
      const updated = await consultationApi.reviewConsultation(id, status);
      set(state => ({
        items: upsert(state.items, updated),
        selected: state.selected?.id === id ? updated : state.selected,
      }));
      return updated;
    } catch (error) {
      set({ error: message(error, 'Could not review the consultation.') });
      throw error;
    }
  },

  remove: async (id) => {
    await consultationApi.deleteConsultation(id);
    set(state => ({
      items: state.items.filter(entry => entry.id !== id),
      selected: state.selected?.id === id ? null : state.selected,
    }));
  },

  reset: () => set({ items: [], selected: null, status: '', error: null }),
}));
