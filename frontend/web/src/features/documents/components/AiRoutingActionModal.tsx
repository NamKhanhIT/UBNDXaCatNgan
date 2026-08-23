'use client';

import React, { useState } from 'react';
import { DocumentAnalysisReport } from '../services/document-ai.service';

interface AiRoutingActionModalProps {
  report: DocumentAnalysisReport;
  routeType: 'meeting' | 'report' | 'store';
  onConfirm: (payload: any) => void;
  onClose: () => void;
}

export function AiRoutingActionModal({ report, routeType, onConfirm, onClose }: AiRoutingActionModalProps) {
  // Meeting form state
  const [meetingTitle, setMeetingTitle] = useState(report.summary.value || 'Họp triển khai công tác');
  const [meetingDate, setMeetingDate] = useState('2026-08-23');
  const [meetingStartTime, setMeetingStartTime] = useState('08:00');
  const [meetingEndTime, setMeetingEndTime] = useState('11:30');
  const [meetingLocation, setMeetingLocation] = useState(
    report.eventDetails?.value?.location || 'Hội trường UBND Xã Cát Ngạn'
  );
  const [meetingAttendees, setMeetingAttendees] = useState(
    report.eventDetails?.value?.attendees || 'Chủ tịch UBND xã, Công chức Địa chính, Văn phòng'
  );

  // Report submission form state
  const [reportNote, setReportNote] = useState('Kính trình Lãnh đạo UBND xã xem xét báo cáo công tác.');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (routeType === 'meeting') {
      onConfirm({
        type: 'meeting',
        title: meetingTitle,
        date: meetingDate,
        startTime: meetingStartTime,
        endTime: meetingEndTime,
        location: meetingLocation,
        attendees: meetingAttendees,
      });
    } else if (routeType === 'report') {
      onConfirm({
        type: 'report',
        note: reportNote,
      });
    } else {
      onConfirm({
        type: 'store',
      });
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
          maxWidth: 600,
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
              {routeType === 'meeting'
                ? 'Lên Lịch Công Tác Từ Văn Bản Mời Họp'
                : routeType === 'report'
                ? 'Tiếp Nhận Báo Cáo Vào Hàng Đợi Thẩm Định'
                : 'Lưu Trữ Văn Bản Vào Sổ Lưu'}
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
              Dữ liệu được điền tự động từ phân tích văn bản gốc
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
          <div className="card-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {routeType === 'meeting' && (
              <>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                    Tiêu đề cuộc họp:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={meetingTitle}
                    onChange={e => setMeetingTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                      Ngày diễn ra:
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={meetingDate}
                      onChange={e => setMeetingDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                      Bắt đầu:
                    </label>
                    <input
                      type="time"
                      className="form-input"
                      value={meetingStartTime}
                      onChange={e => setMeetingStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                      Kết thúc:
                    </label>
                    <input
                      type="time"
                      className="form-input"
                      value={meetingEndTime}
                      onChange={e => setMeetingEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                    Địa điểm tổ chức:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={meetingLocation}
                    onChange={e => setMeetingLocation(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                    Thành phần tham dự:
                  </label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={meetingAttendees}
                    onChange={e => setMeetingAttendees(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {routeType === 'report' && (
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                  Ý kiến tiếp nhận & trình duyệt Lãnh đạo:
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={reportNote}
                  onChange={e => setReportNote(e.target.value)}
                  required
                />
              </div>
            )}

            {routeType === 'store' && (
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.86rem', color: '#334155' }}>
                Văn bản sẽ được đánh dấu <strong>ĐÃ XỬ LÝ</strong> và lưu vào Sổ văn bản lưu trữ cơ quan.
              </div>
            )}
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
              Xác Nhận & Điều Phối
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
