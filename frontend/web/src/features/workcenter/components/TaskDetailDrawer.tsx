'use client';

import React, { useState, useEffect } from 'react';
import { TaskItemDto, updateTaskStatusApi } from '../../../services/task.service';
import {
  uploadFileApi,
  getDocumentAttachmentsApi,
  getFileViewUrl,
  getFileDownloadUrl,
  DocumentAttachmentDto,
} from '../../../services/files.service';
import { useAuth } from '../../auth/AuthContext';
import { usePermission } from '../../../hooks/use-permission';
import { useToast } from '../../../components/ui/ToastContext';
import { formatDateShort, formatDateTimeShort } from '../../../lib/formatters';

interface TaskDetailDrawerProps {
  task: TaskItemDto | null;
  onClose: () => void;
  onTaskUpdated: (updatedTask: TaskItemDto) => void;
}

export function TaskDetailDrawer({ task, onClose, onTaskUpdated }: TaskDetailDrawerProps) {
  const { user } = useAuth();
  const { can } = usePermission();
  const { addToast } = useToast();

  // Attachments State
  const [attachments, setAttachments] = useState<DocumentAttachmentDto[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState<boolean>(false);

  // Submission Form State
  const [submissionNote, setSubmissionNote] = useState<string>(task?.submissionNote || '');
  const [attachmentFileName, setAttachmentFileName] = useState<string>('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Approval Form State
  const [evaluatorScore, setEvaluatorScore] = useState<number>(task?.evaluatorScore ?? 0);
  const [approvalNote, setApprovalNote] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  const loadAttachments = async (taskId: string) => {
    setIsLoadingAttachments(true);
    try {
      const res = await getDocumentAttachmentsApi(taskId, 'Task');
      if (res.success && res.data) {
        setAttachments(res.data);
      }
    } catch {
      // Ignore background load error
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  useEffect(() => {
    if (task?.id) {
      loadAttachments(task.id);
    }
  }, [task?.id]);

  if (!task) return null;

  const isAssignee = task.assigneeName === user?.fullName || task.assigneeId === user?.userId;
  const isAssignerOrLeader = can('AssignTask') || can('ViewExecutiveDashboard') || can('ViewDepartmentDashboard') || task.assignerId === user?.userId;

  // Xử lý nộp kết quả công việc ngay trong task
  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionNote.trim()) {
      addToast('Cảnh báo', 'Vui lòng nhập nội dung báo cáo kết quả thực hiện', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      if (attachmentFile) {
        const upload = await uploadFileApi(attachmentFile, task.id, 'Task', 'Result');
        if (!upload.success) {
          throw new Error(upload.error || 'Không thể tải tệp kết quả lên máy chủ.');
        }
      }
      const res = await updateTaskStatusApi(task.id, {
        status: 'InReview',
        submissionNote: submissionNote.trim(),
      });

      if (res.success) {
        addToast('Nộp thành công', 'Báo cáo kết quả đã được chuyển tới Lãnh đạo phê duyệt', 'success');
        setAttachmentFile(null);
        setAttachmentFileName('');
        await loadAttachments(task.id);
        onTaskUpdated({
          ...task,
          status: 'InReview',
          submissionNote: submissionNote.trim(),
          progressPercentage: task.progressPercentage,
        });
      } else {
        addToast('Lỗi', res.error || 'Không thể nộp báo cáo kết quả', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Lỗi kết nối khi nộp báo cáo', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý phê duyệt kết quả & chấm điểm ngay trong task
  const handleApproveWork = async () => {
    if (!Number.isFinite(evaluatorScore) || evaluatorScore < 0 || evaluatorScore > 7) {
      addToast('Invalid score', 'Evaluator score must be between 0 and 7.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await updateTaskStatusApi(task.id, {
        status: 'Completed',
        evaluatorScore,
        submissionNote: task.submissionNote,
      });

      if (res.success) {
        addToast('Phê duyệt thành công', `Đã nghiệm thu nhiệm vụ với điểm đánh giá: ${evaluatorScore}/10.0`, 'success');
        onTaskUpdated({
          ...task,
          status: 'Completed',
          evaluatorScore,
          ratingScore: undefined,
          progressPercentage: 100,
          completedAt: new Date().toISOString(),
        });
      } else {
        addToast('Lỗi', res.error || 'Không thể phê duyệt nhiệm vụ', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Lỗi khi phê duyệt nhiệm vụ', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý yêu cầu chỉnh sửa / trả lại kết quả
  const handleRejectWork = async () => {
    if (!rejectionReason.trim()) {
      addToast('Cảnh báo', 'Vui lòng nhập lý do yêu cầu chỉnh sửa / bổ sung', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await updateTaskStatusApi(task.id, {
        status: 'InProgress',
        rejectionReason: rejectionReason.trim(),
      });

      if (res.success) {
        addToast('Đã trả lại', 'Đã chuyển yêu cầu chỉnh sửa cho cán bộ thực hiện', 'info');
        onTaskUpdated({
          ...task,
          status: 'InProgress',
          rejectionReason: rejectionReason.trim(),
          progressPercentage: 50,
        });
        setIsRejecting(false);
      } else {
        addToast('Lỗi', res.error || 'Không thể trả lại nhiệm vụ', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Lỗi khi trả lại nhiệm vụ', 'danger');
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
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 680,
          background: '#ffffff',
          height: '100%',
          boxShadow: '-8px 0 25px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── DRAWER HEADER ── */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className={`badge ${
                task.status === 'Completed' || task.status === 'Hoan_Thanh'
                  ? 'badge-success'
                  : task.status === 'InReview' || task.status === 'Cho_Duyet'
                  ? 'badge-warning'
                  : task.status === 'Cancelled' || task.status === 'Tu_Choi'
                  ? 'badge-danger'
                  : 'badge-blue'
              }`}
              style={{ fontSize: '0.76rem', padding: '3px 8px' }}
            >
              {task.status === 'Completed' || task.status === 'Hoan_Thanh'
                ? '✓ Đã hoàn thành'
                : task.status === 'InReview' || task.status === 'Cho_Duyet'
                ? '⏳ Chờ phê duyệt'
                : task.status === 'Cancelled' || task.status === 'Tu_Choi'
                ? '⚠️ Cần sửa đổi'
                : task.status === 'InProgress' || task.status === 'Dang_Xu_Ly'
                ? '▶ Đang thực hiện'
                : '○ Chưa bắt đầu'}
            </span>
            <span style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>
              Mã: <strong>{task.id.substring(0, 12)}</strong>
            </span>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ width: 32, height: 32, padding: 0 }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: 16 }} aria-hidden="true" />
          </button>
        </div>

        {/* ── DRAWER BODY (SCROLLABLE) ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Tiêu đề & Trích yếu */}
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', lineHeight: 1.4 }}>
              {task.title}
            </h1>
            <p style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.5, margin: 0 }}>
              {task.description || 'Không có mô tả chi tiết.'}
            </p>
            {task.requirements && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                  Yêu cầu / kết quả cần đạt
                </div>
                <div style={{ fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.5 }}>
                  {task.requirements}
                </div>
              </div>
            )}
          </div>

          {/* Bảng Metadata nhiệm vụ */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
              background: '#f8fafc',
              padding: 14,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              fontSize: '0.82rem',
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>Người giao việc:</span>{' '}
              <strong style={{ color: '#0f172a' }}>{task.assignerName || 'Lãnh đạo'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Người thực thi:</span>{' '}
              <strong style={{ color: '#0f172a' }}>{task.assigneeName || 'Chuyên viên'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Hạn chót:</span>{' '}
              <strong style={{ color: '#dc2626' }}>{formatDateShort(task.dueDate)}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Độ ưu tiên:</span>{' '}
              <strong style={{ color: task.priority === 'Khan' ? '#dc2626' : '#2563eb' }}>
                {task.priority === 'Khan' ? '🔴 Khẩn cấp' : task.priority === 'Cao' ? '🟠 Cao' : '🔵 Thường'}
              </strong>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              TỆP ĐÍNH KÈM & HỒ SƠ KẾT QUẢ (TASK ATTACHMENTS)
              ══════════════════════════════════════════════════════════════ */}
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-paperclip" style={{ color: '#2563eb', fontSize: 15 }} aria-hidden="true" />
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Tệp đính kèm & Hồ sơ kết quả ({attachments.length})
                </h4>
              </div>
              {isLoadingAttachments && (
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Đang tải...</span>
              )}
            </div>

            {attachments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attachments.map(att => (
                  <div
                    key={att.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#ffffff',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <i
                        className={
                          att.fileType.toLowerCase() === 'pdf'
                            ? 'fa-solid fa-file-pdf text-red-600'
                            : ['doc', 'docx'].includes(att.fileType.toLowerCase())
                            ? 'fa-solid fa-file-word text-blue-600'
                            : 'fa-solid fa-file text-slate-500'
                        }
                        style={{ fontSize: 16 }}
                        aria-hidden="true"
                      />
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{att.originalFileName}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {Math.round(att.fileSize / 1024)} KB • {formatDateTimeShort(att.uploadedAt)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <a
                        href={getFileViewUrl(att.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline btn-sm"
                        style={{ padding: '2px 8px', fontSize: '0.74rem' }}
                      >
                        <i className="fa-solid fa-eye" style={{ marginRight: 4 }} aria-hidden="true" />
                        Xem
                      </a>
                      <a
                        href={getFileDownloadUrl(att.id)}
                        download
                        className="btn btn-outline btn-sm"
                        style={{ padding: '2px 8px', fontSize: '0.74rem' }}
                      >
                        <i className="fa-solid fa-download" style={{ marginRight: 4 }} aria-hidden="true" />
                        Tải
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                Chưa có tệp tài liệu nào được đính kèm vào nhiệm vụ này.
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════
1. KHỐI NỘP BÁO CÁO KẾT QUẢ (INLINE SUBMISSION — QUY TẮC 1)
               Audit 04-09-2026: KHỐI này chỉ hiển thị cho assignee — nếu caller là
               assigner / leader không thực hiện thì ẩn hoàn toàn để không gây nhầm lẫn.
               ══════════════════════════════════════════════════════════════ */}
          {isAssignee && (['Todo', 'InProgress', 'Cancelled', 'Chua_Lam', 'Dang_Xu_Ly', 'Tu_Choi'].includes(task.status)) && (
            <div style={{ border: '1.5px solid #93c5fd', borderRadius: 10, padding: 16, background: '#eff6ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <i className="fa-solid fa-paper-plane" style={{ color: '#2563eb', fontSize: 16 }} aria-hidden="true" />
                <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#1e3a8a', margin: 0 }}>
                  Nộp Báo Cáo Kết Quả & Đính Kèm Tệp
                </h3>
              </div>

              {task.rejectionReason && (
                <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, marginBottom: 12, fontSize: '0.8rem', color: '#991b1b' }}>
                  <strong>Lãnh đạo yêu cầu bổ sung:</strong> {task.rejectionReason}
                </div>
              )}

              <form onSubmit={handleSubmitWork} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                    Nội dung báo cáo kết quả thực hiện:
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    style={{ fontSize: '0.84rem', resize: 'vertical' }}
                    placeholder="Mô tả tóm tắt kết quả xử lý, số liệu đạt được, các kiến nghị (nếu có)..."
                    value={submissionNote}
                    onChange={e => setSubmissionNote(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                    Đính kèm tệp văn bản kết quả / Báo cáo (.pdf, .docx, .xlsx):
                  </label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input
                      type="file"
                      id="task-file-input"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAttachmentFile(file);
                          setAttachmentFileName(file.name);
                        }
                      }}
                    />
                    <label
                      htmlFor="task-file-input"
                      className="btn btn-outline btn-sm"
                      style={{ cursor: 'pointer', fontWeight: 700 }}
                    >
                      <i className="fa-solid fa-paperclip" style={{ marginRight: 6 }} aria-hidden="true" />
                      Chọn Tệp
                    </label>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {attachmentFileName || 'Chưa chọn tệp đính kèm'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                    style={{ fontWeight: 700, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />
                    <span>{isSubmitting ? 'Đang gửi...' : 'Nộp Báo Cáo Kết Quả'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              2. KHỐI PHÊ DUYỆT & CHẤM ĐIỂM (INLINE APPROVAL — QUY TẮC 2)
              ══════════════════════════════════════════════════════════════ */}
          {(task.status === 'InReview' || task.status === 'Cho_Duyet') && (
            <div style={{ border: '1.5px solid #c4b5fd', borderRadius: 10, padding: 16, background: '#f5f3ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <i className="fa-solid fa-stamp" style={{ color: '#7c3aed', fontSize: 16 }} aria-hidden="true" />
                <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#5b21b6', margin: 0 }}>
                  Thẩm Định & Nghiệm Thu Nhiệm Vụ (Thang Điểm 10)
                </h3>
              </div>

              {/* Báo cáo mà cán bộ đã nộp */}
              <div style={{ background: '#ffffff', padding: 12, borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginBottom: 4 }}>
                  Nội dung cán bộ ({task.assigneeName}) nộp:
                </div>
                <div style={{ fontSize: '0.86rem', color: '#0f172a', lineHeight: 1.45 }}>
                  {task.submissionNote || 'Đã hoàn thành theo đúng yêu cầu chỉ đạo.'}
                </div>
              </div>

              {isAssignerOrLeader && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                      Chấm điểm thẩm định lãnh đạo (Tối đa 10.0 điểm):
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input
                        type="range"
                        min="5.0"
                        max="7.0"
                        step="0.5"
                        value={evaluatorScore}
                        onChange={e => setEvaluatorScore(parseFloat(e.target.value))}
                        style={{ flex: 1, accentColor: '#7c3aed' }}
                      />
                      <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#5b21b6', width: 60, textAlign: 'right' }}>
                        {evaluatorScore.toFixed(1)}/10đ
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                      Ý kiến chỉ đạo / Nhận xét của Lãnh đạo:
                    </label>
                    <input
                      className="form-input"
                      placeholder="Ghi nhận nỗ lực hoàn thành đúng hạn..."
                      value={approvalNote}
                      onChange={e => setApprovalNote(e.target.value)}
                    />
                  </div>

                  {isRejecting ? (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#dc2626' }}>
                        Lý do yêu cầu sửa đổi / bổ sung:
                      </label>
                      <textarea
                        className="form-input"
                        rows={2}
                        placeholder="Nêu rõ điểm chưa đạt, số liệu cần rà soát lại..."
                        value={rejectionReason}
                        onChange={e => setRejectionReason(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setIsRejecting(false)}
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={handleRejectWork}
                          disabled={isSubmitting}
                          style={{ fontWeight: 700 }}
                        >
                          Xác nhận trả lại
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-danger btn-sm"
                        onClick={() => setIsRejecting(true)}
                        style={{ fontWeight: 700 }}
                      >
                        <i className="fa-solid fa-rotate-left" style={{ marginRight: 6 }} aria-hidden="true" />
                        Yêu Cầu Chỉnh Sửa
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleApproveWork}
                        disabled={isSubmitting}
                        style={{ fontWeight: 700, background: '#7c3aed', borderColor: '#7c3aed' }}
                      >
                        <i className="fa-solid fa-check" style={{ marginRight: 6 }} aria-hidden="true" />
                        Phê Duyệt & Ghi Điểm
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              3. KHỐI LỊCH SỬ VÒNG ĐỜI (TASK TIMELINE AUDIT — QUY TẮC 3)
              ══════════════════════════════════════════════════════════════ */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ color: '#64748b', fontSize: 16 }} aria-hidden="true" />
              <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Lịch Sử Vòng Đời Nhiệm Vụ (Task Timeline)
              </h3>
            </div>

            <div style={{ paddingLeft: 10, borderLeft: '2px solid #e2e8f0', marginLeft: 6, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Event 1: Khởi tạo */}
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: -17,
                    top: 2,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: '#2563eb',
                    border: '2px solid #fff',
                  }}
                />
                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>
                  Giao việc: {task.title}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Người giao: <strong>{task.assignerName || 'Lãnh đạo'}</strong> • {formatDateTimeShort(task.createdAt)}
                </div>
              </div>

              {/* Event 2: Báo cáo nộp kết quả (nếu có) */}
              {task.submissionNote && (
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: -17,
                      top: 2,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: '#d97706',
                      border: '2px solid #fff',
                    }}
                  />
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>
                    Cán bộ nộp báo cáo kết quả
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: 2 }}>
                    "{task.submissionNote}"
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                    Người nộp: <strong>{task.assigneeName}</strong>
                  </div>
                </div>
              )}

              {/* Event 3: Hoàn thành & Chấm điểm (nếu có) */}
              {(task.status === 'Completed' || task.status === 'Hoan_Thanh') && (
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: -17,
                      top: 2,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: '#16a34a',
                      border: '2px solid #fff',
                    }}
                  />
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#166534' }}>
                    Lãnh đạo nghiệm thu hoàn thành{task.ratingScore != null ? ` - Điểm: ${task.ratingScore.toFixed(1)}/10.0` : ''}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Thời gian: {formatDateTimeShort(task.completedAt || task.createdAt)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── DRAWER FOOTER ── */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
