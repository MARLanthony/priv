/* ==========================================================================
   Notifications API (Flask `/api/notifications`)
   ========================================================================== */

import { apiClient } from './apiClient';
import type { Notification, NotificationSettings } from '../types';

export interface NotificationQuery {
  isRead?: boolean;
  limit?: number;
}

/** `GET /notifications` — newest first, scoped to the signed-in user. */
export function listNotifications(query: NotificationQuery = {}): Promise<Notification[]> {
  return apiClient.get<Notification[]>('/notifications', {
    isRead: query.isRead,
    limit: query.limit,
  });
}

/** `GET /notifications/unread-count` — drives the navbar bell badge. */
export function getUnreadCount(): Promise<{ count: number }> {
  return apiClient.get<{ count: number }>('/notifications/unread-count');
}

/** `PATCH /notifications/:id/read` */
export function markAsRead(id: number): Promise<Notification> {
  return apiClient.patch<Notification>(`/notifications/${id}/read`);
}

/** `POST /notifications/read-all` */
export function markAllAsRead(): Promise<{ updated: number }> {
  return apiClient.post<{ updated: number }>('/notifications/read-all');
}

/** `DELETE /notifications/:id` */
export function deleteNotification(id: number): Promise<void> {
  return apiClient.del<void>(`/notifications/${id}`);
}

/**
 * `POST /notifications` — internal helper used by other modules (e.g. an
 * approved consultation notifies the client). Requires a staff/admin token.
 */
export function createNotification(payload: {
  userId: number;
  type: Notification['type'];
  message: string;
}): Promise<Notification> {
  return apiClient.post<Notification>('/notifications', payload);
}

/** `GET /notifications/settings` */
export function getNotificationSettings(): Promise<NotificationSettings> {
  return apiClient.get<NotificationSettings>('/notifications/settings');
}

/** `PUT /notifications/settings` */
export function saveNotificationSettings(
  settings: NotificationSettings,
): Promise<NotificationSettings> {
  return apiClient.put<NotificationSettings>('/notifications/settings', settings);
}

export const notificationService = {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  getNotificationSettings,
  saveNotificationSettings,
};
