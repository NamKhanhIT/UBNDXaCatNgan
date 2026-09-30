'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { HubConnection, HubConnectionBuilder, LogLevel, HttpTransportType, HubConnectionState } from '@microsoft/signalr';
import { useAuth } from '../features/auth/AuthContext';
import { getStoredToken } from '../services/api.config';
import { useToast } from '../components/ui/ToastContext';

export type SignalRConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface RealtimeEventEnvelope<T = any> {
  eventId: string;
  eventType: string;
  timestamp: string;
  data: T;
}

type EventHandler<T = any> = (data: T, envelope: RealtimeEventEnvelope<T>) => void;

interface SignalRContextValue {
  connectionStatus: SignalRConnectionStatus;
  isConnected: boolean;
  subscribe: <T = any>(eventName: string, handler: EventHandler<T>) => () => void;
  reconnect: () => Promise<void>;
}

const SignalRContext = createContext<SignalRContextValue | null>(null);

const MAX_DEDUPLICATION_CACHE = 200;

export function SignalRProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const { addToast } = useToast();

  const [connectionStatus, setConnectionStatus] = useState<SignalRConnectionStatus>('disconnected');
  const connectionRef = useRef<HubConnection | null>(null);

  // Bộ đệm chống nhận trùng lặp sự kiện (Deduplication LRU Set)
  const processedEventIdsRef = useRef<Set<string>>(new Set());
  const eventIdQueueRef = useRef<string[]>([]);

  // Bảng đăng ký lắng nghe sự kiện từ các component
  const subscribersRef = useRef<Map<string, Set<EventHandler>>>(new Map());

  // Đăng ký nhận sự kiện
  const subscribe = useCallback(<T = any>(eventName: string, handler: EventHandler<T>) => {
    if (!subscribersRef.current.has(eventName)) {
      subscribersRef.current.set(eventName, new Set());
    }
    const handlersSet = subscribersRef.current.get(eventName)!;
    handlersSet.add(handler as EventHandler);

    // Trả về hàm hủy đăng ký (cleanup)
    return () => {
      handlersSet.delete(handler as EventHandler);
      if (handlersSet.size === 0) {
        subscribersRef.current.delete(eventName);
      }
    };
  }, []);

  // Xử lý gói tin sự kiện đến và lọc trùng
  const handleIncomingMessage = useCallback((eventName: string, payload: any) => {
    let envelope: RealtimeEventEnvelope;

    if (payload && typeof payload === 'object' && payload.eventId) {
      envelope = payload as RealtimeEventEnvelope;
    } else {
      // Tương thích ngược nếu backend gửi payload thô
      envelope = {
        eventId: `${eventName}-${Date.now()}-${Math.random()}`,
        eventType: eventName,
        timestamp: new Date().toISOString(),
        data: payload,
      };
    }

    if ((eventName === 'ReceiveNotification' || eventName === 'NotificationReceived') && envelope.data?.id) {
      envelope = { ...envelope, eventId: `${eventName}:${envelope.data.id}` };
    }

    // 1. Kiểm tra chống nhận trùng lặp sự kiện
    if (processedEventIdsRef.current.has(envelope.eventId)) {
      return; // Bỏ qua sự kiện đã từng nhận
    }

    // Lưu vào bộ đệm
    processedEventIdsRef.current.add(envelope.eventId);
    eventIdQueueRef.current.push(envelope.eventId);
    if (eventIdQueueRef.current.length > MAX_DEDUPLICATION_CACHE) {
      const oldestId = eventIdQueueRef.current.shift();
      if (oldestId) processedEventIdsRef.current.delete(oldestId);
    }

    // 2. Phân phối sự kiện tới các subscribers đã đăng ký
    const handlers = subscribersRef.current.get(eventName);
    if (handlers && handlers.size > 0) {
      handlers.forEach(handler => {
        try {
          handler(envelope.data, envelope);
        } catch (err) {
          console.warn(`Lỗi khi xử lý sự kiện SignalR '${eventName}':`, err);
        }
      });
    }

    // 3. Phân phối tới subscriber chung (nếu có)
    const wildcardHandlers = subscribersRef.current.get('*');
    if (wildcardHandlers && wildcardHandlers.size > 0) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(envelope.data, envelope);
        } catch (err) {
          console.warn(`Lỗi khi xử lý wildcard SignalR:`, err);
        }
      });
    }
  }, []);

  // Khởi tạo và duy trì kết nối SignalR
  const startConnection = useCallback(async () => {
    if (!isLoggedIn) return;

    if (connectionRef.current && connectionRef.current.state !== HubConnectionState.Disconnected) {
      return;
    }

    try {
      setConnectionStatus('connecting');

      const hubUrl = process.env.NEXT_PUBLIC_SIGNALR_HUB_URL ||
        (typeof window !== 'undefined'
          ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
              ? 'http://localhost:5015/hubs/notifications'
              : `${window.location.origin}/hubs/notifications`)
          : 'http://localhost:5015/hubs/notifications');

      const connection = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => {
            const token = getStoredToken();
            return token || '';
          },
          transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
          skipNegotiation: false,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(LogLevel.Information)
        .build();

      // Danh mục các sự kiện hệ thống cần lắng nghe từ Backend
      const systemEvents = [
        'ReceiveNotification',
        'NotificationCreated',
        'TaskAssigned',
        'TaskUpdated',
        'TaskDeadlineChanged',
        'DocumentReceived',
        'DocumentStatusChanged',
        'AiAnalysisStarted',
        'AiAnalysisCompleted',
        'AiAnalysisFailed',
        'ReportSubmitted',
        'ReportApproved',
        'ReportRejected',
        'CalendarEventCreated',
      ];

      // Đăng ký bộ thu gom sự kiện
      systemEvents.forEach(evtName => {
        connection.on(evtName, (payload) => {
          handleIncomingMessage(evtName, payload);
        });
      });

      // Lắng nghe sự kiện vòng đời kết nối
      connection.onreconnecting(() => {
        setConnectionStatus('reconnecting');
      });

      connection.onreconnected(() => {
        setConnectionStatus('connected');
        // Kích hoạt thông báo làm tươi dữ liệu
        handleIncomingMessage('SYSTEM_RECONNECTED', { timestamp: new Date().toISOString() });
      });

      connection.onclose(() => {
        setConnectionStatus('disconnected');
      });

      connectionRef.current = connection;
      await connection.start();
      if (connectionRef.current !== connection) {
        await connection.stop();
        return;
      }
      setConnectionStatus('connected');
      handleIncomingMessage('SYSTEM_RECONNECTED', { timestamp: new Date().toISOString() });
    } catch (err) {
      console.warn('SignalR Hub chưa sẵn sàng kết nối:', err);
      setConnectionStatus('disconnected');
    }
  }, [isLoggedIn, handleIncomingMessage]);

  useEffect(() => {
    if (isLoggedIn) {
      startConnection();
    } else {
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
      }
      setConnectionStatus('disconnected');
    }

    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
      }
    };
  }, [isLoggedIn, startConnection]);

  useEffect(() => {
    if (!isLoggedIn || connectionStatus !== 'disconnected') return;
    const timer = setTimeout(() => void startConnection(), 30000);
    const online = () => void startConnection();
    window.addEventListener('online', online);
    return () => { clearTimeout(timer); window.removeEventListener('online', online); };
  }, [isLoggedIn, connectionStatus, startConnection]);

  const reconnect = useCallback(async () => {
    if (connectionRef.current) {
      try {
        await connectionRef.current.stop();
      } catch {}
      connectionRef.current = null;
    }
    await startConnection();
  }, [startConnection]);

  return (
    <SignalRContext.Provider
      value={{
        connectionStatus,
        isConnected: connectionStatus === 'connected',
        subscribe,
        reconnect,
      }}
    >
      {children}
    </SignalRContext.Provider>
  );
}

export function useSignalRContext(): SignalRContextValue {
  const context = useContext(SignalRContext);
  if (!context) {
    throw new Error('useSignalRContext phải được sử dụng bên trong <SignalRProvider>');
  }
  return context;
}
