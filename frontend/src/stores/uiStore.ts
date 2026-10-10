import { create } from 'zustand';

/**
 * UI state that is not tied to any single resource: the mobile sidebar, the
 * command palette and the toast queue.
 */

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

export interface UIState {
  /** Desktop sidebar expansion (false = collapsed icon rail). */
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  closeSidebar: () => void;

  /** Mobile drawer, driven by the hamburger in the navbar. */
  mobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;

  toasts: Toast[];
  /** Shows a toast for a few seconds and returns its id. */
  pushToast: (tone: ToastTone, message: string, durationMs?: number) => number;
  dismissToast: (id: number) => void;

  /** Disables page scrolling while a modal is open. */
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
}

let toastId = 0;

function syncBodyScroll(open: boolean): void {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = open ? 'hidden' : '';
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: false,
  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  closeSidebar: () => set({ sidebarOpen: false }),

  mobileNavOpen: false,
  openMobileNav: () => {
    syncBodyScroll(true);
    set({ mobileNavOpen: true });
  },
  closeMobileNav: () => {
    if (!get().modalOpen) syncBodyScroll(false);
    set({ mobileNavOpen: false });
  },

  toasts: [],
  pushToast: (tone, message, durationMs = 4000) => {
    const id = ++toastId;
    set(state => ({ toasts: [...state.toasts, { id, tone, message }] }));

    if (durationMs > 0 && typeof setTimeout === 'function') {
      setTimeout(() => get().dismissToast(id), durationMs);
    }
    return id;
  },
  dismissToast: (id) => set(state => ({ toasts: state.toasts.filter(toast => toast.id !== id) })),

  modalOpen: false,
  setModalOpen: (open) => {
    syncBodyScroll(open);
    set({ modalOpen: open });
  },
}));

export const toast = {
  success: (message: string) => useUIStore.getState().pushToast('success', message),
  error: (message: string) => useUIStore.getState().pushToast('error', message),
  info: (message: string) => useUIStore.getState().pushToast('info', message),
};
