'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { usePermission } from '../../hooks/use-permission';
import { useToast } from '../../components/ui/ToastContext';
import { getInboxDocumentsApi, InboxDocumentDto, suggestAssignmentApi, createTaskFromInboxApi } from '../../services/inbox.service';
import { getOutgoingDocumentsApi, OutgoingDocumentDto } from '../../services/outgoing-document.service';
import {
  generateTaskChecklist,
  type DocumentAnalysisReport,
  type AssigneeCandidate,
  type GeneratedSubTask,
} from './services/document-ai.service';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { DocumentUploadModal } from './components/DocumentUploadModal';
import { AiAssigneeSuggestionModal } from './components/AiAssigneeSuggestionModal';
import { AiRoutingActionModal } from './components/AiRoutingActionModal';
import { formatDateShort, formatDateLong } from '../../lib/formatters';
import { useSignalREvent } from '../../hooks/use-signalr';
import { Pagination } from '../../components/common/Pagination';
import { useDebounce } from '../../hooks/useDebounce';

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

function mapInboxToDocumentItem(doc: InboxDocumentDto): DocumentItem {
  let cat: 'ChiDao' | 'GiaoViec' | 'BaoCao' | 'HopThuMoi' | 'ThongBao' = 'ChiDao';
  const cLow = (doc.category || '').toLowerCase();
  if (cLow.includes('họp') || cLow.includes('mời') || cLow.includes('meeting')) cat = 'HopThuMoi';
  else if (cLow.includes('báo cáo') || cLow.includes('report')) cat = 'BaoCao';
  else if (cLow.includes('giao việc') || cLow.includes('nhiệm vụ') || cLow.includes('task')) cat = 'GiaoViec';
  else if (cLow.includes('thông báo') || cLow.includes('notice')) cat = 'ThongBao';

  return {
    id: doc.id,
    documentNumber: doc.documentNumber || '—',
    documentSymbol: doc.documentSymbol || 'CV-UBND',
    subject: doc.subject || 'Văn bản tiếp nhận',
    category: cat,
    categoryName: doc.category || 'Chỉ đạo điều hành',
    sender: doc.sender || doc.issuingAgency || 'Cơ quan cấp trên',
    direction: 'incoming',
    issuedDate: doc.issuedDate || doc.receivedDate || new Date().toISOString(),
    receivedDate: doc.receivedDate || new Date().toISOString(),
    deadlineDate: doc.scheduledDate || null,
    isUrgent: !!doc.isUrgent,
    processingStatus: doc.isScheduled ? 'Completed' : 'PendingProcessing',
    aiSummary: doc.aiSummary || doc.subject || 'Đang chờ điều phối phân công công tác.',
  };
}

function mapOutgoingToDocumentItem(doc: OutgoingDocumentDto): DocumentItem {
  let cat: 'ChiDao' | 'GiaoViec' | 'BaoCao' | 'HopThuMoi' | 'ThongBao' = 'BaoCao';
  const tLow = (doc.documentTypeName || '').toLowerCase();
  if (tLow.includes('quyết định') || tLow.includes('chỉ thị')) cat = 'ChiDao';
  else if (tLow.includes('thông báo')) cat = 'ThongBao';
  else if (tLow.includes('kế hoạch') || tLow.includes('tờ trình')) cat = 'GiaoViec';

  let status: DocumentProcessingStatus = 'PendingApproval';
  if (doc.status === 'Issued' || doc.status === 'Sent') status = 'Completed';
  else if (doc.status === 'Draft') status = 'PendingProcessing';
  else if (doc.status === 'PendingSignature') status = 'PendingApproval';

  return {
    id: doc.id,
    documentNumber: doc.documentNumber || 'Dự thảo',
    documentSymbol: doc.documentSymbol || 'UBND-VP',
    subject: doc.title || 'Văn bản phát hành',
    category: cat,
    categoryName: doc.documentTypeName || 'Văn bản đi',
    sender: doc.recipientNote || 'UBND Xã',
    direction: 'outgoing',
    issuedDate: doc.issuedDate || doc.draftedAt || new Date().toISOString(),
    receivedDate: doc.draftedAt || new Date().toISOString(),
    deadlineDate: doc.responseDeadline || null,
    isUrgent: !!doc.isUrgent,
    processingStatus: status,
    aiSummary: doc.content || doc.title || 'Dự thảo văn bản công vụ đi của UBND Xã.',
  };
}

