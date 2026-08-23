'use client';

import React from 'react';

export interface DocumentFlowData {
  incomingTotal: number;
  incomingUrgent: number;
  incomingPendingAssignment: number;
  outgoingTotal: number;
  outgoingPendingSignature: number;
  outgoingIssued: number;
}

export interface DocumentFlowChartProps {
  data: DocumentFlowData;
}

export const DocumentFlowChart: React.FC<DocumentFlowChartProps> = ({ data }) => {
  const totalDocs = data.incomingTotal + data.outgoingTotal;

  if (totalDocs === 0) {
    return null;
  }

  const incomingPercent = Math.round((data.incomingTotal / totalDocs) * 100);
  const outgoingPercent = Math.round((data.outgoingTotal / totalDocs) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Overview Flow Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
          <span style={{ fontWeight: 700, color: '#1d4ed8' }}>
            📥 Văn bản đến: <strong>{data.incomingTotal}</strong> ({incomingPercent}%)
          </span>
          <span style={{ fontWeight: 700, color: '#b45309' }}>
            📤 Văn bản đi: <strong>{data.outgoingTotal}</strong> ({outgoingPercent}%)
          </span>
        </div>

        <div
          style={{
            height: 14,
            width: '100%',
            backgroundColor: '#f1f5f9',
            borderRadius: 7,
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          <div
            style={{
              width: `${incomingPercent}%`,
              backgroundColor: '#2563eb',
              height: '100%',
              transition: 'width 0.4s ease',
            }}
            title={`Văn bản đến: ${data.incomingTotal}`}
          />
          <div
            style={{
              width: `${outgoingPercent}%`,
              backgroundColor: '#d97706',
              height: '100%',
              transition: 'width 0.4s ease',
            }}
            title={`Văn bản đi: ${data.outgoingTotal}`}
          />
        </div>
      </div>

      {/* Details Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 600 }}>
            VĂN BẢN ĐẾN KHẨN
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', marginTop: 2 }}>
            {data.incomingUrgent}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: 2 }}>
            Cần xử lý ưu tiên
          </div>
        </div>

        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            backgroundColor: '#faf5ff',
            border: '1px solid #e9d5ff',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#6b21a8', fontWeight: 600 }}>
            CHỜ GIAO VIỆC
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#7c3aed', marginTop: 2 }}>
            {data.incomingPendingAssignment}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#7e22ce', marginTop: 2 }}>
            Chưa phân công cán bộ
          </div>
        </div>

        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 600 }}>
            CHỜ KÝ SỐ BAN HÀNH
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706', marginTop: 2 }}>
            {data.outgoingPendingSignature}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: 2 }}>
            Văn bản đi chờ duyệt
          </div>
        </div>

        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>
            ĐÃ BAN HÀNH
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a', marginTop: 2 }}>
            {data.outgoingIssued}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: 2 }}>
            Hoàn tất ký số phát hành
          </div>
        </div>
      </div>
    </div>
  );
};
