import { create } from 'zustand';
import * as caseApi from '../services/caseService';
import type { CasePayload, CaseQuery } from '../services/caseService';
import type { Case, CasePriority, CaseStatus } from '../types';

/**
 * Case state.
 *
 * Holds the list the user is currently looking at plus the filters behind it,
 * so returning to the page (or to a detail view) does not refetch for nothing.
 * The API scopes results by role: an admin sees the firm, a lawyer their
 * docket, a client only their own matters.
 */

export interface CaseFilters {
  status: CaseStatus | '';
  priority: CasePriority | '';
  q: string;
}

export const DEFAULT_CASE_FILTERS: CaseFilters = { status: '', priority: '', q: '' };

export interface CaseState {
  items: Case[];
  selected: Case | null;
  filters: CaseFilters;
  loading: boolean;
  saving: boolean;
  error: string | null;

  fetchCases: (filters?: Partial<CaseFilters>) => Promise<Case[]>;
  fetchCase: (id: number) => Promise<Case | null>;
  setFilters: (filters: Partial<CaseFilters>) => void;
  resetFilters: () => void;
  selectCase: (item: Case | null) => void;

  createCase: (payload: CasePayload) => Promise<Case>;
  updateCase: (id: number, payload: Partial<CasePayload>) => Promise<Case>;
  setStatus: (id: number, status: CaseStatus) => Promise<Case>;
  assignCase: (id: number, lawyerId: number | null) => Promise<Case>;
  removeCase: (id: number) => Promise<void>;
  reset: () => void;
}

const message = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const useCaseStore = create<CaseState>((set, get) => ({
  items: [],
  selected: null,
  filters: { ...DEFAULT_CASE_FILTERS },
  loading: false,
  saving: false,
  error: null,

  fetchCases: async (filters) => {
    const next = { ...get().filters, ...filters };
    const query: CaseQuery = {
      status: next.status || undefined,
      priority: next.priority || undefined,
      q: next.q || undefined,
    };

    set({ loading: true, error: null, filters: next });
    try {
      const items = await caseApi.listCases(query);
      set({ items, loading: false });
      return items;
    } catch (error) {
      set({ loading: false, error: message(error, 'Could not load cases.') });
      return [];
    }
  },

  fetchCase: async (id) => {
    set({ loading: true, error: null });
    try {
      const item = await caseApi.getCase(id);
      set(state => ({
        loading: false,
        selected: item,
        // Keep the list in sync when the detail view loaded first.
        items: state.items.some(entry => entry.id === item.id)
          ? state.items.map(entry => (entry.id === item.id ? item : entry))
          : [item, ...state.items],
      }));
      return item;
    } catch (error) {
      set({ loading: false, error: message(error, 'Could not load this case.') });
      return null;
    }
  },

  setFilters: (filters) => set(state => ({ filters: { ...state.filters, ...filters } })),

  resetFilters: () => set({ filters: { ...DEFAULT_CASE_FILTERS } }),

  selectCase: (item) => set({ selected: item }),

  createCase: async (payload) => {
    set({ saving: true, error: null });
    try {
      const created = await caseApi.createCase(payload);
      set(state => ({ saving: false, items: [created, ...state.items] }));
      return created;
    } catch (error) {
      set({ saving: false, error: message(error, 'Could not create the case.') });
      throw error;
    }
  },

  updateCase: async (id, payload) => {
    set({ saving: true, error: null });
    try {
      const updated = await caseApi.updateCase(id, payload);
      set(state => ({
        saving: false,
        items: state.items.map(entry => (entry.id === id ? updated : entry)),
        selected: state.selected?.id === id ? updated : state.selected,
      }));
      return updated;
    } catch (error) {
      set({ saving: false, error: message(error, 'Could not update the case.') });
      throw error;
    }
  },

  setStatus: async (id, status) => {
    try {
      const updated = await caseApi.updateCaseStatus(id, status);
      set(state => ({
        items: state.items.map(entry => (entry.id === id ? updated : entry)),
        selected: state.selected?.id === id ? updated : state.selected,
      }));
      return updated;
    } catch (error) {
      set({ error: message(error, 'Could not change the case status.') });
      throw error;
    }
  },

  assignCase: async (id, lawyerId) => {
    try {
      const updated = await caseApi.assignCase(id, lawyerId);
      set(state => ({
        items: state.items.map(entry => (entry.id === id ? updated : entry)),
        selected: state.selected?.id === id ? updated : state.selected,
      }));
      return updated;
    } catch (error) {
      set({ error: message(error, 'Could not assign the case.') });
      throw error;
    }
  },

  removeCase: async (id) => {
    await caseApi.deleteCase(id);
    set(state => ({
      items: state.items.filter(entry => entry.id !== id),
      selected: state.selected?.id === id ? null : state.selected,
    }));
  },

  reset: () => set({ items: [], selected: null, filters: { ...DEFAULT_CASE_FILTERS }, error: null }),
}));
