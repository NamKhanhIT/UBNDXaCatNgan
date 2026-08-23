'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Tự động chuyển hướng vào /dashboard (nếu đã có session) hoặc /login
    const cachedUser = localStorage.getItem('ubnd_cached_user');
    if (cachedUser) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        gap: 14,
      }}
    >
      <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 32, color: '#dc2626' }} aria-hidden="true" />
      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155' }}>
        Hệ thống quản lý công việc - Công ty KHM Software phát triển
      </div>
    </div>
  );
}
