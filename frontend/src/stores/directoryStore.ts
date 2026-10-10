import { create } from 'zustand';
import * as userApi from '../services/userService';
import * as clientApi from '../services/clientService';
import type { Client, User, UserRole } from '../types';

/**
 * Directory cache for pickers.
 *
 * Several screens need "pick a lawyer", "pick a client" or "pick a staff
 * member". Those lists barely change, so they are fetched once per session and
 * filtered locally instead of hitting the API on every modal open.
 */

export interface DirectoryState {
  users: User[];
  clients: Client[];
  loading: boolean;
  error: string | null;

  /** Loads every user once (or forces a refresh when `force` is true). */
  loadUsers: (force?: boolean) => Promise<User[]>;
  loadClients: (force?: boolean) => Promise<Client[]>;
  /** Lawyers only — used by case assignment and the booking flow. */
  lawyers: () => User[];
  staff: () => User[];
  userById: (id: number | null | undefined) => User | undefined;
  clientById: (id: number | null | undefined) => Client | undefined;
  roleOf: (id: number | null | undefined) => UserRole | undefined;
  reset: () => void;
}

const message = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const useDirectoryStore = create<DirectoryState>((set, get) => ({
  users: [],
  clients: [],
  loading: false,
  error: null,

  loadUsers: async (force = false) => {
    const cached = get().users;
    if (!force && cached.length > 0) return cached;

    set({ loading: true, error: null });
    try {
      const users = await userApi.listDirectory();
      set({ users, loading: false });
      return users;
    } catch (error) {
      set({ loading: false, error: message(error, 'Could not load the team directory.') });
      return [];
    }
  },

  loadClients: async (force = false) => {
    const cached = get().clients;
    if (!force && cached.length > 0) return cached;

    set({ loading: true, error: null });
    try {
      const clients = await clientApi.listClients();
      set({ clients, loading: false });
      return clients;
    } catch (error) {
      set({ loading: false, error: message(error, 'Could not load clients.') });
      return [];
    }
  },

  lawyers: () => get().users.filter(user => user.role === 'lawyer'),

  staff: () => get().users.filter(user => user.role === 'staff'),

  userById: (id) => (id === null || id === undefined ? undefined : get().users.find(u => u.id === id)),

  clientById: (id) =>
    id === null || id === undefined ? undefined : get().clients.find(c => c.id === id),

  roleOf: (id) => get().users.find(u => u.id === id)?.role,

  reset: () => set({ users: [], clients: [], error: null }),
}));
