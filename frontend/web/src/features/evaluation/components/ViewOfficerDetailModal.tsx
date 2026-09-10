'use client';

import React, { useEffect, useState } from 'react';
import {
  OfficerGRADScoreDto,
  OfficerDetailForEvaluationDto,
  getOfficerEvaluationDetailApi,
  RatingHistoryEntryDto,
  getRatingHistoryApi,
} from '../../../services/report.service';
import { formatDateTimeShort, formatDateShort } from '../../../lib/formatters';

interface ViewOfficerDetailModalProps {
  officer: OfficerGRADScoreDto;
  onClose: () => void;
}

export function ViewOfficerDetailModal({ officer, onClose }: ViewOfficerDetailModalProps) {
  const [detail, setDetail] = useState<OfficerDetailForEvaluationDto | null>(null);
  const [history, setHistory] = useState<RatingHistoryEntryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    Promise.all([
      getOfficerEvaluationDetailApi(officer.userId),
      getRatingHistoryApi(officer.userId),
    ]).then(([detailRes, histRes]) => {
      if (!alive) return;
      const d: any = detailRes;
      if (detailRes && (detailRes as any).success !== false) {
        setDetail((d?.data ?? d?.officer ? d : null) as any);
      }
      const h: any = histRes;
      if (Array.isArray(h)) setHistory(h);
      else if (h?.data && Array.isArray(h.data)) setHistory(h.data);
      else if (Array.isArray(h?.data)) setHistory(h.data);
    }).catch(() => {
      // ignore — show empty state
    }).finally(() => {
      if (alive) setIsLoading(false);
    });
    return () => { alive = false; };
  }, [officer.userId]);

  const sysScore = officer.systemScore ?? officer.systemAutoScore30 ?? 0;
  const leadScore = officer.leaderScore ?? officer.leaderEvaluationScore70 ?? 0;
  const totalScore = officer.finalScore ?? officer.finalGRADScore ?? (sysScore + leadScore);

  return (
    <div
      style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 820, background: '#ffffff',
          borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              <i className="fa-solid fa-id-card" style={{ color: '#0ea5e9', marginRight: 8 }} />
              Hồ Sơ Đánh Giá Chi Tiết
            </h2>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
              <strong>{officer.fullName}</strong> — {officer.roleName} • {officer.departmentName}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} title="Đóng">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, color: '#2563eb', display: 'block', marginBottom: 10 }} />
              Đang nạp dữ liệu chi tiết...
            </div>
          ) : (
            <>
              {/* Bảng điểm */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Điểm Tự Động (3.0đ)</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2563eb', marginTop: 4 }}>{sysScore.toFixed(1)}đ</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Lãnh Đạo (7.0đ)</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#7c3aed', marginTop: 4 }}>{leadScore.toFixed(1)}đ</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Tổng Điểm (10đ)</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: totalScore >= 9 ? '#166534' : '#0f172a', marginTop: 4 }}>{totalScore.toFixed(1)}đ</div>
                </div>
              </div>

              {/* Lịch sử làm việc (tasks) */}
              <SectionTitle icon="fa-list-check" color="#0ea5e9" title="Lịch sử làm việc (công vụ được giao)" />
              {detail && detail.tasks && detail.tasks.length > 0 ? (
                <div style={{ marginBottom: 20 }}>
                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th style={{ textAlign: 'left', padding: 8 }}>Công việc</th>
                        <th style={{ textAlign: 'center', padding: 8, width: 90 }}>Tiến độ</th>
                        <th style={{ textAlign: 'center', padding: 8, width: 110 }}>Hạn chót</th>
                        <th style={{ textAlign: 'center', padding: 8, width: 110 }}>Hoàn thành</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.tasks.slice(0, 10).map(t => (
                        <tr key={t.taskId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: 8 }}>
                            <div style={{ fontWeight: 600 }}>{t.title}</div>
                            <div style={{ fontSize: '0.72rem', color: t.isOverdue ? '#dc2626' : '#64748b' }}>
                              {t.isOverdue ? 'Trễ hạn' : 'Đúng hạn'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: 8 }}>{t.progressPercentage}%</td>
                          <td style={{ textAlign: 'center', padding: 8 }}>{t.dueDate ? formatDateShort(t.dueDate) : '—'}</td>
                          <td style={{ textAlign: 'center', padding: 8 }}>{t.completedAt ? formatDateShort(t.completedAt) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {detail.tasks.length > 10 && (
                    <div style={{ fontSize: '0.76rem', color: '#64748b', textAlign: 'center', padding: 8 }}>
                      ... và {detail.tasks.length - 10} công việc khác
                    </div>
                  )}
                </div>
              ) : (
                <EmptyHint text="Chưa có dữ liệu công việc hoặc API chi tiết chưa sẵn sàng." />
              )}

              {/* Văn bản liên quan */}
              <SectionTitle icon="fa-file-lines" color="#7c3aed" title="Văn bản / Tài liệu liên quan" />
              {detail && detail.documents && detail.documents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {detail.documents.map(d => (
                    <div key={d.documentId} style={{ padding: 10, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fafafa' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{d.title}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {d.documentNumber ? `Số: ${d.documentNumber} • ` : ''}
                        {d.uploaderName} • {formatDateShort(d.uploadedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyHint text="Chưa có văn bản liên quan." />
              )}

              {/* Timeline ghi nhận điểm */}
              <SectionTitle icon="fa-clock-rotate-left" color="#dc2626" title="Lịch sử thao tác điểm (Audit Trail)" />
              {history.length > 0 ? (
                <div style={{ paddingLeft: 12, borderLeft: '2px solid #e2e8f0', marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {history.map((h, idx) => (
                    <div key={h.id} style={{ position: 'relative' }}>
                      <span style={{
                        position: 'absolute', left: -19, top: 2, width: 12, height: 12,
                        borderRadius: '50%',
                        background: h.delta > 0 ? '#16a34a' : h.delta < 0 ? '#dc2626' : '#2563eb',
                        border: '2px solid #fff',
                      }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.84rem' }}>
                          {h.delta > 0 ? '↗ Tăng điểm' : h.delta < 0 ? '↘ Giảm điểm' : 'Ghi nhận'}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '0.84rem', color: h.delta > 0 ? '#166534' : h.delta < 0 ? '#dc2626' : '#0f172a' }}>
                          {h.oldScore.toFixed(1)} → {h.newScore.toFixed(1)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#334155', margin: '4px 0' }}>{h.reason}</div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {h.changedByName} • {formatDateTimeShort(h.changedAt)}
                        {h.evidenceFileIds?.length > 0 && <> • {h.evidenceFileIds.length} bằng chứng</>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyHint text="Chưa có lịch sử chỉnh sửa điểm." />
              )}
            </>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, color, title }: { icon: string; color: string; title: string }) {
  return (
    <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <i className={`fa-solid ${icon}`} style={{ color }} />
      <span>{title}</span>
    </h3>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{ padding: 12, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 6, color: '#64748b', fontSize: '0.82rem', marginBottom: 20, textAlign: 'center' }}>
      {text}
    </div>
  );
}
