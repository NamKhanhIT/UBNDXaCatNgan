'use client';

import { useEffect, useRef } from 'react';
import { useSignalRContext, RealtimeEventEnvelope, SignalRConnectionStatus } from '../providers/SignalRProvider';

/**
 * Hook truy xuất trạng thái kết nối SignalR tổng thể
 */
export function useSignalR(): {
  connectionStatus: SignalRConnectionStatus;
  isConnected: boolean;
  reconnect: () => Promise<void>;
} {
  const { connectionStatus, isConnected, reconnect } = useSignalRContext();
  return { connectionStatus, isConnected, reconnect };
}

/**
 * Hook đăng ký lắng nghe sự kiện SignalR cụ thể cho một Component
 * - Tự động đăng ký khi mount
 * - Tự động dọn dẹp (cleanup / unsubscribe) khi unmount
 * - Đảm bảo dữ liệu đã được lọc trùng (Deduplication) từ Provider
 */
export function useSignalREvent<T = any>(
  eventName: string,
  handler: (data: T, envelope: RealtimeEventEnvelope<T>) => void,
  deps: any[] = []
): void {
  const { subscribe } = useSignalRContext();
  const handlerRef = useRef(handler);

  // Luôn cập nhật handler mới nhất tránh stale closure
  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const unsubscribe = subscribe<T>(eventName, (data, envelope) => {
      if (handlerRef.current) {
        handlerRef.current(data, envelope);
      }
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, subscribe, ...deps]);
}
