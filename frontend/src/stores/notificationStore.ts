import { create } from 'zustand';
import * as notificationApi from '../services/notificationService';
import type { Notification, NotificationSettings } from '../types';

/**
 * Notification state.
 *
 * `unreadCount` is kept separately so the navbar bell can render a badge
 * without filtering the whole list on every render.
 */

export interface NotificationState {
  items: Notification[];
  unreadCount: number;
  settings: NotificationSettings | null;
  loading: boolean;
  error: string | null;

  fetchNotifications: (limit?: number) => Promise<Notification[]>;
  refreshUnreadCount: () => Promise<number>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: number) => Promise<void>;
  fetchSettings: () => Promise<NotificationSettings | null>;
  saveSettings: (settings: NotificationSettings) => Promise<NotificationSettings>;
  reset: () => void;
}

const message = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  settings: null,
  loading: false,
  error: null,

  fetchNotifications: async (limit = 25) => {
    set({ loading: true, error: null });
    try {
      const items = await notificationApi.listNotifications({ limit });
      set({
        items,
        loading: false,
        unreadCount: items.filter(item => !item.isRead).length,
      });
      return items;
    } catch (error) {
      set({ loading: false, error: message(error, 'Could not load notifications.') });
      return [];
    }
  },

  refreshUnreadCount: async () => {
    try {
      const { count } = await notificationApi.getUnreadCount();
      set({ unreadCount: count });
      return count;
    } catch {
      // Keep the last known count when the API is unreachable.
      return get().unreadCount;
    }
  },

  markRead: async (id) => {
    try {
      const updated = await notificationApi.markAsRead(id);
      set(state => ({
        items: state.items.map(item => (item.id === id ? updated : item)),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      set({ error: message(error, 'Could not update the notification.') });
    }
  },

  markAllRead: async () => {
    try {
      await notificationApi.markAllAsRead();
      set(state => ({
        items: state.items.map(item => ({ ...item, isRead: true })),
        unreadCount: 0,
      }));
    } catch (error) {
      set({ error: message(error, 'Could not mark everything as read.') });
    }
  },

  remove: async (id) => {
    const target = get().items.find(item => item.id === id);
    await notificationApi.deleteNotification(id);
    set(state => ({
      items: state.items.filter(item => item.id !== id),
      unreadCount: target && !target.isRead ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    }));
  },

  fetchSettings: async () => {
    try {
      const settings = await notificationApi.getNotificationSettings();
      set({ settings });
      return settings;
    } catch {
      set({ settings: null });
      return null;
    }
  },

  saveSettings: async (settings) => {
    const saved = await notificationApi.saveNotificationSettings(settings);
    set({ settings: saved });
    return saved;
  },

  reset: () => set({ items: [], unreadCount: 0, settings: null, error: null }),
}));
