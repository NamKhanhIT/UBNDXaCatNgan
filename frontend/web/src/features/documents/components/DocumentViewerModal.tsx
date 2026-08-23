'use client';

import React, { useState } from 'react';
import { usePermission } from '../../../hooks/use-permission';
import { DocumentAnalysisReport } from '../services/document-ai.service';
import { DocumentAiAnalysisPanel } from './DocumentAiAnalysisPanel';
import { TaskChecklistViewer } from './TaskChecklistViewer';
import { GeneratedSubTask } from '../services/document-ai.service';

interface DocumentViewerModalProps {
  document: {
    id: string;
    documentNumber: string;
    documentSymbol?: string;
    subject: string;
    category?: string;
    sender: string;
    issuedDate?: string;
    receivedDate?: string;
    isUrgent: boolean;
    processingStatus: 'PendingConfirmation' | 'PendingProcessing' | 'PendingAssignment' | 'PendingApproval' | 'Completed';
  };
  analysisReport: DocumentAnalysisReport;
  subTasks: GeneratedSubTask[];
  onOpenAssignModal: () => void;
  onOpenRoutingModal: (type: 'meeting' | 'report' | 'store') => void;
  onSubTasksChange: (updated: GeneratedSubTask[]) => void;
  onClose: () => void;
}

