import { create } from 'zustand';
import { Case } from '../types';

interface CaseState {
  cases: Case[];
  currentCase: Case | null;
  isLoading: boolean;
  error: string | null;
  fetchCases: () => Promise<void>;
  fetchCase: (id: number) => Promise<void>;
  createCase: (data: Partial<Case>) => Promise<void>;
  updateCase: (id: number, data: Partial<Case>) => Promise<void>;
  deleteCase: (id: number) => Promise<void>;
}

export const useCaseStore = create<CaseState>((set) => ({
  cases: [],
  currentCase: null,
  isLoading: false,
  error: null,

  fetchCases: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/cases');
      const data = await res.json();
      set({ cases: data, isLoading: false });
    } catch { set({ error: 'Failed to fetch cases', isLoading: false }); }
  },

  fetchCase: async (id: number) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`/api/cases/${id}`);
      const data = await res.json();
      set({ currentCase: data, isLoading: false });
    } catch { set({ error: 'Failed to fetch case', isLoading: false }); }
  },

  createCase: async (data: Partial<Case>) => {
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const store = useCaseStore.getState();
        store.fetchCases();
      }
    } catch { set({ error: 'Failed to create case' }); }
  },

  updateCase: async (id: number, data: Partial<Case>) => {
    try {
      await fetch(`/api/cases/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const store = useCaseStore.getState();
      store.fetchCases();
    } catch { set({ error: 'Failed to update case' }); }
  },

  deleteCase: async (id: number) => {
    try {
      await fetch(`/api/cases/${id}`, { method: 'DELETE' });
      const store = useCaseStore.getState();
      store.fetchCases();
    } catch { set({ error: 'Failed to delete case' }); }
  },
}));
