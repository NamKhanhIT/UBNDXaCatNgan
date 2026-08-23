'use client';

import React, { useState } from 'react';
import { OfficerGRADScoreDto, submitOfficialRatingApi } from '../../../services/report.service';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../../components/ui/ToastContext';

interface EvaluateOfficerModalProps {
  officer: OfficerGRADScoreDto | null;
  onClose: () => void;
  onGraded: (updatedOfficer: OfficerGRADScoreDto) => void;
}

export function EvaluateOfficerModal({ officer, onClose, onGraded }: EvaluateOfficerModalProps) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [leaderScore, setLeaderScore] = useState<number>(officer?.leaderEvaluationScore70 || 6.2);
  const [evaluationNote, setEvaluationNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!officer) return null;

  const sysScore = officer.systemAutoScore30 || 2.8;
  const totalScore = Math.min(10.0, sysScore + leaderScore);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await submitOfficialRatingApi({
        targetUserId: officer.userId,
        targetUserName: officer.fullName,
        departmentId: 'dept-1',
        departmentName: officer.departmentName,
        ratingScore10: totalScore,
        evaluatorScore70: leaderScore,
        systemScore30: sysScore,
        evaluationPeriod: '2026-08',
        evaluationNotes: evaluationNote.trim() || 'Lãnh đạo thẩm định chất lượng công vụ hàng tháng.',
        competencyBreakdown: {},
      });

      if (res.success) {
        addToast('Thẩm định thành công', `Đã ghi nhận điểm thi đua cho ${officer.fullName}: ${totalScore.toFixed(1)}/10.0`, 'success');
        onGraded({
          ...officer,
          leaderEvaluationScore70: leaderScore,
          finalScore100: Math.round(totalScore * 10),
          finalGRADScore: totalScore,
          tierGrade: totalScore >= 9.0 ? 'A' : totalScore >= 7.5 ? 'B' : totalScore >= 6.0 ? 'C' : 'D',
        });
        onClose();
      } else {
        addToast('Lỗi', res.error || 'Không thể lưu điểm đánh giá', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Lỗi kết nối khi đánh giá cán bộ', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          maxWidth: 560,
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
              ⭐ Thẩm Định Điểm Thi Đua Cán Bộ (Thang 10)
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
              Cán bộ: <strong>{officer.fullName}</strong> — {officer.roleName}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tóm tắt điểm số */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              background: '#f8fafc',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              textAlign: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Điểm Tự Động (Max 3.0)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563eb', marginTop: 2 }}>
                {sysScore.toFixed(1)}đ
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Lãnh Đạo (Max 7.0)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7c3aed', marginTop: 2 }}>
                {leaderScore.toFixed(1)}đ
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Tổng Điểm Thang 10</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: totalScore >= 9.0 ? '#166534' : '#0f172a', marginTop: 2 }}>
                {totalScore.toFixed(1)}đ
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
              Điểm thẩm định chất lượng của Lãnh đạo (Tối đa 7.0 điểm):
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <input
                type="range"
                min="3.0"
                max="7.0"
                step="0.1"
                value={leaderScore}
                onChange={e => setLeaderScore(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#7c3aed' }}
              />
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#5b21b6', width: 65, textAlign: 'right' }}>
                {leaderScore.toFixed(1)}/7.0đ
              </span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
              Nhận xét & Đánh giá công vụ:
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Đánh giá tinh thần trách nhiệm, kỷ luật hành chính, chất lượng giải quyết hồ sơ công vụ..."
              value={evaluationNote}
              onChange={e => setEvaluationNote(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ fontWeight: 700, background: '#7c3aed', borderColor: '#7c3aed' }}
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu Điểm Thẩm Định'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
