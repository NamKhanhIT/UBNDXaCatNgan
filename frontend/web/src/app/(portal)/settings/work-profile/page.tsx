'use client';

import React from 'react';
import { WorkProfileAiTab } from '../../../../features/settings/components/WorkProfileAiTab';
import Link from 'next/link';

export default function WorkProfilePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href="/settings" className="btn btn-ghost btn-sm" style={{ fontWeight: 700 }}>
          ← Cài Đặt Hệ Thống
        </Link>
        <span style={{ color: '#94a3b8' }}>/</span>
        <span style={{ fontWeight: 800, color: '#0f172a' }}>Hồ Sơ Công Vụ & CV AI</span>
      </div>

      <WorkProfileAiTab />
    </div>
  );
}
