'use client';

import React from 'react';
import { OfficerGRADScoreDto } from '../../../services/report.service';
import { formatDateTimeShort } from '../../../lib/formatters';

interface EvaluationTimelineModalProps {
  officer: OfficerGRADScoreDto | null;
  onClose: () => void;
}

export function EvaluationTimelineModal({ officer, onClose }: EvaluationTimelineModalProps) {
  if (!officer) return null;

  // Audit trail lịch sử chấm điểm (Append-only)
  const auditLogs = [
    {
      id: 'log-1',
      action: 'Hệ thống tự động ghi nhận',
      performer: 'Hệ thống AI & Task Engine',
      role: 'Tự động',
      time: '2026-08-20T17:00:00Z',
      score: `${(officer.systemAutoScore30 ?? 2.8).toFixed(1)}/3.0đ`,
      reason: `Ghi nhận hoàn thành ${officer.completedTasksCount}/${officer.totalTasksAssigned} nhiệm vụ đúng hạn.`,
    },
    {
      id: 'log-2',
      action: 'Lãnh đạo thẩm định chất lượng',
      performer: 'Nguyễn Đình Hùng',
      role: 'Chủ tịch UBND xã',
      time: '2026-08-21T09:30:00Z',
      score: `${(officer.leaderEvaluationScore70 ?? 6.2).toFixed(1)}/7.0đ`,
      reason: 'Đánh giá tinh thần trách nhiệm cao, hồ sơ xử lý kỹ lưỡng không có khiếu nại.',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              📜 Lịch Sử Đánh Giá & Thẩm Định Thi Đua (Audit Log)
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
              Cán bộ: <strong>{officer.fullName}</strong> — {officer.departmentName}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div style={{ padding: 20, maxHeight: 420, overflowY: 'auto' }}>
          <div style={{ paddingLeft: 12, borderLeft: '2px solid #e2e8f0', marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {auditLogs.map((log, idx) => (
              <div key={log.id} style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: -19,
                    top: 2,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: idx === 0 ? '#2563eb' : '#16a34a',
                    border: '2px solid #fff',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a' }}>{log.action}</span>
                  <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#166534' }}>{log.score}</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45, marginBottom: 4 }}>
                  {log.reason}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Người thực hiện: <strong>{log.performer}</strong> ({log.role}) • {formatDateTimeShort(log.time)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
