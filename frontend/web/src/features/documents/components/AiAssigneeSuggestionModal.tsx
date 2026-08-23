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
  const [selectedUserId, setSelectedUserId] = useState<string>(candidates[0]?.userId || '');
  const [taskDeadline, setTaskDeadline] = useState<string>(report.deadlineDate.value || '2026-08-25');

  const selectedCandidate = candidates.find(c => c.userId === selectedUserId) || candidates[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCandidate) {
      onConfirmAssignment(selectedCandidate, taskDeadline);
    }
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
                  const isSelected = c.userId === selectedUserId;
                  return (
                    <div
                      key={c.userId}
                      onClick={() => setSelectedUserId(c.userId)}
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
                            type="radio"
                            name="assignee"
                            checked={isSelected}
                            onChange={() => setSelectedUserId(c.userId)}
                            style={{ accentColor: '#2563eb' }}
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
            >
              Xác Nhận & Giao Nhiệm Vụ Cho {selectedCandidate?.fullName}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