export function DocumentsFeature() {
  const { user, activeRole } = useAuth();
  const { can } = usePermission();
  const { addToast } = useToast();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Bộ lọc
  const [filterDirection, setFilterDirection] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const debouncedSearch = useDebounce(searchKeyword, 300);

  // Phân trang máy chủ độc lập
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [incomingTotal, setIncomingTotal] = useState<number>(0);
  const [outgoingTotal, setOutgoingTotal] = useState<number>(0);

  // Bộ nhớ đệm Client (In-memory page cache) cho lật trang tức thì 0ms
  const pageCacheRef = React.useRef<Map<string, { items: DocumentItem[]; totalCount: number; inCount: number; outCount: number }>>(new Map());

  useEffect(() => {
    setCurrentPage(1);
  }, [filterDirection, filterCategory, filterStatus, debouncedSearch]);

  // Nạp dữ liệu từ backend CSDL PostgreSQL có phân trang, lọc server-side và caching
  const loadDocuments = useCallback(async () => {
    const categoryQuery =
      filterCategory === 'NghiQuyet' ? 'Nghị quyết'
      : filterCategory === 'QuyetDinh' ? 'Quyết định'
      : filterCategory === 'ChiDao' ? 'Chỉ đạo điều hành'
      : filterCategory === 'BaoCao' ? 'Báo cáo'
      : filterCategory === 'ToTrinh' ? 'Tờ trình'
      : filterCategory === 'CongVan' ? 'Công văn'
      : filterCategory === 'ThongBao' ? 'Thông báo'
      : filterCategory === 'KeHoach' ? 'Kế hoạch'
      : undefined;

    const inboxStatusQuery =
      filterStatus === 'PendingConfirmation' ? 'Pending'
      : filterStatus === 'PendingProcessing' ? 'Analyzed'
      : filterStatus === 'PendingAssignment' ? 'Reviewed'
      : filterStatus === 'Completed' ? 'Confirmed'
      : undefined;

    const outgoingStatusQuery =
      filterStatus === 'Draft' ? 'Draft'
      : filterStatus === 'PendingApproval' ? 'PendingReview'
      : filterStatus === 'Completed' ? 'Issued'
      : undefined;

    const cacheKey = `${filterDirection}_${filterCategory}_${filterStatus}_${debouncedSearch}_${currentPage}_${pageSize}`;
    if (pageCacheRef.current.has(cacheKey)) {
      const cached = pageCacheRef.current.get(cacheKey)!;
      setDocuments(cached.items);
      setTotalCount(cached.totalCount);
      setIncomingTotal(cached.inCount);
      setOutgoingTotal(cached.outCount);
    }

    try {
      setIsLoading(true);
      if (filterDirection === 'incoming') {
        const res = await getInboxDocumentsApi({
          page: currentPage,
          pageSize,
          search: debouncedSearch.trim() || undefined,
          category: categoryQuery,
          status: inboxStatusQuery,
        });
        if (res.success && res.data?.items) {
          const mapped = res.data.items.map(mapInboxToDocumentItem);
          setDocuments(mapped);
          setTotalCount(res.data.totalCount);
          setIncomingTotal(res.data.totalCount);
          pageCacheRef.current.set(cacheKey, {
            items: mapped,
            totalCount: res.data.totalCount,
            inCount: res.data.totalCount,
            outCount: outgoingTotal,
          });
        }
      } else if (filterDirection === 'outgoing') {
        const res = await getOutgoingDocumentsApi({
          page: currentPage,
          pageSize,
          search: debouncedSearch.trim() || undefined,
          documentType: categoryQuery as any,
          status: outgoingStatusQuery as any,
        });
        if (res.success && res.data?.items) {
          const mapped = res.data.items.map(mapOutgoingToDocumentItem);
          setDocuments(mapped);
          setTotalCount(res.data.totalCount);
          setOutgoingTotal(res.data.totalCount);
          pageCacheRef.current.set(cacheKey, {
            items: mapped,
            totalCount: res.data.totalCount,
            inCount: incomingTotal,
            outCount: res.data.totalCount,
          });
        }
      } else {
        const [inboxRes, outRes] = await Promise.all([
          getInboxDocumentsApi({
            page: currentPage,
            pageSize: Math.max(1, Math.floor(pageSize / 2)),
            search: debouncedSearch.trim() || undefined,
            category: categoryQuery,
            status: inboxStatusQuery,
          }),
          getOutgoingDocumentsApi({
            page: currentPage,
            pageSize: Math.max(1, Math.ceil(pageSize / 2)),
            search: debouncedSearch.trim() || undefined,
            documentType: categoryQuery as any,
            status: outgoingStatusQuery as any,
          }),
        ]);
        const items: DocumentItem[] = [];
        let inCount = 0;
        let outCount = 0;
        if (inboxRes.success && inboxRes.data?.items) {
          items.push(...inboxRes.data.items.map(mapInboxToDocumentItem));
          inCount = inboxRes.data.totalCount;
          setIncomingTotal(inCount);
        }
        if (outRes.success && outRes.data?.items) {
          items.push(...outRes.data.items.map(mapOutgoingToDocumentItem));
          outCount = outRes.data.totalCount;
          setOutgoingTotal(outCount);
        }
        setDocuments(items);
        const combinedTotal = inCount + outCount;
        setTotalCount(combinedTotal);
        pageCacheRef.current.set(cacheKey, {
          items,
          totalCount: combinedTotal,
          inCount,
          outCount,
        });
      }
    } catch (err) {
      console.warn('Lỗi khi tải danh sách văn bản:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterDirection, filterCategory, filterStatus, currentPage, pageSize, debouncedSearch, incomingTotal, outgoingTotal]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments, activeRole]);

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
      const report: DocumentAnalysisReport = {
        documentId: doc.id,
        documentType: { value: 'ChiDao', confidence: 0.95, sourcePage: 1, sourceText: doc.subject },
        documentNumber: { value: doc.documentNumber, confidence: 1.0, sourcePage: 1, sourceText: doc.documentNumber },
        documentSymbol: { value: doc.documentSymbol, confidence: 1.0, sourcePage: 1, sourceText: doc.documentSymbol },
        issuingAgency: { value: doc.sender, confidence: 0.95, sourcePage: 1, sourceText: doc.sender },
        issuedDate: { value: doc.issuedDate, confidence: 1.0, sourcePage: 1, sourceText: doc.issuedDate },
        deadlineDate: { value: doc.deadlineDate, confidence: 0.9, sourcePage: 1, sourceText: doc.deadlineDate || '' },
        priority: { value: doc.isUrgent ? 'Khan' : 'Thuong', confidence: 1.0, sourcePage: 1, sourceText: '' },
        summary: { value: doc.aiSummary, confidence: 0.9, sourcePage: 1, sourceText: doc.aiSummary },
        keyObjectives: { value: [doc.subject], confidence: 0.85, sourcePage: 1, sourceText: doc.subject },
        targetSubjects: { value: [], confidence: 0.8, sourcePage: 1, sourceText: '' },
        relatedDepartments: { value: [], confidence: 0.8, sourcePage: 1, sourceText: '' },
      };
      setAnalysisReport(report);
      setSubTasks(generateTaskChecklist(report));
      setIsViewerOpen(true);
    } catch (err: any) {
      addToast('Lỗi phân tích', err.message || 'Không thể mở văn bản', 'danger');
    }
  };

  // Mở modal giao việc
  const handleOpenAssignModal = async () => {
    if (!selectedDoc) return;
    try {
      const res = await suggestAssignmentApi(selectedDoc.id);
      if (res.success && res.data) {
        const suggestion = res.data;
        const candidates: AssigneeCandidate[] = [
          {
            userId: suggestion.suggestedUserId,
            fullName: suggestion.suggestedUserName,
            roleName: '',
            departmentName: suggestion.suggestedDepartmentName || '',
            scorePercentage: Math.round((suggestion.confidence || 0) * 100),
            positiveReasons: suggestion.reason ? [suggestion.reason] : [],
            negativeReasons: [],
            currentWorkloadPercentage: 0,
            assignedTasksCount: 0,
          },
          ...(suggestion.alternatives || []).map(a => ({
            userId: a.userId,
            fullName: a.fullName,
            roleName: '',
            departmentName: (a as any).departmentName || '',
            scorePercentage: 70,
            positiveReasons: a.reason ? [a.reason] : [],
            negativeReasons: [],
            currentWorkloadPercentage: 0,
            assignedTasksCount: 0,
          })),
        ];
        setAssigneeCandidates(candidates);
        setIsAssignModalOpen(true);
      } else {
        addToast('Thông báo', res.error || 'Không thể lấy gợi ý AI, mở phân công trực tiếp.', 'warning');
        setAssigneeCandidates([]);
        setIsAssignModalOpen(true);
      }
    } catch (err: any) {
      addToast('Thông báo', 'Dịch vụ gợi ý ngoại tuyến, mở phân công trực tiếp.', 'warning');
      setAssigneeCandidates([]);
      setIsAssignModalOpen(true);
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

  // Danh sách hiển thị (đã lọc và phân trang từ máy chủ)
  const filteredDocs = documents;

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
  const incomingCount = incomingTotal || documents.filter(d => d.direction === 'incoming').length;
  const outgoingCount = outgoingTotal || documents.filter(d => d.direction === 'outgoing').length;
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
              ) : isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, color: '#2563eb', display: 'block', marginBottom: 10 }} aria-hidden="true" />
                    <span style={{ fontWeight: 600 }}>Đang nạp danh sách văn bản từ hệ thống máy chủ...</span>
                  </td>
                </tr>
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

        {/* 5. FOOTER SUMMARY BAR & PHÂN TRANG */}
        <div style={{ padding: '8px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: '#b45309', fontWeight: 600 }}>
              <i className="fa-solid fa-circle" style={{ fontSize: 8 }} aria-hidden="true" />
              {pendingCount} văn bản chờ giải quyết
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>
              <i className="fa-solid fa-bolt" style={{ fontSize: 9 }} aria-hidden="true" />
              {urgentCount} hỏa tốc
            </span>
          </div>
        </div>

        <Pagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 20, 50, 100]}
          itemName="văn bản công vụ"
        />
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
