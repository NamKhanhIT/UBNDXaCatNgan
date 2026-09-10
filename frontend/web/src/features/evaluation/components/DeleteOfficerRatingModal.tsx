'use client';

import React, { useState, useMemo } from 'react';
import {
  OfficerGRADScoreDto,
  deleteOfficerRatingApi,
  uploadEvaluationEvidenceApi,
} from '../../../services/report.service';
import { useToast } from '../../../components/ui/ToastContext';

interface DeleteOfficerRatingModalProps {
  officer: OfficerGRADScoreDto;
  currentUserId?: string;
  evaluationPeriod?: string;
  onClose: () => void;
  onDeleted: (userId: string, tasksReset: number) => void;
}

// Blocklist giống backend RatingReasonValidator (mirror UI)
const GENERIC_KEYWORDS = [
  'test', 'thử', 'abc', 'xyz', 'không có', 'chưa rõ',
  'tạm thời', 'sửa sau', 'điền đại',
];
const DECREASE_KEYWORDS = ['trễ', 'thiếu', 'sai', 'vi phạm', 'không hoàn thành', 'yếu', 'kém', 'chậm'];
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EVIDENCE_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'docx'];

export function DeleteOfficerRatingModal({
  officer,
  currentUserId,
  evaluationPeriod,
  onClose,
  onDeleted,
}: DeleteOfficerRatingModalProps) {
  const { addToast } = useToast();
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);

  const isSelf = !!currentUserId && officer.userId === currentUserId;

  const validation = useMemo(() => {
    const errors: string[] = [];
    const trimmed = reason.trim();
    if (trimmed.length < 10) errors.push('Lý do phải có ít nhất 10 ký tự.');
    const lower = trimmed.toLowerCase();
    if (GENERIC_KEYWORDS.some(k => lower.includes(k))) {
      errors.push('Lý do quá chung chung, vui lòng mô tả cụ thể.');
    }
    // Xóa điểm luôn là giảm → bắt buộc chứa từ khóa giảm
    if (!DECREASE_KEYWORDS.some(k => lower.includes(k))) {
      errors.push('Lý do xóa phải giải thích lý do cụ thể (trễ hạn, sai sót, vi phạm, ...).');
    }
    if (evidenceIds.length === 0) {
      errors.push('Phải đính kèm ít nhất 1 bằng chứng.');
    }
    return errors;
  }, [reason, evidenceIds.length]);

  const canSubmit = reason.trim().length > 0 && confirmed && validation.length === 0 && !isSelf;

  const handleEvidenceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // reset để cho phép chọn lại cùng file
    for (const file of files) {
      // Client-side validation
      if (file.size === 0) {
        addToast('Lỗi file', `"${file.name}" rỗng / 0 byte.`, 'danger');
        continue;
      }
      if (file.size > MAX_EVIDENCE_SIZE) {
        addToast('Lỗi file', `"${file.name}" vượt quá 10MB.`, 'danger');
        continue;
      }
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EVIDENCE_EXT.includes(ext)) {
        addToast('Lỗi file', `Loại file .${ext} không được hỗ trợ.`, 'danger');
        continue;
      }

      setUploadingFile(true);
      try {
        const id = await uploadEvaluationEvidenceApi(file);
        setEvidenceIds(prev => [...prev, id]);
        addToast('Tải file thành công', `Đã upload "${file.name}".`, 'success');
      } catch (err: any) {
        addToast('Lỗi upload', err?.message || `Không thể tải "${file.name}".`, 'danger');
      } finally {
        setUploadingFile(false);
      }
    }
  };

  const removeEvidence = (id: string) => {
    setEvidenceIds(prev => prev.filter(x => x !== id));
  };

  const handleSubmit = async () => {
    if (isSelf) {
      setError('Bạn không thể xóa điểm của chính mình.');
      return;
    }
    if (!canSubmit) {
      setError(validation[0] || 'Vui lòng điền lý do, bằng chứng và xác nhận.');
      return;
    }

    setError(null);
    try {
      const result = await deleteOfficerRatingApi({
        targetUserId: officer.userId,
        evaluationPeriod: evaluationPeriod || new Date().toISOString().slice(0, 7),
        reason: reason.trim(),
        evidenceFileIds: evidenceIds,
      });
      const tasksReset = result?.data?.tasksReset ?? 0;
      addToast(
        'Xóa điểm thành công',
        `Đã xóa điểm thi đua cho ${officer.fullName}. ${tasksReset > 0 ? `Đã reset ${tasksReset} đầu việc.` : ''}`,
        'success'
      );
      onDeleted(officer.userId, tasksReset);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Không thể xóa điểm thi đua.');
    }
  };

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
          width: '100%', maxWidth: 540, background: '#ffffff',
          borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#fef2f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#dc2626' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8 }} />
            Xóa Điểm Đánh Giá
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 12, borderRadius: 6, fontSize: '0.85rem', color: '#991b1b' }}>
            Bạn đang yêu cầu <strong>xóa điểm đánh giá</strong> của <strong>{officer.fullName}</strong> ({officer.departmentName}).
            <br />
            Hành động này sẽ được ghi nhận vào audit log và chỉ lãnh đạo cấp cao mới có quyền thực hiện.
          </div>

          {isSelf && (
            <div style={{ background: '#fee2e2', border: '2px solid #dc2626', padding: 10, borderRadius: 6, fontSize: '0.85rem', color: '#991b1b', fontWeight: 700 }}>
              <i className="fa-solid fa-ban" style={{ marginRight: 6 }} />
              Không thể xóa điểm của chính mình.
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
              Lý do xóa điểm <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Ví dụ: Nhập sai điểm do lỗi nhập liệu; cán bộ chuyển công tác sang đơn vị khác..."
              value={reason}
              onChange={e => { setReason(e.target.value); setError(null); }}
              disabled={isSelf}
              style={{ borderColor: validation.length > 0 && reason.length > 0 ? '#dc2626' : undefined }}
            />
            {validation.length > 0 && reason.length > 0 && (
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.78rem', color: '#dc2626' }}>
                {validation.map((v, i) => <li key={i}>{v}</li>)}
              </ul>
            )}
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 4 }}>
              Lý do phải có từ khóa giảm điểm (trễ hạn, sai sót, vi phạm, ...) để hợp lệ.
            </div>
          </div>

          {/* Evidence upload */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 }}>
              Bằng chứng <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="file"
              accept={ALLOWED_EVIDENCE_EXT.map(x => `.${x}`).join(',')}
              multiple
              onChange={handleEvidenceChange}
              disabled={isSelf || uploadingFile}
              style={{ fontSize: '0.82rem' }}
            />
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 4 }}>
              PDF, PNG, JPG, DOCX. Tối đa 10MB mỗi file. Bằng chứng do chính cán bộ đang đánh giá upload sẽ bị từ chối.
            </div>
            {evidenceIds.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '0.82rem', color: '#1e293b' }}>
                {evidenceIds.map(id => (
                  <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fa-solid fa-paperclip" style={{ color: '#0ea5e9' }} />
                    <code style={{ fontSize: '0.72rem' }}>{id.slice(0, 8)}…</code>
                    <button
                      type="button"
                      onClick={() => removeEvidence(id)}
                      style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem' }}
                      title="Gỡ file"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#1e293b' }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              disabled={isSelf}
            />
            <span>Tôi hiểu hành động này không thể hoàn tác và sẽ được ghi vào lịch sử.</span>
          </label>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 10, borderRadius: 6, fontSize: '0.82rem', color: '#991b1b' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!canSubmit || uploadingFile}
            onClick={handleSubmit}
            style={{ background: '#dc2626', borderColor: '#dc2626', fontWeight: 700 }}
          >
            {uploadingFile ? (
              <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }} />Đang upload...</>
            ) : (
              <><i className="fa-solid fa-trash" style={{ marginRight: 6 }} />Xác nhận xóa</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
