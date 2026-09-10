'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  OfficerGRADScoreDto,
  submitOfficialRatingApi,
} from '../../../services/report.service';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../../components/ui/ToastContext';

interface EvaluateOfficerModalProps {
  officer: OfficerGRADScoreDto | null;
  currentUserId?: string;
  onClose: () => void;
  onGraded: (updatedOfficer: OfficerGRADScoreDto) => void;
}

const GENERIC_KEYWORDS = [
  'test', 'thử', 'abc', 'xyz', 'không có', 'chưa rõ',
  'tạm thời', 'sửa sau', 'điền đại',
];
const INCREASE_KEYWORDS = ['tốt', 'hoàn thành', 'vượt', 'xuất sắc', 'cải thiện', 'tiến bộ', 'đạt'];
const DECREASE_KEYWORDS = ['trễ', 'thiếu', 'sai', 'vi phạm', 'không hoàn thành', 'yếu', 'kém', 'chậm'];
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024; // 10MB

interface EvidenceFile {
  id: string;
  file: File;
  isInvalid: boolean;
  invalidReason?: string;
}

export function EvaluateOfficerModal({ officer, currentUserId, onClose, onGraded }: EvaluateOfficerModalProps) {
  const { user } = useAuth();
  const { addToast } = useToast();

  const initialLeaderScore = officer?.leaderScore ?? officer?.leaderEvaluationScore70 ?? 6.2;
  const initialTotalScore = officer?.finalScore ?? officer?.finalGRADScore ?? 8.9;

  const [leaderScore, setLeaderScore] = useState<number>(initialLeaderScore);
  const [reason, setReason] = useState<string>('');
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [touchedReason, setTouchedReason] = useState(false);

  // Reset state khi officer đổi
  useEffect(() => {
    if (officer) {
      setLeaderScore(officer.leaderScore ?? officer.leaderEvaluationScore70 ?? 6.2);
      setReason('');
      setEvidenceFiles([]);
      setTouchedReason(false);
    }
  }, [officer?.userId]);

  if (!officer) return null;

  const sysScore = officer.systemScore ?? officer.systemAutoScore30 ?? 2.8;
  const newTotalScore = Math.min(10.0, Math.round((sysScore + leaderScore) * 10) / 10);
  const oldScore = officer.finalScore ?? officer.finalGRADScore ?? initialTotalScore;
  const delta = newTotalScore - oldScore;
  const isNoChange = Math.abs(delta) < 0.05;
  const isSelf = !!currentUserId && officer.userId === currentUserId;

  const reasonValidation = useMemo(() => {
    const errors: string[] = [];
    if (isNoChange) return errors;
    const trimmed = reason.trim();
    if (trimmed.length < 10) errors.push('Lý do phải có ít nhất 10 ký tự.');
    const lower = trimmed.toLowerCase();
    if (GENERIC_KEYWORDS.some(k => lower.includes(k))) errors.push('Lý do quá chung chung, vui lòng mô tả cụ thể.');
    if (delta > 0 && !INCREASE_KEYWORDS.some(k => lower.includes(k))) {
      errors.push('Tăng điểm: lý do nên chứa từ khóa (tốt, hoàn thành, vượt, xuất sắc, cải thiện, tiến bộ, đạt).');
    } else if (delta < 0 && !DECREASE_KEYWORDS.some(k => lower.includes(k))) {
      errors.push('Giảm điểm: lý do nên chứa từ khóa (trễ, thiếu, sai, vi phạm, không hoàn thành, yếu, kém, chậm).');
    }
    return errors;
  }, [reason, delta, isNoChange]);

  const evidenceInvalidCount = evidenceFiles.filter(f => f.isInvalid).length;
  const canSubmit = !isNoChange && reason.trim().length >= 10 && reasonValidation.length === 0 && evidenceFiles.length > 0 && evidenceInvalidCount === 0 && !isSubmitting && !isSelf;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const additions: EvidenceFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let invalidReason: string | undefined;
      if (file.size === 0) invalidReason = 'File rỗng / 0 byte';
      else if (file.size > MAX_EVIDENCE_SIZE) invalidReason = 'File vượt quá 10MB';
      additions.push({
        id: `ev-${Date.now()}-${i}`,
        file,
        isInvalid: !!invalidReason,
        invalidReason,
      });
    }
    setEvidenceFiles(prev => [...prev, ...additions]);
    e.target.value = ''; // reset để chọn lại cùng tên
  };

  const removeFile = (id: string) => {
    setEvidenceFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedReason(true);
    if (isSelf) {
      addToast('Không thể tự đánh giá', 'Bạn không thể chấm điểm cho chính mình.', 'danger');
      return;
    }
    if (isNoChange) {
      addToast('Không có thay đổi', 'Điểm mới trùng điểm hiện tại, không cần ghi nhận.', 'warning');
      return;
    }
    if (reasonValidation.length > 0) {
      addToast('Lý do không hợp lệ', reasonValidation[0], 'danger');
      return;
    }
    if (evidenceFiles.length === 0) {
      addToast('Thiếu bằng chứng', 'Phải đính kèm ít nhất 1 file bằng chứng.', 'danger');
      return;
    }
    if (evidenceInvalidCount > 0) {
      addToast('Bằng chứng không hợp lệ', 'Có file rỗng hoặc vượt quá giới hạn. Vui lòng kiểm tra lại.', 'danger');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await submitOfficialRatingApi({
        targetUserId: officer.userId,
        targetUserName: officer.fullName,
        departmentName: officer.departmentName,
        ratingScore10: newTotalScore,
        evaluatorScore70: leaderScore,
        evaluationPeriod: new Date().toISOString().substring(0, 7),
        evaluationNotes: reason.trim(),
        reason: reason.trim(),
        evidenceFileIds: [], // Sẽ được thay thế khi có API upload file thật
      });

      const r: any = res;
      if (r?.success !== false && (r?.success === true || r?.data)) {
        const serverData = r?.data ?? r;
        const finalScore = serverData?.finalScore ?? newTotalScore;
        const tierGrade = serverData?.tierGrade ?? (finalScore >= 9.0 ? 'Hoàn thành xuất sắc' : finalScore >= 7.5 ? 'Hoàn thành tốt' : 'Hoàn thành nhiệm vụ');
        addToast('Thẩm định thành công', `Đã ghi nhận điểm thi đua cho ${officer.fullName}: ${finalScore.toFixed(1)}/10.0 (Δ ${delta > 0 ? '+' : ''}${delta.toFixed(1)})`, 'success');
        onGraded({
          ...officer,
          leaderScore,
          leaderEvaluationScore70: leaderScore,
          finalScore,
          finalScore100: Math.round(finalScore * 10),
          finalGRADScore: finalScore,
          tierGrade,
        });
        onClose();
      } else {
        addToast('Lỗi', r?.error || r?.message || 'Không thể lưu điểm đánh giá', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err?.message || 'Lỗi kết nối khi đánh giá cán bộ', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          width: '100%', maxWidth: 600, background: '#ffffff',
          borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              ⭐ Thẩm Định Điểm Thi Đua Cán Bộ
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
              Cán bộ: <strong>{officer.fullName}</strong> — {officer.roleName}
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {isSelf && (
          <div style={{ padding: '12px 20px', background: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#991b1b', fontSize: '0.85rem', fontWeight: 600 }}>
            <i className="fa-solid fa-ban" style={{ marginRight: 6 }} />
            Bạn không thể tự đánh giá điểm của chính mình để đảm bảo tính khách quan.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Tóm tắt điểm cũ → mới */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Điểm Hiện Tại</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{oldScore.toFixed(1)}đ</div>
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Thay đổi (Δ)</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: delta > 0 ? '#166534' : delta < 0 ? '#dc2626' : '#64748b', marginTop: 2 }}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Điểm Mới</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: newTotalScore >= 9.0 ? '#166534' : '#0f172a', marginTop: 2 }}>{newTotalScore.toFixed(1)}đ</div>
            </div>
          </div>

          {/* Slider điểm Lãnh đạo */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
              Điểm thẩm định Lãnh đạo (0.0 — 7.0):
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <input
                type="range"
                min="0"
                max="7.0"
                step="0.1"
                value={leaderScore}
                onChange={e => setLeaderScore(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#7c3aed' }}
                disabled={isSelf}
              />
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#5b21b6', width: 65, textAlign: 'right' }}>
                {leaderScore.toFixed(1)}/7.0
              </span>
            </div>
          </div>

          {/* Lý do thay đổi — bắt buộc khi delta */}
          {!isNoChange && (
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                Lý do thay đổi <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder={delta > 0
                  ? 'Ví dụ: Hoàn thành vượt mức KPI tháng 8, cải thiện rõ rệt so với tháng trước...'
                  : 'Ví dụ: Trễ hạn 3 hồ sơ công vụ, vi phạm quy trình...'}
                value={reason}
                onChange={e => { setReason(e.target.value); setTouchedReason(true); }}
                onBlur={() => setTouchedReason(true)}
                disabled={isSelf}
                style={{ borderColor: touchedReason && reasonValidation.length > 0 ? '#dc2626' : undefined }}
              />
              {touchedReason && reasonValidation.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.78rem', color: '#dc2626' }}>
                  {reasonValidation.map((v, i) => <li key={i}>{v}</li>)}
                </ul>
              )}
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
                {delta > 0
                  ? 'Gợi ý cho tăng điểm: hoàn thành vượt mức, cải thiện, tiến bộ, đạt chuẩn...'
                  : 'Gợi ý cho giảm điểm: trễ hạn, thiếu sót, sai phạm, không hoàn thành...'}
              </div>
            </div>
          )}

          {/* Bằng chứng — bắt buộc khi delta */}
          {!isNoChange && (
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
                Bằng chứng đính kèm <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
                disabled={isSelf}
                style={{ fontSize: '0.82rem' }}
              />
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
                Tối đa 10MB / file. File rỗng (0 byte) sẽ bị từ chối. Bằng chứng do chính cán bộ đang được đánh giá upload sẽ không hợp lệ.
              </div>
              {evidenceFiles.length > 0 && (
                <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
                  {evidenceFiles.map(f => (
                    <li
                      key={f.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        background: f.isInvalid ? '#fef2f2' : '#f0fdf4',
                        border: f.isInvalid ? '1px solid #fecaca' : '1px solid #bbf7d0',
                        borderRadius: 4,
                        marginBottom: 4,
                        fontSize: '0.82rem',
                      }}
                    >
                      <i className={`fa-solid ${f.isInvalid ? 'fa-circle-xmark' : 'fa-circle-check'}`} style={{ color: f.isInvalid ? '#dc2626' : '#16a34a' }} />
                      <span style={{ flex: 1, color: f.isInvalid ? '#991b1b' : '#166534' }}>
                        <strong>{f.file.name}</strong> — {(f.file.size / 1024).toFixed(1)} KB
                        {f.invalidReason && <span style={{ marginLeft: 8, fontStyle: 'italic' }}>({f.invalidReason})</span>}
                      </span>
                      <button type="button" onClick={() => removeFile(f.id)} className="btn btn-ghost btn-xs" style={{ padding: 2 }}>
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canSubmit}
              style={{ fontWeight: 700, background: '#7c3aed', borderColor: '#7c3aed' }}
            >
              {isSubmitting ? 'Đang lưu...' : isNoChange ? 'Không có thay đổi' : 'Lưu & Ghi Nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
