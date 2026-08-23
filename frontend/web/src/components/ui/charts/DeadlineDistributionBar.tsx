'use client';

import React from 'react';

export interface DeadlineDistributionData {
  dueToday: number;
  dueWithin3Days: number;
  dueThisWeek: number;
  overdue: number;
  urgentPriority: number;
  highPriority: number;
  normalPriority: number;
}

export interface DeadlineDistributionBarProps {
  data: DeadlineDistributionData;
}

export const DeadlineDistributionBar: React.FC<DeadlineDistributionBarProps> = ({ data }) => {
  const totalDueTracked = data.dueToday + data.dueWithin3Days + data.dueThisWeek + data.overdue;

  if (totalDueTracked === 0 && data.urgentPriority === 0 && data.highPriority === 0 && data.normalPriority === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 1. Mốc Thời Gian Hạn Chót */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
          PHÂN BỐ THEO MỐC THỜI HẠN
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
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
              QUÁ HẠN XỬ LÝ
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', marginTop: 2 }}>
              {data.overdue}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: 2 }}>
              Cần đôn đốc ngay
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
              HẠN TRONG NGÀY
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706', marginTop: 2 }}>
              {data.dueToday}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: 2 }}>
              Hạn chót hôm nay
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 600 }}>
              HẠN 3 NGÀY TỚI
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
              {data.dueWithin3Days}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#1d4ed8', marginTop: 2 }}>
              Cần kiểm tra tiến độ
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
              HẠN TRONG TUẦN
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
              {data.dueThisWeek}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
              Kế hoạch tuần này
            </div>
          </div>
        </div>
      </div>

      {/* 2. Phân Bố Theo Mức Độ Ưu Tiên */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
          MỨC ĐỘ ƯU TIÊN CÔNG VIỆC
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: '0.82rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#dc2626' }} />
            <span>Khẩn cấp: <strong>{data.urgentPriority}</strong></span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#d97706' }} />
            <span>Ưu tiên cao: <strong>{data.highPriority}</strong></span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#2563eb' }} />
            <span>Bình thường: <strong>{data.normalPriority}</strong></span>
          </span>
        </div>
      </div>
    </div>
  );
};
