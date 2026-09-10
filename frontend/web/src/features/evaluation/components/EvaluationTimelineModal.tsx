'use client';

import React, { useEffect, useState } from 'react';
import {
  OfficerGRADScoreDto,
  RatingHistoryEntryDto,
  getRatingHistoryApi,
} from '../../../services/report.service';
import { formatDateTimeShort } from '../../../lib/formatters';

interface EvaluationTimelineModalProps {
  officer: OfficerGRADScoreDto | null;
  onClose: () => void;
}

export function EvaluationTimelineModal({ officer, onClose }: EvaluationTimelineModalProps) {
  const [history, setHistory] = useState<RatingHistoryEntryDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!officer) return;
    let alive = true;
    setIsLoading(true);
    getRatingHistoryApi(officer.userId)
      .then((res: any) => {
        if (!alive) return;
        if (Array.isArray(res)) setHistory(res);
        else if (Array.isArray(res?.data)) setHistory(res.data);
        else setHistory([]);
      })
      .catch(() => {
        if (alive) setHistory([]);
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });
    return () => { alive = false; };
  }, [officer?.userId]);

  if (!officer) return null;

  // Auto system entry nếu không có history
  const sysScore = officer.systemScore ?? officer.systemAutoScore30 ?? 0;
  const hasHistory = history.length > 0;

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 640, background: '#ffffff',
          borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              📜 Lịch Sử Đánh Giá & Thẩm Định Thi Đua
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
              Cán bộ: <strong>{officer.fullName}</strong> — {officer.departmentName}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div style={{ padding: 20, maxHeight: 480, overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, color: '#2563eb', display: 'block', marginBottom: 10 }} />
              Đang tải lịch sử...
            </div>
          ) : !hasHistory ? (
            <div>
              {/* System entry mặc định */}
              <div style={{ paddingLeft: 12, borderLeft: '2px solid #e2e8f0', marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: -19, top: 2, width: 12, height: 12, borderRadius: '50%', background: '#2563eb', border: '2px solid #fff' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.86rem' }}>Hệ thống tự động ghi nhận</span>
                    <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#166534' }}>{sysScore.toFixed(1)}/3.0đ</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45, marginBottom: 4 }}>
                    Ghi nhận hoàn thành {officer.completedTasksCount}/{officer.totalTasksAssigned} nhiệm vụ đúng hạn.
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Người thực hiện: <strong>Hệ thống AI & Task Engine</strong>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16, padding: 12, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 6, color: '#64748b', fontSize: '0.8rem', textAlign: 'center' }}>
                Chưa có lịch sử chỉnh sửa điểm. Mọi thao tác trong tương lai sẽ được ghi nhận tại đây.
              </div>
            </div>
          ) : (
            <div style={{ paddingLeft: 12, borderLeft: '2px solid #e2e8f0', marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {history.map((h, idx) => (
                <div key={h.id} style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: -19, top: 2, width: 12, height: 12,
                    borderRadius: '50%',
                    background: h.delta > 0 ? '#16a34a' : h.delta < 0 ? '#dc2626' : '#2563eb',
                    border: '2px solid #fff',
                  }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a' }}>
                      {h.delta > 0 ? '↗ Tăng điểm' : h.delta < 0 ? '↘ Giảm điểm' : 'Ghi nhận'}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: '0.86rem', color: h.delta > 0 ? '#166534' : h.delta < 0 ? '#dc2626' : '#0f172a' }}>
                      {h.oldScore.toFixed(1)} → {h.newScore.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45, marginBottom: 4 }}>
                    {h.reason}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Người thực hiện: <strong>{h.changedByName}</strong> • {formatDateTimeShort(h.changedAt)}
                    {h.evidenceFileIds?.length > 0 && <> • {h.evidenceFileIds.length} bằng chứng</>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
