'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AccountSettingsTab } from './components/AccountSettingsTab';
import { WorkProfileAiTab } from './components/WorkProfileAiTab';
import { NotificationsSettingsTab } from './components/NotificationsSettingsTab';
import { SecuritySettingsTab } from './components/SecuritySettingsTab';
import { AppearanceSettingsTab } from './components/AppearanceSettingsTab';
import { WorkflowAdmin } from '../workflow/WorkflowAdmin';
import { useWorkflowPermissions } from '../workflow/useWorkflow';

export type SettingsTab = 'account' | 'work-profile' | 'notifications' | 'security' | 'appearance' | 'workflow';

export function SettingsFeature() {
  const workflowPermissions = useWorkflowPermissions();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab') as SettingsTab | null;

  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  useEffect(() => {
    if (urlTab && ['account', 'work-profile', 'notifications', 'security', 'appearance', 'workflow'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'flex-start' }}>
      {/* ── SETTINGS SIDEBAR ── */}
      <div
        className="card"
        style={{
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          position: 'sticky',
          top: 80,
        }}
      >
        <button
          type="button"
          className={`sidebar-item ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'account' ? 'var(--sidebar-active-bg, #eff6ff)' : 'transparent',
            color: activeTab === 'account' ? '#1d4ed8' : '#334155',
            fontWeight: activeTab === 'account' ? 800 : 600,
            fontSize: '0.86rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <i className="fa-solid fa-user-gear" style={{ fontSize: 15, width: 18, textAlign: 'center', color: activeTab === 'account' ? '#2563eb' : '#64748b' }} aria-hidden="true" />
          <span>Hồ Sơ Cá Nhân</span>
        </button>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'work-profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('work-profile')}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'work-profile' ? 'var(--sidebar-active-bg, #eff6ff)' : 'transparent',
            color: activeTab === 'work-profile' ? '#1d4ed8' : '#334155',
            fontWeight: activeTab === 'work-profile' ? 800 : 600,
            fontSize: '0.86rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <i className="fa-solid fa-id-card-clip" style={{ fontSize: 15, width: 18, textAlign: 'center', color: activeTab === 'work-profile' ? '#7c3aed' : '#64748b' }} aria-hidden="true" />
          <span>Hồ Sơ Năng Lực & Minh Chứng</span>
        </button>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'notifications' ? 'var(--sidebar-active-bg, #eff6ff)' : 'transparent',
            color: activeTab === 'notifications' ? '#1d4ed8' : '#334155',
            fontWeight: activeTab === 'notifications' ? 800 : 600,
            fontSize: '0.86rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <i className="fa-solid fa-bell" style={{ fontSize: 15, width: 18, textAlign: 'center', color: activeTab === 'notifications' ? '#d97706' : '#64748b' }} aria-hidden="true" />
          <span>Cấu Hình Thông Báo</span>
        </button>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'security' ? 'var(--sidebar-active-bg, #eff6ff)' : 'transparent',
            color: activeTab === 'security' ? '#1d4ed8' : '#334155',
            fontWeight: activeTab === 'security' ? 800 : 600,
            fontSize: '0.86rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <i className="fa-solid fa-shield-halved" style={{ fontSize: 15, width: 18, textAlign: 'center', color: activeTab === 'security' ? '#16a34a' : '#64748b' }} aria-hidden="true" />
          <span>Bảo Mật & 2FA (MFA)</span>
        </button>

        <button
          type="button"
          className={`sidebar-item ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'appearance' ? 'var(--sidebar-active-bg, #eff6ff)' : 'transparent',
            color: activeTab === 'appearance' ? '#1d4ed8' : '#334155',
            fontWeight: activeTab === 'appearance' ? 800 : 600,
            fontSize: '0.86rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          <i className="fa-solid fa-palette" style={{ fontSize: 15, width: 18, textAlign: 'center', color: activeTab === 'appearance' ? '#dc2626' : '#64748b' }} aria-hidden="true" />
          <span>Giao Diện & Font Chữ</span>
        </button>
      </div>

      {/* ── SETTINGS CONTENT PANEL ── */}
      <div>
        {workflowPermissions.data?.canManageWorkflowPermissions && <button type="button" className="btn btn-outline" onClick={() => setActiveTab('workflow')}>Quản trị quyền tiếp nhận / trình văn bản</button>}
        {activeTab === 'workflow' && <WorkflowAdmin />}
        {activeTab === 'account' && <AccountSettingsTab />}
        {activeTab === 'work-profile' && <WorkProfileAiTab />}
        {activeTab === 'notifications' && <NotificationsSettingsTab />}
        {activeTab === 'security' && <SecuritySettingsTab />}
        {activeTab === 'appearance' && <AppearanceSettingsTab />}
      </div>
    </div>
  );
}
