import { apiFetch } from './api.config';

export interface NotificationItem {
  id: string;
  userId: string;
  taskItemId?: string;
  type: string;
  channel: string;
  title: string;
  message: string;
  createdAt: string;
  sentAt?: string;
  readAt?: string;
  isRead: boolean;
}

export interface UserNotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
  totalCount: number;
}

/**
 * Fetch list of notifications from backend API
 */
export async function getNotifications(page = 1, pageSize = 20) {
  return await apiFetch<UserNotificationsResponse>(`/api/v1/Notifications?page=${page}&pageSize=${pageSize}`, {
    method: 'GET',
  });
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(id: string) {
  return await apiFetch(`/api/v1/Notifications/${id}/read`, {
    method: 'PATCH',
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead() {
  return await apiFetch('/api/v1/Notifications/read-all', {
    method: 'PATCH',
  });
}
