import { HubConnection, HubConnectionBuilder, LogLevel, HttpTransportType } from '@microsoft/signalr';
import { apiFetch, getApiBaseUrl } from './api.config';

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

let hubConnection: HubConnection | null = null;

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

/**
 * Initialize SignalR Hub Connection for real-time notifications
 */
export function initSignalRConnection(onNotificationReceived: (notification: NotificationItem) => void) {
  if (hubConnection) {
    hubConnection.stop();
  }

  const baseUrl = getApiBaseUrl();
  const hubUrl = `${baseUrl}/hubs/notifications`;

  hubConnection = new HubConnectionBuilder()
    .withUrl(hubUrl, {
      withCredentials: true,
      transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();

  hubConnection.on('ReceiveNotification', (notification: NotificationItem) => {
    onNotificationReceived(notification);
  });

  hubConnection
    .start()
    .catch((err) => {
      console.warn('Không thể kết nối SignalR Notification Hub:', err);
    });

  return hubConnection;
}

/**
 * Disconnect SignalR
 */
export function stopSignalRConnection() {
  if (hubConnection) {
    hubConnection.stop();
    hubConnection = null;
  }
}
