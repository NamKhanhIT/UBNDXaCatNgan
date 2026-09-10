'use client';

import React, { useState } from 'react';
import { AssigneeCandidate, DocumentAnalysisReport } from '../services/document-ai.service';

interface AiAssigneeSuggestionModalProps {
  report: DocumentAnalysisReport;
  candidates: AssigneeCandidate[];
  onConfirmAssignment: (selectedCandidate: AssigneeCandidate, deadline: string) => void;
  onClose: () => void;
}

export function AiAssigneeSuggestionModal({
  report,
  candidates,
  onConfirmAssignment,
  onClose,
}: AiAssigneeSuggestionModalProps) {
  // BẢO MẬT (Audit 04-09-2026): Khởi tạo chỉ với candidate đầu tiên KHÔNG trùng currentUser;
  // caller sẽ tự thêm các candidate khác.
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    candidates.length > 0 ? [candidates[0].userId] : []
  );
  const [taskDeadline, setTaskDeadline] = useState<string>(report.deadlineDate.value || '');
  const [instructions, setInstructions] = useState<string>('');
  const [requiredResults, setRequiredResults] = useState<string[]>([
    'Hoàn thành đúng hạn chót',
    'Báo cáo kết quả kèm minh chứng',
  ]);
  const [newRequiredResult, setNewRequiredResult] = useState<string>('');

  const toggleSelection = (uid: string) => {
    setSelectedUserIds(prev =>
      prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const primary = candidates.find(c => c.userId === selectedUserIds[0]);
    if (!primary) return;
    // Gộp chỉ thị bổ sung + checklist vào deadline / instructions qua dữ liệu bổ sung kèm object
    const richCandidate: AssigneeCandidate & {
      extraAssigneeIds?: string[];
      instructions?: string;
      requiredResults?: string[];
    } = {
      ...primary,
      extraAssigneeIds: selectedUserIds.slice(1),
      instructions,
      requiredResults,
    };
    onConfirmAssignment(richCandidate, taskDeadline);
  };

  const addRequiredResult = () => {
    const trimmed = newRequiredResult.trim();
    if (!trimmed) return;
    setRequiredResults(prev => [...prev, trimmed]);
    setNewRequiredResult('');
  };

  const removeRequiredResult = (idx: number) => {
    setRequiredResults(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
      >
        <div
          className="card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Đề Xuất Cán Bộ Thụ Lý Nhiệm Vụ
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
              Dựa trên chuyên môn, kinh nghiệm thực tế và mức độ tải công việc hiện tại
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ fontSize: '1.1rem', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="card-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Tóm tắt văn bản */}
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700 }}>VĂN BẢN CHỈ ĐẠO</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                {report.summary.value}
              </div>
            </div>

            {/* Danh sách cán bộ đề xuất */}
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
                Danh Sách Cán Bộ Phù Hợp:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {candidates.map(c => {
                  const isSelected = selectedUserIds.includes(c.userId);
                  return (
                    <div
                      key={c.userId}
                      onClick={() => toggleSelection(c.userId)}
                      style={{
                        padding: 14,
                        borderRadius: 8,
                        border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input
                            type="checkbox"
                            name="assignee"
                            checked={isSelected}
                            onChange={() => toggleSelection(c.userId)}
                            style={{ accentColor: '#2563eb' }}
                            aria-label={`Chọn ${c.fullName}`}
                          />
                          <div>
                            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                              {c.fullName}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', marginLeft: 8 }}>
                              {c.roleName} • {c.departmentName}
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span
                            className="badge badge-success"
                            style={{ fontSize: '0.78rem', fontWeight: 800, padding: '3px 8px' }}
                          >
                            Độ phù hợp: {c.scorePercentage}%
                          </span>
                        </div>
                      </div>

                      {/* Phân tích lý do */}
                      <div style={{ paddingLeft: 24, fontSize: '0.78rem', color: '#334155' }}>
                        {c.positiveReasons.map((r, idx) => (
                          <div key={idx} style={{ color: '#166534', marginBottom: 2 }}>
                            + {r}
                          </div>
                        ))}
                        {c.negativeReasons.map((r, idx) => (
                          <div key={idx} style={{ color: '#b45309', marginBottom: 2 }}>
                            - {r}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hướng dẫn bổ sung */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                Hướng dẫn bổ sung (tối đa 1000 ký tự):
              </label>
              <textarea
                className="form-input"
                rows={2}
                maxLength={1000}
                placeholder="Yêu cầu bổ sung cho cán bộ thụ lý..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>

            {/* Kết quả mong đợi (checklist) */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                Kết quả mong đợi (checklist):
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {requiredResults.map((item, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked readOnly />
                    <span style={{ flex: 1, fontSize: '0.86rem' }}>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeRequiredResult(idx)}
                      style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                      aria-label="Xóa mục"
                    >
                      ✕
                    </button>
                  </label>
                ))}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Thêm mục kết quả mới..."
                    value={newRequiredResult}
                    onChange={e => setNewRequiredResult(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addRequiredResult();
                      }
                    }}
                    className="form-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={addRequiredResult}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Hạn hoàn thành nhiệm vụ */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                Hạn hoàn thành giao việc (*):
              </label>
              <input
                type="date"
                className="form-input"
                value={taskDeadline}
                onChange={e => setTaskDeadline(e.target.value)}
                required
              />
            </div>
          </div>

          <div
            className="card-footer"
            style={{
              padding: '12px 20px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <button type="button" className="btn btn-ghost" onClick={onClose} style={{ fontWeight: 700 }}>
              Đóng
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ fontWeight: 800, padding: '8px 20px' }}
              disabled={selectedUserIds.length === 0}
            >
              {selectedUserIds.length > 1
                ? `Xác Nhận & Giao (${selectedUserIds.length} cán bộ)`
                : candidates.find(c => c.userId === selectedUserIds[0])?.fullName
                  ? `Xác Nhận & Giao Nhiệm Vụ Cho ${candidates.find(c => c.userId === selectedUserIds[0])?.fullName}`
                  : 'Xác Nhận & Giao Nhiệm Vụ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
