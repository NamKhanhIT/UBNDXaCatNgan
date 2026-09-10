'use client';

import React from 'react';
import Link from 'next/link';
import { DocumentsFeature } from '../../../features/documents/DocumentsFeature';

/**
 * Audit 04-09-2026: Trang "Văn bản" đã được hợp nhất vào "Trung tâm điều hành > Hôm Nay".
 * Giữ route để hỗ trợ deep-link (bookmark, email link, OAuth callback) và hiển thị
 * banner ở đầu để hướng dẫn người dùng đến đúng nơi. KHÔNG chặn truy cập — vẫn render
 * `DocumentsFeature` cho tác vụ legacy.
 */
export default function DocumentsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        role="alert"
        aria-live="polite"
        style={{
          border: '1px solid #fbbf24',
          backgroundColor: '#fef3c7',
          color: '#78350f',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong style={{ fontWeight: 800 }}>Trang này sẽ được hợp nhất</strong>
          <span style={{ fontSize: '0.88rem' }}>
            Vui lòng dùng <strong>Trung tâm điều hành &gt; Hôm Nay</strong> để xem
            văn bản đến/đi và công việc phát sinh trong ngày.
          </span>
        </div>
        <Link
          href="/workcenter?tab=today"
          className="btn btn-primary btn-sm"
          style={{ fontWeight: 800, whiteSpace: 'nowrap' }}
        >
          Đi đến Hôm Nay
        </Link>
      </div>
      <DocumentsFeature />
    </div>
  );
}
