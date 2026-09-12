'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../ui/ToastContext';
import { ROLE_HIERARCHY } from '../../services/role-hierarchy.service';
import { getNotifications, markNotificationRead, markAllNotificationsRead, NotificationItem } from '../../services/notification.service';
import { formatAdministrativeDate, formatDateTimeShort } from '../../lib/formatters';

interface AppHeaderProps {
  onToggleMobileSidebar: () => void;
}

export function AppHeader({ onToggleMobileSidebar }: AppHeaderProps) {
  const router = useRouter();
  const { user, activeRole } = useAuth();
  const { addToast } = useToast();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const currentDateText = formatAdministrativeDate();

  // Load danh sách thông báo định kỳ (Polling mỗi 30s)
  useEffect(() => {
    async function loadNotifications() {
      try {
        const items = await getNotifications();
        if (Array.isArray(items)) {
          setNotifications(items);
          setUnreadCount(items.filter(n => !n.isRead).length);
        }
      } catch (err) {
        console.warn('Lỗi khi tải thông báo:', err);
      }
    }
    loadNotifications();

    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      try {
        await markNotificationRead(notif.id);
        setNotifications(prev => prev.map(n => (n.id === notif.id ? { ...n, isRead: true } : n)));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.warn('Lỗi khi đánh dấu đã đọc:', err);
      }
    }
    setShowNotifDropdown(false);

    if (notif.taskItemId) {
      router.push(`/workcenter?tab=all&taskId=${notif.taskItemId}`);
    } else if (notif.calendarEventId) {
      router.push('/calendar');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      addToast('Đã đọc tất cả', 'Đã đánh dấu tất cả thông báo là đã đọc', 'info');
    } catch (err) {
      console.warn('Lỗi khi đánh dấu tất cả đã đọc:', err);
    }
  };

  const roleConfig = ROLE_HIERARCHY[activeRole] || ROLE_HIERARCHY['ChuyenVien'];
  const displayName = user?.fullName || 'Cán bộ';
  const avatarInitials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map(p => p[0]?.toUpperCase())
    .join('') || 'CB';

  return (
    <header className="topbar">
      {/* Cụm bên trái: Nút mở menu mobile + Lời chào tối giản + Ngày hành chính */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          type="button"
          className="mobile-toggle-btn"
          onClick={onToggleMobileSidebar}
          title="Mở menu điều hướng"
          aria-label="Mở menu điều hướng"
        >
          <i className="fa-solid fa-bars" style={{ fontSize: 18 }} aria-hidden="true" />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Xin chào, {displayName}
            </span>
            <span
              className="badge"
              style={{
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
              }}
            >
              {roleConfig.shortLabel || roleConfig.label}
            </span>
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-regular fa-calendar" style={{ fontSize: 11 }} aria-hidden="true" />
            <span>{currentDateText}</span>
          </div>
        </div>
      </div>

      {/* Cụm bên phải: Chuông thông báo + Avatar (Đã loại bỏ hoàn toàn bộ chuyển đổi vai trò và SignalR listeners theo yêu cầu) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Chuông Thông báo & Dropdown Panel */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{
              position: 'relative',
              padding: '6px 12px',
              background: showNotifDropdown ? '#eff6ff' : '#fff',
              borderColor: unreadCount > 0 ? '#fca5a5' : '#e2e8f0',
            }}
            onClick={() => setShowNotifDropdown(prev => !prev)}
            title="Thông báo nhắc việc"
            aria-label="Thông báo nhắc việc"
          >
            <i
              className="fa-solid fa-bell"
              style={{ fontSize: 15, color: unreadCount > 0 ? '#dc2626' : '#64748b' }}
              aria-hidden="true"
            />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  background: '#dc2626',
                  color: '#fff',
                  borderRadius: '50%',
                  fontSize: '0.66rem',
                  fontWeight: 'bold',
                  width: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #fff',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 42,
                width: 360,
                maxHeight: 420,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                  🔔 Thông Báo ({unreadCount} chưa đọc)
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    onClick={handleMarkAllRead}
                  >
                    Đánh dấu tất cả đã đọc
                  </button>
                )}
              </div>

              <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                    Không có thông báo nào.
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #f1f5f9',
                        background: n.isRead ? '#ffffff' : '#f0f9ff',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <span
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: n.type === 'Escalation' ? '#dc2626' : n.type === 'Overdue' ? '#d97706' : '#1e293b',
                          }}
                        >
                          {n.title}
                        </span>
                        {!n.isRead && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />}
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#475569', margin: '2px 0 4px 0', lineHeight: 1.35 }}>
                        {n.message}
                      </p>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        {formatDateTimeShort(n.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Mini Avatar Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 8px 4px 4px',
            borderRadius: 20,
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#dc2626',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.72rem',
              letterSpacing: '0.02em',
            }}
          >
            {avatarInitials}
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
            {displayName.split(' ').pop()}
          </span>
        </div>
      </div>
    </header>
  );
}
