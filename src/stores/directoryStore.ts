import { create } from 'zustand';

/**
 * People pickers for the create forms (cases, appointments, office hours).
 *
 * The dataset ships EMPTY (see src/mocks/data.ts), so those forms must never
 * assume a demo attorney or client: they read the firm directory instead, which
 * is served by src/mocks/handlers/directory.ts.
 *
 *   GET /api/attorneys   any signed-in user (a client picks one when booking)
 *   GET /api/clients     staff only
 *
 * Both calls fail soft — if a request is refused (403 for a client on
 * /api/clients, or offline), the list is simply empty and the form shows its
 * "nothing to pick yet" hint instead of breaking.
 */

export interface DirectoryPerson {
  id: number;
  name: string;
  specialization?: string;
  email?: string;
}

interface DirectoryState {
  attorneys: DirectoryPerson[];
  clients: DirectoryPerson[];
  fetchAttorneys: () => Promise<void>;
  fetchClients: () => Promise<void>;
}

export const useDirectoryStore = create<DirectoryState>((set) => ({
  attorneys: [],
  clients: [],
  fetchAttorneys: async () => {
    try {
      const res = await fetch('/api/attorneys');
      set({ attorneys: res.ok ? (await res.json()) as DirectoryPerson[] : [] });
    } catch {
      set({ attorneys: [] });
    }
  },
  fetchClients: async () => {
    try {
      const res = await fetch('/api/clients');
      set({ clients: res.ok ? (await res.json()) as DirectoryPerson[] : [] });
    } catch {
      set({ clients: [] });
    }
  },
}));