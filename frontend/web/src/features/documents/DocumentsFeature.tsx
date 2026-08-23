'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { usePermission } from '../../hooks/use-permission';
import { useToast } from '../../components/ui/ToastContext';
import {
  analyzeDocumentWithAi,
  suggestAssigneesForDocument,
  generateTaskChecklist,
  DocumentAnalysisReport,
  AssigneeCandidate,
  GeneratedSubTask,
} from './services/document-ai.service';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { DocumentUploadModal } from './components/DocumentUploadModal';
import { AiAssigneeSuggestionModal } from './components/AiAssigneeSuggestionModal';
import { AiRoutingActionModal } from './components/AiRoutingActionModal';
import { formatDateShort, formatDateLong } from '../../lib/formatters';
import { useSignalREvent } from '../../hooks/use-signalr';

export type DocumentProcessingStatus =
  | 'PendingConfirmation'
  | 'PendingProcessing'
  | 'PendingAssignment'
  | 'PendingApproval'
  | 'Completed';

export interface DocumentItem {
  id: string;
  documentNumber: string;
  documentSymbol: string;
  subject: string;
  category: 'ChiDao' | 'GiaoViec' | 'BaoCao' | 'HopThuMoi' | 'ThongBao';
  categoryName: string;
  sender: string;
  direction: 'incoming' | 'outgoing';
  issuedDate: string;
  receivedDate: string;
  deadlineDate: string | null;
  isUrgent: boolean;
  processingStatus: DocumentProcessingStatus;
  aiSummary: string;
}

const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'DOC-001',
    documentNumber: '142',
    documentSymbol: 'CT-UBND',
    subject: 'Chỉ thị về việc tăng cường các biện pháp phòng chống thiên tai và tìm kiếm cứu nạn mùa mưa bão năm 2026',
    category: 'ChiDao',
    categoryName: 'Chỉ đạo điều hành',
    sender: 'UBND Tỉnh Nghệ An',
    direction: 'incoming',
    issuedDate: '2026-08-19',
    receivedDate: '2026-08-20',
    deadlineDate: '2026-08-25',
    isUrgent: true,
    processingStatus: 'PendingAssignment',
    aiSummary: 'Yêu cầu tổ chức trực ban 24/24 giờ, rà soát các vị trí xung yếu ven sông Lam.',
  },
  {
    id: 'DOC-002',
    documentNumber: '78',
    documentSymbol: 'GM-UBND',
    subject: 'Giấy mời họp kiểm điểm công tác chuyển đổi số và đề án 06 tháng 8 năm 2026',
    category: 'HopThuMoi',
    categoryName: 'Họp và thư mời',
    sender: 'UBND Huyện Thanh Chương',
    direction: 'incoming',
    issuedDate: '2026-08-20',
    receivedDate: '2026-08-21',
    deadlineDate: '2026-08-23',
    isUrgent: false,
    processingStatus: 'PendingConfirmation',
    aiSummary: 'Mời Lãnh đạo UBND xã và cán bộ phụ trách dự phiên họp trực tuyến rà soát dữ liệu.',
  },
  {
    id: 'DOC-003',
    documentNumber: '89',
    documentSymbol: 'BC-KT',
    subject: 'Báo cáo kết quả thực hiện nhiệm vụ quản lý đất đai và thu phí địa chính tháng 8 năm 2026',
    category: 'BaoCao',
    categoryName: 'Báo cáo công vụ',
    sender: 'Phòng Kinh tế & Địa chính',
    direction: 'incoming',
    issuedDate: '2026-08-21',
    receivedDate: '2026-08-21',
    deadlineDate: null,
    isUrgent: false,
    processingStatus: 'PendingApproval',
    aiSummary: 'Báo cáo tổng hợp tiến độ cấp đổi 45 hồ sơ địa chính và nguồn thu từ đất.',
  },
  {
    id: 'DOC-004',
    documentNumber: '105',
    documentSymbol: 'QĐ-UBND',
    subject: 'Quyết định thành lập Tổ công tác kiểm tra an toàn đê điều xã Cát Ngạn',
    category: 'GiaoViec',
    categoryName: 'Giao nhiệm vụ',
    sender: 'UBND Xã Cát Ngạn',
    direction: 'outgoing',
    issuedDate: '2026-08-18',
    receivedDate: '2026-08-18',
    deadlineDate: '2026-08-30',
    isUrgent: false,
    processingStatus: 'Completed',
    aiSummary: 'Thành lập Tổ kiểm tra do Phó Chủ tịch UBND xã làm Tổ trưởng.',
  },
];

