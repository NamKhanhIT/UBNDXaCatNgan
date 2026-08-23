'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../features/auth/AuthContext';
import { usePermission } from '../../hooks/use-permission';
import { ROLE_HIERARCHY } from '../../services/role-hierarchy.service';

interface AppSidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AppSidebar({ isMobileOpen, onCloseMobile }: AppSidebarProps) {
  const pathname = usePathname();
  const { user, activeRole, logout } = useAuth();
  const { can } = usePermission();

  const [isWorkcenterExpanded, setIsWorkcenterExpanded] = useState<boolean>(true);

  const roleConfig = ROLE_HIERARCHY[activeRole] || ROLE_HIERARCHY['ChuyenVien'];
  const fullName = user?.fullName || 'Cán bộ UBND Xã';
  const avatarInitials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map(p => p[0]?.toUpperCase())
    .join('') || 'CB';

  const isActive = (path: string) => {
    if (path === '/dashboard' && (pathname === '/dashboard' || pathname === '/')) return true;
    return pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={onCloseMobile}
          aria-label="Đóng thanh điều hướng"
        />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`} aria-label="Menu chính hệ thống">
        {/* Sidebar Header: Quốc huy / Logo UBND Cấp Xã */}
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <i className="fa-solid fa-landmark" style={{ fontSize: 20, color: '#dc2626' }} aria-hidden="true" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="org-name" style={{ fontSize: '0.74rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>
                UBND CẤP XÃ
              </div>
              <div className="system-name" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Quản Lý Công Việc
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="sidebar-nav" aria-label="Danh mục chức năng chính">
          {/* 1. TỔNG QUAN */}
          <Link
            href="/dashboard"
            className={`sidebar-item ${isActive('/dashboard') ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            <i className="fa-solid fa-chart-pie" style={{ fontSize: 16 }} aria-hidden="true" />
            <span style={{ flex: 1 }}>TỔNG QUAN</span>
          </Link>

          {/* 2. TRUNG TÂM ĐIỀU HÀNH */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Link
                href="/workcenter"
                className={`sidebar-item ${isActive('/workcenter') ? 'active' : ''}`}
                style={{ flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                onClick={onCloseMobile}
              >
                <i className="fa-solid fa-briefcase" style={{ fontSize: 16 }} aria-hidden="true" />
                <span style={{ flex: 1 }}>TRUNG TÂM ĐIỀU HÀNH</span>
              </Link>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setIsWorkcenterExpanded(prev => !prev)}
                title={isWorkcenterExpanded ? 'Thu gọn menu con' : 'Mở rộng menu con'}
                style={{
                  height: 40,
                  width: 32,
                  padding: 0,
                  borderRadius: 0,
                  borderTopRightRadius: 8,
                  borderBottomRightRadius: 8,
                  background: isActive('/workcenter') ? 'var(--sidebar-active-bg, #eff6ff)' : 'transparent',
                  color: isActive('/workcenter') ? '#1d4ed8' : 'var(--text-muted)',
                }}
              >
                <i
                  className={`fa-solid ${isWorkcenterExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`}
                  style={{ fontSize: 11 }}
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* Submenu Trung tâm điều hành */}
            {isWorkcenterExpanded && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  paddingLeft: 18,
                  marginTop: 2,
                  marginBottom: 6,
                  borderLeft: '2px solid #e2e8f0',
                  marginLeft: 20,
                }}
              >
                <Link
                  href="/workcenter?tab=today"
                  className={`sidebar-item sub-item ${isActive('/workcenter') && pathname.includes('tab=today') ? 'active' : ''}`}
                  onClick={onCloseMobile}
                  style={{ fontSize: '0.82rem', padding: '6px 12px', minHeight: 32 }}
                >
                  <i className="fa-solid fa-list-check" style={{ fontSize: 13 }} aria-hidden="true" />
                  <span>Công việc trong ngày</span>
                </Link>
                <Link
                  href="/documents"
                  className={`sidebar-item sub-item ${isActive('/documents') ? 'active' : ''}`}
                  onClick={onCloseMobile}
                  style={{ fontSize: '0.82rem', padding: '6px 12px', minHeight: 32 }}
                >
                  <i className="fa-solid fa-envelope-open-text" style={{ fontSize: 13 }} aria-hidden="true" />
                  <span>Sổ văn bản đến & đi</span>
                </Link>
                <Link
                  href="/workcenter?tab=scheduled"
                  className={`sidebar-item sub-item ${isActive('/workcenter') && pathname.includes('tab=scheduled') ? 'active' : ''}`}
                  onClick={onCloseMobile}
                  style={{ fontSize: '0.82rem', padding: '6px 12px', minHeight: 32 }}
                >
                  <i className="fa-solid fa-hourglass-half" style={{ fontSize: 13 }} aria-hidden="true" />
                  <span>Văn bản chờ xử lý</span>
                </Link>
              </div>
            )}
          </div>

