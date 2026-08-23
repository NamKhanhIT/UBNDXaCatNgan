'use client';

import React from 'react';
import { DocumentAnalysisReport } from '../services/document-ai.service';
import { formatDateShort, formatDateTimeShort } from '../../../lib/formatters';

interface DocumentAiAnalysisPanelProps {
  report: DocumentAnalysisReport;
  onJumpToPage: (page: number) => void;
}

export function DocumentAiAnalysisPanel({ report, onJumpToPage }: DocumentAiAnalysisPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-file-lines" style={{ color: '#2563eb', fontSize: 16 }} aria-hidden="true" />
          <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Kết Quả Phân Tích & Trích Dẫn Chứng Cứ
          </h3>
        </div>
        <span className="badge badge-blue" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
          Đối soát nguyên văn
        </span>
      </div>

      {/* 1. Tóm tắt nội dung */}
      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a' }}>Tóm Tắt Chỉ Đạo:</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            style={{ color: '#2563eb', fontWeight: 700, padding: '2px 6px' }}
            onClick={() => onJumpToPage(report.summary.sourcePage)}
          >
            Trang {report.summary.sourcePage} →
          </button>
        </div>
        <div style={{ fontSize: '0.84rem', color: '#1e293b', lineHeight: 1.45, marginBottom: 4 }}>
          {report.summary.value}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
          Độ tin cậy: <strong>{Math.round(report.summary.confidence * 100)}%</strong>
        </div>
      </div>

      {/* 2. Hạn xử lý & Mức ưu tiên */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: report.deadlineDate.value ? '#fef2f2' : '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: '0.76rem', color: '#64748b' }}>Hạn Hoàn Thành:</span>
            {report.deadlineDate.value && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                style={{ color: '#dc2626', fontWeight: 700, padding: 0, fontSize: '0.72rem' }}
                onClick={() => onJumpToPage(report.deadlineDate.sourcePage)}
              >
                Trang {report.deadlineDate.sourcePage} →
              </button>
            )}
          </div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: report.deadlineDate.value ? '#dc2626' : '#64748b' }}>
            {report.deadlineDate.value ? formatDateShort(report.deadlineDate.value) : 'Không quy định hạn chót'}
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontWeight: 700, fontSize: '0.76rem', color: '#64748b' }}>Mức Độ Khẩn:</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              style={{ color: '#2563eb', fontWeight: 700, padding: 0, fontSize: '0.72rem' }}
              onClick={() => onJumpToPage(report.priority.sourcePage)}
            >
              Trang {report.priority.sourcePage} →
            </button>
          </div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: report.priority.value === 'Khan' ? '#dc2626' : '#2563eb' }}>
            {report.priority.value === 'Khan' ? '🔴 Hỏa Tốc / Khẩn' : '🔵 Thường'}
          </div>
        </div>
      </div>

      {/* 3. Mục tiêu & Đầu việc yêu cầu */}
      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a' }}>Mục Tiêu Chỉ Đạo Cụ Thể:</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            style={{ color: '#2563eb', fontWeight: 700, padding: '2px 6px' }}
            onClick={() => onJumpToPage(report.keyObjectives.sourcePage)}
          >
            Trang {report.keyObjectives.sourcePage} →
          </button>
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', color: '#334155', lineHeight: 1.45 }}>
          {report.keyObjectives.value?.map((obj, idx) => (
            <li key={idx} style={{ marginBottom: 4 }}>{obj}</li>
          ))}
        </ul>
      </div>

      {/* 4. Đơn vị & Đối tượng liên quan */}
      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a', marginBottom: 6 }}>
          Đơn Vị & Thành Phần Thực Hiện:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {report.relatedDepartments.value?.map((dept, idx) => (
            <span key={idx} className="badge badge-blue" style={{ fontSize: '0.74rem' }}>
              {dept}
            </span>
          ))}
        </div>
      </div>

      {/* 5. Chi tiết sự kiện cuộc họp nếu có */}
      {report.eventDetails?.value && (
        <div style={{ background: '#eff6ff', padding: 12, borderRadius: 8, border: '1.5px solid #bfdbfe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#1e40af' }}>
              <i className="fa-solid fa-calendar-days" style={{ marginRight: 6 }} aria-hidden="true" />
              Thông Tin Cuộc Họp
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              style={{ color: '#1d4ed8', fontWeight: 700, padding: 0 }}
              onClick={() => onJumpToPage(report.eventDetails!.sourcePage)}
            >
              Trang {report.eventDetails.sourcePage} →
            </button>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#1e3a8a', lineHeight: 1.45 }}>
            <div><strong>Thời gian:</strong> {formatDateTimeShort(report.eventDetails.value.startDateTime)}</div>
            <div><strong>Địa điểm:</strong> {report.eventDetails.value.location}</div>
            <div><strong>Thành phần:</strong> {report.eventDetails.value.attendees}</div>
          </div>
        </div>
      )}
    </div>
  );
}