export function DocumentsFeature() {
  const { user } = useAuth();
  const { can } = usePermission();
  const { addToast } = useToast();

  const [documents, setDocuments] = useState<DocumentItem[]>(INITIAL_DOCUMENTS);

  // Bộ lọc
  const [filterDirection, setFilterDirection] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Modal State
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [analysisReport, setAnalysisReport] = useState<DocumentAnalysisReport | null>(null);
  const [subTasks, setSubTasks] = useState<GeneratedSubTask[]>([]);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [assigneeCandidates, setAssigneeCandidates] = useState<AssigneeCandidate[]>([]);
  const [routingModalType, setRoutingModalType] = useState<'meeting' | 'report' | 'store' | null>(null);

  // Lắng nghe sự kiện SignalR Realtime
  useSignalREvent('DocumentReceived', (data: any) => {
    if (data?.subject || data?.documentNumber) {
      addToast('Văn bản đến mới', `Đã tiếp nhận: ${data.subject || data.documentNumber}`, 'info');
    }
    if (data?.id) {
      setDocuments(prev => {
        if (prev.some(d => d.id === data.id)) return prev;
        return [
          {
            id: data.id,
            documentNumber: data.documentNumber || String(prev.length + 100),
            documentSymbol: data.documentSymbol || 'CV-UBND',
            subject: data.subject || 'Văn bản chỉ đạo mới',
            category: data.category || 'ChiDao',
            categoryName: data.categoryName || 'Chỉ đạo điều hành',
            sender: data.sender || data.issuingAgency || 'UBND Huyện',
            direction: data.direction || 'incoming',
            issuedDate: data.issuedDate || new Date().toISOString(),
            receivedDate: data.receivedDate || new Date().toISOString(),
            deadlineDate: data.deadlineDate || null,
            isUrgent: !!data.isUrgent,
            processingStatus: data.processingStatus || 'PendingConfirmation',
            aiSummary: data.aiSummary || 'Đang chờ phân tích dữ liệu chỉ đạo...',
          },
          ...prev,
        ];
      });
    }
  });

  useSignalREvent('DocumentStatusChanged', (data: any) => {
    if (data?.id && data?.status) {
      setDocuments(prev => prev.map(d => (d.id === data.id ? { ...d, processingStatus: data.status } : d)));
    }
  });

  useSignalREvent('AiAnalysisCompleted', (data: any) => {
    if (data?.documentId) {
      addToast('Hoàn tất phân tích văn bản', `Văn bản số ${data.documentNumber || ''} đã sẵn sàng điều phối giao việc.`, 'success');
      setDocuments(prev =>
        prev.map(d =>
          d.id === data.documentId
            ? { ...d, aiSummary: data.summary || d.aiSummary, processingStatus: 'PendingAssignment' }
            : d
        )
      );
    }
  });

  // Mở trình xem văn bản
  const handleOpenViewer = async (doc: DocumentItem) => {
    try {
      setSelectedDoc(doc);
      const report = await analyzeDocumentWithAi(doc.id, doc.subject);
      setAnalysisReport(report);
      setSubTasks(generateTaskChecklist(report));
      setIsViewerOpen(true);
    } catch (err: any) {
      addToast('Lỗi phân tích', err.message || 'Không thể mở văn bản', 'danger');
    }
  };

  // Mở modal giao việc
  const handleOpenAssignModal = async () => {
    if (!analysisReport) return;
    try {
      const candidates = await suggestAssigneesForDocument(analysisReport);
      setAssigneeCandidates(candidates);
      setIsAssignModalOpen(true);
    } catch (err: any) {
      addToast('Lỗi gợi ý', err.message || 'Không thể gợi ý cán bộ', 'danger');
    }
  };

  // Xác nhận giao việc
  const handleConfirmAssignment = (candidate: AssigneeCandidate, deadline: string) => {
    if (!selectedDoc) return;

    setDocuments(prev =>
      prev.map(d =>
        d.id === selectedDoc.id
          ? { ...d, processingStatus: 'PendingProcessing', deadlineDate: deadline }
          : d
      )
    );

    setIsAssignModalOpen(false);
    setIsViewerOpen(false);
    addToast(
      'Giao việc thành công',
      `Đã phân công nhiệm vụ cho đồng chí ${candidate.fullName} (Hạn chót: ${deadline})`,
      'success'
    );
  };

  // Xác nhận rẽ nhánh
  const handleConfirmRouting = (payload: any) => {
    if (!selectedDoc) return;

    if (payload.type === 'meeting') {
      setDocuments(prev =>
        prev.map(d => (d.id === selectedDoc.id ? { ...d, processingStatus: 'Completed' } : d))
      );
      addToast('Lên lịch thành công', `Đã tạo Lịch công tác: ${payload.title} (${payload.date})`, 'success');
    } else if (payload.type === 'report') {
      setDocuments(prev =>
        prev.map(d => (d.id === selectedDoc.id ? { ...d, processingStatus: 'PendingApproval' } : d))
      );
      addToast('Tiếp nhận báo cáo', 'Đã chuyển báo cáo vào hàng đợi phê duyệt của Lãnh đạo!', 'success');
    } else {
      setDocuments(prev =>
        prev.map(d => (d.id === selectedDoc.id ? { ...d, processingStatus: 'Completed' } : d))
      );
      addToast('Lưu trữ thành công', 'Đã lưu văn bản vào Sổ lưu trữ cơ quan!', 'success');
    }

    setRoutingModalType(null);
    setIsViewerOpen(false);
  };

  // Thêm văn bản mới tiếp nhận
  const handleUploadSuccess = async (newDoc: any) => {
    const docItem: DocumentItem = {
      ...newDoc,
      categoryName: 'Chỉ đạo điều hành',
      direction: 'incoming',
      deadlineDate: '2026-08-25',
    };

    setDocuments(prev => [docItem, ...prev]);
    setIsUploadModalOpen(false);
    await handleOpenViewer(docItem);
  };

  // Lọc danh sách
  const filteredDocs = documents.filter(doc => {
    if (filterDirection !== 'all' && doc.direction !== filterDirection) return false;
    if (filterCategory !== 'all' && doc.category !== filterCategory) return false;
    if (filterStatus !== 'all' && doc.processingStatus !== filterStatus) return false;
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      return (
        doc.subject.toLowerCase().includes(kw) ||
        doc.documentNumber.toLowerCase().includes(kw) ||
        doc.sender.toLowerCase().includes(kw)
      );
    }
    return true;
  });

  const renderStatusBadge = (status: DocumentProcessingStatus) => {
    switch (status) {
      case 'PendingConfirmation':
        return (
          <span className="doc-status-badge" style={{ background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
            <i className="fa-solid fa-clock" style={{ fontSize: '0.7rem' }} aria-hidden="true" />
            <span>CHỜ XÁC NHẬN</span>
          </span>
        );
      case 'PendingProcessing':
        return (
          <span className="doc-status-badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '0.7rem' }} aria-hidden="true" />
            <span>CHỜ XỬ LÝ</span>
          </span>
        );
      case 'PendingAssignment':
        return (
          <span className="doc-status-badge" style={{ background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff' }}>
            <i className="fa-solid fa-user-tag" style={{ fontSize: '0.7rem' }} aria-hidden="true" />
            <span>CHỜ GIAO VIỆC</span>
          </span>
        );
      case 'PendingApproval':
        return (
          <span className="doc-status-badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
            <i className="fa-solid fa-signature" style={{ fontSize: '0.7rem' }} aria-hidden="true" />
            <span>CHỜ DUYỆT</span>
          </span>
        );
      case 'Completed':
        return (
          <span className="doc-status-badge" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
            <i className="fa-solid fa-circle-check" style={{ fontSize: '0.7rem' }} aria-hidden="true" />
            <span>ĐÃ XỬ LÝ</span>
          </span>
        );
    }
  };

  const urgentCount = documents.filter(d => d.isUrgent).length;
  const incomingCount = documents.filter(d => d.direction === 'incoming').length;
  const outgoingCount = documents.filter(d => d.direction === 'outgoing').length;
  const pendingCount = documents.filter(d => d.processingStatus !== 'Completed').length;
  const completedCount = documents.filter(d => d.processingStatus === 'Completed').length;

  return (
    <div className="doc-workspace-container">
      {/* ── UNIFIED DOCUMENT CARD ── */}
      <div className="doc-unified-card">
        {/* 1. HEADER & ACTION BUTTON */}
        <div className="doc-workspace-header">
          <div>
            <h1 style={{ fontSize: '1.28rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa-solid fa-folder-tree" style={{ color: '#dc2626' }} aria-hidden="true" />
              <span>Quản Lý Văn Bản & Chỉ Đạo Điều Hành</span>
            </h1>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 3 }}>
              Hệ thống tiếp nhận, xử lý và điều phối văn bản hành chính công vụ UBND Cấp Xã
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsUploadModalOpen(true)}
              style={{ fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
            >
              <i className="fa-solid fa-plus" aria-hidden="true" />
              <span>Tiếp Nhận Văn Bản Mới</span>
            </button>
          </div>
        </div>

        {/* 2. QUICK FILTER PILLS */}
        <div className="doc-quick-tabs">
          <button
            type="button"
            className={`doc-quick-tab-btn ${filterDirection === 'all' && filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => {
              setFilterDirection('all');
              setFilterStatus('all');
            }}
          >
            <span>Tất cả văn bản</span>
            <span className="doc-quick-tab-count">{documents.length}</span>
          </button>

          <button
            type="button"
            className={`doc-quick-tab-btn ${filterDirection === 'incoming' ? 'active' : ''}`}
            onClick={() => {
              setFilterDirection('incoming');
              setFilterStatus('all');
            }}
          >
            <i className="fa-solid fa-arrow-down-left" style={{ fontSize: '0.72rem' }} aria-hidden="true" />
            <span>Văn bản đến</span>
            <span className="doc-quick-tab-count">{incomingCount}</span>
          </button>

          <button
            type="button"
            className={`doc-quick-tab-btn ${filterDirection === 'outgoing' ? 'active' : ''}`}
            onClick={() => {
              setFilterDirection('outgoing');
              setFilterStatus('all');
            }}
          >
            <i className="fa-solid fa-arrow-up-right" style={{ fontSize: '0.72rem' }} aria-hidden="true" />
            <span>Văn bản đi</span>
            <span className="doc-quick-tab-count">{outgoingCount}</span>
          </button>

          <button
            type="button"
            className={`doc-quick-tab-btn ${filterStatus === 'PendingAssignment' ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus('PendingAssignment');
            }}
          >
            <i className="fa-solid fa-user-clock" style={{ fontSize: '0.72rem' }} aria-hidden="true" />
            <span>Cần giao việc</span>
            <span className="doc-quick-tab-count">
              {documents.filter(d => d.processingStatus === 'PendingAssignment').length}
            </span>
          </button>

          <button
            type="button"
            className={`doc-quick-tab-btn ${filterStatus === 'Completed' ? 'active' : ''}`}
            onClick={() => {
              setFilterStatus('Completed');
            }}
          >
            <i className="fa-solid fa-check-double" style={{ fontSize: '0.72rem' }} aria-hidden="true" />
            <span>Đã hoàn thành</span>
            <span className="doc-quick-tab-count">{completedCount}</span>
          </button>
        </div>

        {/* 3. DETAILED FILTER TOOLBAR */}
        <div className="doc-filter-toolbar">
          <div className="doc-search-box" style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass doc-search-icon" aria-hidden="true" />
            <input
              type="text"
              className="doc-search-input"
              style={{ paddingRight: searchKeyword ? 32 : 12 }}
              placeholder="Tìm theo số hiệu, trích yếu nội dung, cơ quan ban hành..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                }}
                title="Xóa từ khóa tìm kiếm"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: 13 }} />
              </button>
            )}
          </div>

          <div>
            <select
              className="doc-select-filter"
              value={filterDirection}
              onChange={e => setFilterDirection(e.target.value as any)}
            >
              <option value="all">Tất cả luồng văn bản</option>
              <option value="incoming">Văn bản đến</option>
              <option value="outgoing">Văn bản đi</option>
            </select>
          </div>

          <div>
            <select
              className="doc-select-filter"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="all">Tất cả loại văn bản</option>
              <option value="ChiDao">Chỉ đạo điều hành</option>
              <option value="GiaoViec">Giao nhiệm vụ</option>
              <option value="BaoCao">Báo cáo công vụ</option>
              <option value="HopThuMoi">Họp và thư mời</option>
            </select>
          </div>

          <div>
            <select
              className="doc-select-filter"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="PendingConfirmation">Chờ xác nhận</option>
              <option value="PendingProcessing">Chờ xử lý</option>
              <option value="PendingAssignment">Chờ giao việc</option>
              <option value="PendingApproval">Chờ duyệt</option>
              <option value="Completed">Đã xử lý</option>
            </select>
          </div>

          {(searchKeyword.trim() !== '' || filterDirection !== 'all' || filterCategory !== 'all' || filterStatus !== 'all') && (
            <div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSearchKeyword('');
                  setFilterDirection('all');
                  setFilterCategory('all');
                  setFilterStatus('all');
                  addToast('Đã xóa bộ lọc', 'Danh sách văn bản đã được đặt lại về trạng thái mặc định.', 'info');
                }}
                style={{ color: '#dc2626', fontWeight: 700, height: 38, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <i className="fa-solid fa-rotate-left" />
                <span>Hủy bộ lọc</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. DATA TABLE */}
        <div className="doc-table-wrapper">
          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: 140, textAlign: 'center' }}>TRẠNG THÁI</th>
                <th style={{ width: 130, textAlign: 'center' }}>SỐ HIỆU</th>
                <th style={{ minWidth: 280 }}>TRÍCH YẾU NỘI DUNG</th>
                <th style={{ width: 200 }}>CƠ QUAN BAN HÀNH</th>
                <th style={{ width: 110, textAlign: 'center' }}>NGÀY NHẬN</th>
                <th style={{ width: 130, textAlign: 'center' }}>HẠN XỬ LÝ</th>
                <th style={{ width: 110, textAlign: 'center', paddingRight: 20 }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length > 0 ? (
                filteredDocs.map(doc => (
                  <tr
                    key={doc.id}
                    onClick={() => handleOpenViewer(doc)}
                  >
                    {/* 1. TRẠNG THÁI */}
                    <td style={{ textAlign: 'center' }}>
                      {renderStatusBadge(doc.processingStatus)}
                    </td>

                    {/* 2. SỐ HIỆU */}
                    <td style={{ textAlign: 'center' }}>
                      <div className="doc-symbol-box" style={{ justifyContent: 'center' }}>
                        <span className="doc-number-badge">
                          {doc.documentNumber ? `Số ${doc.documentNumber}` : '—'}
                        </span>
                        <span className="doc-symbol-tag">
                          {doc.documentSymbol || 'CV'}
                        </span>
                      </div>
                    </td>

                    {/* 3. TRÍCH YẾU NỘI DUNG */}
                    <td>
                      <div>
                        <span className="doc-subject-title">
                          {doc.subject}
                        </span>
                        {doc.isUrgent && (
                          <span className="doc-urgent-pill">
                            <i className="fa-solid fa-bolt" style={{ fontSize: '0.65rem' }} aria-hidden="true" />
                            HỎA TỐC
                          </span>
                        )}
                      </div>
                      <div className="doc-summary-text">
                        {doc.aiSummary}
                      </div>
                    </td>

                    {/* 4. CƠ QUAN BAN HÀNH */}
                    <td>
                      <div className="doc-sender-text">
                        <i className="fa-solid fa-landmark" style={{ color: '#94a3b8', fontSize: '0.78rem' }} aria-hidden="true" />
                        <span>{doc.sender}</span>
                      </div>
                    </td>

                    {/* 5. NGÀY NHẬN */}
                    <td className="doc-date-text">
                      {formatDateShort(doc.receivedDate)}
                    </td>

                    {/* 6. HẠN XỬ LÝ */}
                    <td style={{ textAlign: 'center' }}>
                      {doc.deadlineDate ? (
                        <span className="doc-deadline-urgent">
                          <i className="fa-solid fa-hourglass-half" style={{ fontSize: '0.72rem' }} aria-hidden="true" />
                          <span>{formatDateShort(doc.deadlineDate)}</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: '#f8fafc', padding: '2px 8px', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                          Không quy định
                        </span>
                      )}
                    </td>

                    {/* 7. THAO TÁC */}
                    <td style={{ textAlign: 'center', paddingRight: 20 }}>
                      <button
                        type="button"
                        className="doc-action-btn"
                        onClick={e => {
                          e.stopPropagation();
                          handleOpenViewer(doc);
                        }}
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.72rem' }} aria-hidden="true" />
                        <span>Chi Tiết</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                    <i className="fa-solid fa-file-circle-xmark" style={{ fontSize: 32, color: '#cbd5e1', display: 'block', marginBottom: 10 }} aria-hidden="true" />
                    <span style={{ fontWeight: 600 }}>Không tìm thấy văn bản phù hợp với điều kiện tìm kiếm.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 5. FOOTER SUMMARY BAR */}
        <div className="doc-table-footer">
          <div>
            Hiển thị <strong>{filteredDocs.length}</strong> trên tổng số <strong>{documents.length}</strong> văn bản công vụ
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', color: '#b45309' }}>
              <i className="fa-solid fa-circle" style={{ fontSize: 8 }} aria-hidden="true" />
              {pendingCount} văn bản chờ giải quyết
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.76rem', color: '#dc2626' }}>
              <i className="fa-solid fa-bolt" style={{ fontSize: 9 }} aria-hidden="true" />
              {urgentCount} hỏa tốc
            </span>
          </div>
        </div>
      </div>

      {/* ── MODAL TRÌNH XEM VĂN BẢN 2 CỘT ── */}
      {isViewerOpen && selectedDoc && analysisReport && (
        <DocumentViewerModal
          document={selectedDoc}
          analysisReport={analysisReport}
          subTasks={subTasks}
          onOpenAssignModal={handleOpenAssignModal}
          onOpenRoutingModal={type => setRoutingModalType(type)}
          onSubTasksChange={updated => setSubTasks(updated)}
          onClose={() => setIsViewerOpen(false)}
        />
      )}

      {/* ── MODAL TIẾP NHẬN VĂN BẢN MỚI ── */}
      {isUploadModalOpen && (
        <DocumentUploadModal
          onUploadSuccess={handleUploadSuccess}
          onClose={() => setIsUploadModalOpen(false)}
        />
      )}

      {/* ── MODAL ĐỀ XUẤT CÁN BỘ THỤ LÝ ── */}
      {isAssignModalOpen && analysisReport && (
        <AiAssigneeSuggestionModal
          report={analysisReport}
          candidates={assigneeCandidates}
          onConfirmAssignment={handleConfirmAssignment}
          onClose={() => setIsAssignModalOpen(false)}
        />
      )}

      {/* ── MODAL RẼ NHÁNH ĐIỀU PHỐI (HỌP / BÁO CÁO / LƯU TRỮ) ── */}
      {routingModalType && analysisReport && (
        <AiRoutingActionModal
          report={analysisReport}
          routeType={routingModalType}
          onConfirm={handleConfirmRouting}
          onClose={() => setRoutingModalType(null)}
        />
      )}
    </div>
  );
}
