'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '../../features/auth/AuthContext';
import { ToastProvider } from '../../components/ui/ToastContext';
import { SignalRProvider } from '../../providers/SignalRProvider';
import { AppSidebar } from '../../components/layout/AppSidebar';
import { AppHeader } from '../../components/layout/AppHeader';
import { registerServiceWorker } from '../../services/push-notification.service';

function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Đăng ký Service Worker cho thông báo Web Push
  useEffect(() => {
    try {
      registerServiceWorker();
    } catch (err) {
      console.warn('Push notification service worker notice:', err);
    }
  }, []);

  // Bảo vệ route: Nếu không đăng nhập chuyển về /login
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoading, isLoggedIn, router]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          gap: 12,
        }}
      >
        <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 32, color: '#dc2626' }} aria-hidden="true" />
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#475569' }}>
          Hệ thống quản lý công việc - Công ty KHM Software phát triển
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="app-layout" suppressHydrationWarning>
      <AppSidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />
      <div className="main-wrapper">
        <AppHeader onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)} />
        <main className="content-area">{children}</main>
      </div>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <SignalRProvider>
          <PortalShell>{children}</PortalShell>
        </SignalRProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