          {/* 3. LỊCH CÔNG TÁC */}
          <Link
            href="/calendar"
            className={`sidebar-item ${isActive('/calendar') ? 'active' : ''}`}
            onClick={onCloseMobile}
          >
            <i className="fa-solid fa-calendar-days" style={{ fontSize: 16 }} aria-hidden="true" />
            <span style={{ flex: 1 }}>LỊCH CÔNG TÁC</span>
          </Link>

          {/* 4. ĐÁNH GIÁ THI ĐUA (Chỉ hiển thị khi có quyền can('EvaluateOfficer') — Ẩn hoàn toàn với Chuyên viên) */}
          {can('EvaluateOfficer') && (
            <Link
              href="/evaluation"
              className={`sidebar-item ${isActive('/evaluation') ? 'active' : ''}`}
              onClick={onCloseMobile}
            >
              <i className="fa-solid fa-trophy" style={{ fontSize: 16 }} aria-hidden="true" />
              <span style={{ flex: 1 }}>ĐÁNH GIÁ THI ĐUA (GRAD)</span>
            </Link>
          )}

          {/* 5. QUẢN LÝ CÁN BỘ / PHÒNG BAN (Chỉ hiện đúng quyền can('ManageDepartments') hoặc can('ManageUsers')) */}
          {(can('ManageDepartments') || can('ManageUsers') || can('ViewDepartmentDashboard')) && (
            <Link
              href="/departments"
              className={`sidebar-item ${isActive('/departments') ? 'active' : ''}`}
              onClick={onCloseMobile}
            >
              <i className="fa-solid fa-sitemap" style={{ fontSize: 16 }} aria-hidden="true" />
              <span style={{ flex: 1 }}>CÁN BỘ & PHÒNG BAN</span>
            </Link>
          )}
        </nav>

        {/* ── CUỐI SIDEBAR: Avatar / Tên người dùng / Cài đặt / Đăng xuất ── */}
        <div
          style={{
            marginTop: 'auto',
            borderTop: '1px solid #e2e8f0',
            paddingTop: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {/* User Profile Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 8,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: '#dc2626',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.8rem',
                flexShrink: 0,
              }}
            >
              {avatarInitials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {fullName}
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#64748b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {roleConfig.label}
              </div>
            </div>
          </div>

          {/* Cài đặt Link */}
          <Link
            href="/settings"
            className={`sidebar-item ${isActive('/settings') ? 'active' : ''}`}
            style={{ minHeight: 36, padding: '6px 12px' }}
            onClick={onCloseMobile}
          >
            <i className="fa-solid fa-sliders" style={{ fontSize: 14 }} aria-hidden="true" />
            <span style={{ fontSize: '0.84rem' }}>Cài Đặt Hệ Thống</span>
          </Link>

          {/* Đăng xuất Button */}
          <button
            type="button"
            className="sidebar-item"
            style={{
              minHeight: 36,
              padding: '6px 12px',
              color: '#dc2626',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              width: '100%',
              cursor: 'pointer',
            }}
            onClick={async () => {
              await logout();
            }}
            title="Đăng xuất khỏi hệ thống"
          >
            <i className="fa-solid fa-arrow-right-from-bracket" style={{ fontSize: 14, color: '#dc2626' }} aria-hidden="true" />
            <span style={{ fontSize: '0.84rem', fontWeight: 700 }}>Đăng Xuất</span>
          </button>

          {/* Attribution Footer */}
          <div style={{ padding: '8px 10px 4px 10px', fontSize: '0.68rem', color: '#94a3b8', textAlign: 'center', borderTop: '1px solid #f1f5f9', marginTop: 4, fontWeight: 500 }}>
            Công ty KHM Software phát triển
          </div>
        </div>
      </aside>
    </>
  );
}