export function DocumentViewerModal({
  document,
  analysisReport,
  subTasks,
  onOpenAssignModal,
  onOpenRoutingModal,
  onSubTasksChange,
  onClose,
}: DocumentViewerModalProps) {
  const { can } = usePermission();

  const [activePage, setActivePage] = useState<number>(1);
  const [activeRightTab, setActiveRightTab] = useState<'evidence' | 'checklist'>('evidence');

  const totalPages = 2;

  const handleJumpToPage = (page: number) => {
    setActivePage(page);
  };

  const getStatusBadge = () => {
    switch (document.processingStatus) {
      case 'PendingConfirmation':
        return <span className="badge badge-warning" style={{ fontWeight: 800 }}>CHỜ XÁC NHẬN</span>;
      case 'PendingProcessing':
        return <span className="badge badge-blue" style={{ fontWeight: 800 }}>CHỜ XỬ LÝ</span>;
      case 'PendingAssignment':
        return <span className="badge badge-blue" style={{ fontWeight: 800 }}>CHỜ GIAO VIỆC</span>;
      case 'PendingApproval':
        return <span className="badge badge-warning" style={{ fontWeight: 800 }}>CHỜ DUYỆT</span>;
      case 'Completed':
        return <span className="badge badge-success" style={{ fontWeight: 800 }}>ĐÃ XỬ LÝ</span>;
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
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
          width: '96vw',
          maxWidth: 1320,
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="card-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: '12px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {getStatusBadge()}
              {document.isUrgent && <span className="badge badge-danger" style={{ fontWeight: 800 }}>HỎA TỐC</span>}
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0f172a', maxWidth: 680, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {document.documentNumber ? `Số ${document.documentNumber} — ` : ''}{document.subject}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ fontSize: '1.2rem', color: '#64748b' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* 2-Column Body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* ── CỘT TRÁI: DOCUMENT PREVIEW VỚI HỖ TRỢ NHẢY TRANG ── */}
          <div
            style={{
              background: '#475569',
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid #cbd5e1',
              overflow: 'hidden',
            }}
          >
            {/* Toolbar trình xem văn bản */}
            <div
              style={{
                background: '#1e293b',
                padding: '8px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>Trang:</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  disabled={activePage <= 1}
                  onClick={() => setActivePage(prev => Math.max(1, prev - 1))}
                  style={{ color: '#ffffff', padding: '2px 8px' }}
                >
                  ◀
                </button>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, background: '#334155', padding: '2px 10px', borderRadius: 4 }}>
                  {activePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  disabled={activePage >= totalPages}
                  onClick={() => setActivePage(prev => Math.min(totalPages, prev + 1))}
                  style={{ color: '#ffffff', padding: '2px 8px' }}
                >
                  ▶
                </button>
              </div>

              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Định dạng: <strong>PDF Chuẩn Ban Hành</strong>
              </div>
            </div>

            {/* Document Page Canvas */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: '100%',
                  maxWidth: 640,
                  minHeight: 780,
                  background: '#ffffff',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                  padding: '36px 44px',
                  fontFamily: '"Times New Roman", Times, serif',
                  color: '#000000',
                  lineHeight: 1.45,
                  fontSize: '0.95rem',
                }}
              >
                {activePage === 1 ? (
                  <div>
                    {/* Quốc hiệu tiêu ngữ */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', marginBottom: 20 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                          {analysisReport.issuingAgency.value?.toUpperCase() || 'ỦY BAN NHÂN DÂN'}
                        </div>
                        <div style={{ fontSize: '0.85rem', borderBottom: '1px solid #000', paddingBottom: 2, display: 'inline-block' }}>
                          Số: {analysisReport.documentNumber.value || '142'}/{analysisReport.documentSymbol.value || 'CT-UBND'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', borderBottom: '1px solid #000', paddingBottom: 2, display: 'inline-block' }}>
                          Độc lập - Tự do - Hạnh phúc
                        </div>
                        <div style={{ fontStyle: 'italic', fontSize: '0.85rem', marginTop: 4 }}>
                          {analysisReport.issuedDate.value ? `Ngày ${analysisReport.issuedDate.value}` : 'Năm 2026'}
                        </div>
                      </div>
                    </div>

                    {/* Tiêu đề văn bản */}
                    <div style={{ textAlign: 'center', margin: '24px 0 16px 0' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', textTransform: 'uppercase' }}>
                        {analysisReport.documentType.value === 'HopThuMoi'
                          ? 'GIẤY MỜI HỌP'
                          : analysisReport.documentType.value === 'ChiDao'
                          ? 'CHỈ THỊ CÔNG TÁC'
                          : 'BÁO CÁO KẾT QUẢ CÔNG TÁC'}
                      </div>
                      <div style={{ fontStyle: 'italic', fontSize: '0.95rem', marginTop: 4 }}>
                        Về việc: {analysisReport.summary.value}
                      </div>
                    </div>

                    {/* Nội dung trang 1 */}
                    <div style={{ textAlign: 'justify', textIndent: 24, marginBottom: 12 }}>
                      Thực hiện nhiệm vụ chỉ đạo điều hành phát triển kinh tế xã hội và đảm bảo an ninh trật tự trên địa bàn xã Cát Ngạn năm 2026; Ủy ban nhân dân yêu cầu các ban ngành, đoàn thể và cán bộ công chức trực thuộc triển khai nghiêm túc các nội dung sau:
                    </div>

                    <div style={{ paddingLeft: 16, marginBottom: 12 }}>
                      <p><strong>1. Đối tượng và phạm vi thi hành:</strong> Toàn thể cán bộ, công chức và nhân dân 12 thôn xóm trên địa bàn xã Cát Ngạn.</p>
                      <p><strong>2. Yêu cầu trọng tâm:</strong> Triển khai đồng bộ các giải pháp quản lý đất đai, tăng cường kiểm tra thực địa và xử lý dứt điểm các vướng mắc tồn đọng.</p>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: 40, color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      — Hết nội dung Trang 1 —
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Nội dung trang 2 */}
                    <div style={{ textAlign: 'justify', marginBottom: 16 }}>
                      <p><strong>3. Phân công tổ chức thực hiện và Thời hạn hoàn thành:</strong></p>
                      <p style={{ textIndent: 24 }}>
                        - Giao Phòng Kinh tế & Địa chính chủ trì, phối hợp với Văn phòng HĐND & UBND tham mưu kế hoạch chi tiết.
                      </p>
                      <p style={{ textIndent: 24, background: '#fef3c7', padding: '4px 8px', borderRadius: 4 }}>
                        - Thời hạn hoàn thành báo cáo phương án: <strong>Trước ngày {analysisReport.deadlineDate.value || '25/08/2026'}</strong> để trình Thường trực UBND xã xem xét.
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', marginTop: 60 }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', fontStyle: 'italic' }}>Nơi nhận:</div>
                        <div style={{ fontSize: '0.8rem' }}>
                          - Thường trực Đảng ủy, HĐND xã;<br />
                          - Lãnh đạo UBND xã;<br />
                          - Các ban ngành, xóm bản;<br />
                          - Lưu: VT, HS.
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>TM. ỦY BAN NHÂN DÂN</div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>CHỦ TỊCH</div>
                        <div style={{ height: 60 }} />
                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>Đặng Xuân Quang</div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', marginTop: 40, color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>
                      — Hết văn bản (Trang 2/2) —
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── CỘT PHẢI: METADATA + EVIDENCE PANEL + ACTIONS ── */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', overflow: 'hidden' }}>
            {/* Tab navigation bên phải */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 16px' }}>
              <button
                type="button"
                className={`btn btn-ghost ${activeRightTab === 'evidence' ? 'btn-primary' : ''}`}
                onClick={() => setActiveRightTab('evidence')}
                style={{
                  borderRadius: 0,
                  borderBottom: activeRightTab === 'evidence' ? '2px solid #2563eb' : 'none',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  padding: '10px 16px',
                }}
              >
                Chứng Cứ & Phân Tích AI
              </button>
              <button
                type="button"
                className={`btn btn-ghost ${activeRightTab === 'checklist' ? 'btn-primary' : ''}`}
                onClick={() => setActiveRightTab('checklist')}
                style={{
                  borderRadius: 0,
                  borderBottom: activeRightTab === 'checklist' ? '2px solid #2563eb' : 'none',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  padding: '10px 16px',
                }}
              >
                Đầu Việc Con ({subTasks.length})
              </button>
            </div>

            {/* Content panel bên phải */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {activeRightTab === 'evidence' ? (
                <DocumentAiAnalysisPanel report={analysisReport} onJumpToPage={handleJumpToPage} />
              ) : (
                <TaskChecklistViewer initialSubTasks={subTasks} onSubTasksChange={onSubTasksChange} />
              )}
            </div>

            {/* Footer Action Bar */}
            <div
              style={{
                padding: '14px 20px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                justifyContent: 'flex-end',
              }}
            >
              {analysisReport.documentType.value === 'HopThuMoi' && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => onOpenRoutingModal('meeting')}
                  style={{ fontWeight: 700, color: '#1d4ed8', borderColor: '#93c5fd' }}
                >
                  <i className="fa-solid fa-calendar-plus" style={{ marginRight: 6 }} aria-hidden="true" />
                  Lên Lịch Công Tác
                </button>
              )}

              {analysisReport.documentType.value === 'ChiDao' && can('AssignTask') && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onOpenAssignModal}
                  style={{ fontWeight: 800 }}
                >
                  <i className="fa-solid fa-user-plus" style={{ marginRight: 6 }} aria-hidden="true" />
                  Đề Xuất & Giao Việc
                </button>
              )}

              {analysisReport.documentType.value === 'BaoCao' && can('ApproveDocument') && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => onOpenRoutingModal('report')}
                  style={{ fontWeight: 700, color: '#059669', borderColor: '#a7f3d0' }}
                >
                  <i className="fa-solid fa-file-circle-check" style={{ marginRight: 6 }} aria-hidden="true" />
                  Tiếp Nhận Thẩm Định
                </button>
              )}

              <button
                type="button"
                className="btn btn-outline"
                onClick={() => onOpenRoutingModal('store')}
                style={{ fontWeight: 700 }}
              >
                Lưu Trữ Sổ Văn Bản
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
