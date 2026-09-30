'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  getOutgoingDocumentsApi,
  OutgoingDocumentDto,
  DocumentTypeEnum,
  OutgoingDocumentStatusEnum,
} from '../../../services/outgoing-document.service';
import { Pagination } from '../../../components/common/Pagination';
import { useDebounce } from '../../../hooks/useDebounce';
import { formatDateShort } from '../../../lib/formatters';

interface PreparedDocumentsPanelProps {
  className?: string;
  onSelectDocument?: (doc: OutgoingDocumentDto) => void;
}

const DOCUMENT_TYPE_LABELS: Record<DocumentTypeEnum, string> = {
  QuyetDinh: 'Quyết định',
  CongVan: 'Công văn',
  ThongBao: 'Thông báo',
  BaoCao: 'Báo cáo',
  KeHoach: 'Kế hoạch',
  ToTrinh: 'Tờ trình',
  CongDien: 'Công điện',
};

const STATUS_CONFIG: Record<
  OutgoingDocumentStatusEnum,
  { label: string; bg: string; color: string; border: string }
> = {
  Recalled: { label: 'Đã thu hồi', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  Cancelled: { label: 'Đã hủy', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  Draft: {
    label: 'Bản thảo',
    bg: '#f1f5f9',
    color: '#475569',
    border: '#cbd5e1',
  },
  PendingSignature: {
    label: 'Chờ ký duyệt',
    bg: '#fef3c7',
    color: '#b45309',
    border: '#fde68a',
  },
  Issued: {
    label: 'Đã ban hành',
    bg: '#ecfdf5',
    color: '#047857',
    border: '#a7f3d0',
  },
  Sent: {
    label: 'Đã gửi liên thông',
    bg: '#eff6ff',
    color: '#1d4ed8',
    border: '#bfdbfe',
  },
  Rejected: {
    label: 'Từ chối / Trả lại',
    bg: '#fef2f2',
    color: '#b91c1c',
    border: '#fecaca',
  },
};

export function PreparedDocumentsPanel({
  className = '',
  onSelectDocument,
}: PreparedDocumentsPanelProps) {
  const [documents, setDocuments] = useState<OutgoingDocumentDto[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearch = useDebounce(searchTerm, 400);

  const [statusFilter, setStatusFilter] = useState<OutgoingDocumentStatusEnum | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<DocumentTypeEnum | 'ALL'>('ALL');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const [selectedDoc, setSelectedDoc] = useState<OutgoingDocumentDto | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOutgoingDocumentsApi({
        page,
        pageSize,
        search: debouncedSearch,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        documentType: typeFilter === 'ALL' ? undefined : typeFilter,
      });

      if (res.success && res.data) {
        setDocuments(res.data.items || []);
        setTotalCount(res.data.totalCount || 0);
      } else {
        setError(res.message || 'Không thể tải danh sách văn bản đã soạn thảo.');
      }
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, typeFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Reset về trang 1 khi thay đổi điều kiện lọc
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, typeFilter]);

  const handleRowClick = (doc: OutgoingDocumentDto) => {
    setSelectedDoc(doc);
    if (onSelectDocument) {
      onSelectDocument(doc);
    }
  };

  return (
    <div className={`operations-workspace ${className}`}>
      {/* Tiêu đề & Thông tin đầu mục */}
      <div className="operations-heading" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            <i className="fa-solid fa-file-signature" style={{ color: '#2563eb', marginRight: 10 }} />
            Văn Bản Đã Soạn Thảo & Chuẩn Bị Ban Hành
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
            Tra cứu, kiểm duyệt tiến độ ký duyệt và xem trước dự thảo văn bản đi của đơn vị.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => fetchDocuments()}
          title="Tải lại dữ liệu"
          disabled={loading}
        >
          <i className={`fa-solid fa-rotate-right ${loading ? 'fa-spin' : ''}`} style={{ marginRight: 6 }} />
          Làm mới
        </button>
      </div>

      {/* Thanh công cụ Tìm kiếm & Bộ lọc */}
      <div
        className="operations-card"
        style={{
          padding: '14px 16px',
          marginBottom: 16,
          background: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1, minWidth: 280 }}>
          {/* Ô tìm kiếm */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 220 }}>
            <i
              className="fa-solid fa-magnifying-glass"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                fontSize: 13,
              }}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Tìm theo số ký hiệu, trích yếu văn bản..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 34, fontSize: '0.84rem', height: 38 }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: 12 }} />
              </button>
            )}
          </div>

          {/* Lọc theo trạng thái */}
          <select
            className="form-select"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as OutgoingDocumentStatusEnum | 'ALL')}
            style={{ width: 'auto', minWidth: 170, fontSize: '0.84rem', height: 38 }}
          >
            <option value="ALL">── Tất cả trạng thái ──</option>
            <option value="Draft">Bản thảo</option>
            <option value="PendingSignature">Chờ ký duyệt</option>
            <option value="Issued">Đã ban hành</option>
            <option value="Sent">Đã gửi liên thông</option>
            <option value="Rejected">Từ chối / Trả lại</option>
          </select>

          {/* Lọc theo loại văn bản */}
          <select
            className="form-select"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as DocumentTypeEnum | 'ALL')}
            style={{ width: 'auto', minWidth: 170, fontSize: '0.84rem', height: 38 }}
          >
            <option value="ALL">── Tất cả thể loại ──</option>
            <option value="QuyetDinh">Quyết định</option>
            <option value="CongVan">Công văn</option>
            <option value="ThongBao">Thông báo</option>
            <option value="BaoCao">Báo cáo</option>
            <option value="KeHoach">Kế hoạch</option>
            <option value="ToTrinh">Tờ trình</option>
            <option value="CongDien">Công điện</option>
          </select>
        </div>

        <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
          Tổng cộng: <span style={{ color: '#0f172a', fontWeight: 700 }}>{totalCount}</span> văn bản
        </div>
      </div>

      {/* Bảng danh sách văn bản */}
      <div
        className="operations-card"
        style={{
          background: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {error && (
          <div
            style={{
              padding: '14px 18px',
              background: '#fef2f2',
              color: '#b91c1c',
              borderBottom: '1px solid #fee2e2',
              fontSize: '0.84rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <i className="fa-solid fa-triangle-exclamation" />
            <span>{error}</span>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="table operations-table" style={{ width: '100%', margin: 0, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', width: 140 }}>
                  Số / Ký hiệu
                </th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                  Trích yếu nội dung
                </th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', width: 130 }}>
                  Thể loại
                </th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', width: 150 }}>
                  Người soạn thảo
                </th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', width: 110 }}>
                  Ngày soạn
                </th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', width: 140 }}>
                  Trạng thái
                </th>
                <th style={{ padding: '12px 16px', fontSize: '0.78rem', fontWeight: 700, color: '#475569', width: 90, textAlign: 'center' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                    <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 22, color: '#2563eb', marginBottom: 8 }} />
                    <p style={{ margin: 0, fontSize: '0.84rem' }}>Đang tải danh sách hồ sơ văn bản...</p>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                    <i className="fa-regular fa-folder-open" style={{ fontSize: 32, marginBottom: 10, color: '#cbd5e1' }} />
                    <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#64748b' }}>
                      Không tìm thấy văn bản nào phù hợp.
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>
                      Hãy thử thay đổi từ khóa tìm kiếm hoặc điều kiện lọc trạng thái.
                    </p>
                  </td>
                </tr>
              ) : (
                documents.map(doc => {
                  const statusInfo = STATUS_CONFIG[doc.status] || STATUS_CONFIG.Draft;
                  const typeLabel = DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentTypeName || doc.documentType;

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => handleRowClick(doc)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      className="operations-table-row"
                    >
                      {/* Số ký hiệu */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: doc.documentNumber ? '#0f172a' : '#94a3b8' }}>
                          {doc.documentNumber || doc.documentSymbol || '— (Dự thảo)'}
                        </span>
                        {doc.isUrgent && (
                          <span
                            style={{
                              display: 'inline-block',
                              marginLeft: 6,
                              padding: '1px 5px',
                              background: '#fee2e2',
                              color: '#dc2626',
                              borderRadius: 4,
                              fontSize: '0.68rem',
                              fontWeight: 800,
                            }}
                          >
                            HỎA TỐC
                          </span>
                        )}
                      </td>

                      {/* Trích yếu */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '0.86rem',
                            color: '#1e293b',
                            lineHeight: 1.4,
                            marginBottom: 2,
                          }}
                        >
                          {doc.title}
                        </div>
                        {doc.recipientNote && (
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            <i className="fa-solid fa-paper-plane" style={{ fontSize: 10, marginRight: 4 }} />
                            Nơi nhận: {doc.recipientNote}
                          </div>
                        )}
                      </td>

                      {/* Thể loại */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '0.82rem', color: '#334155' }}>
                        {typeLabel}
                      </td>

                      {/* Người soạn */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '0.82rem', color: '#334155' }}>
                        {doc.draftedByUserName || '—'}
                      </td>

                      {/* Ngày soạn */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontSize: '0.8rem', color: '#64748b' }}>
                        {formatDateShort(doc.draftedAt)}
                      </td>

                      {/* Trạng thái */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            background: statusInfo.bg,
                            color: statusInfo.color,
                            border: `1px solid ${statusInfo.border}`,
                            borderRadius: 6,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                          }}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Thao tác */}
                      <td
                        style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'center' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => setSelectedDoc(doc)}
                          title="Xem chi tiết dự thảo"
                        >
                          <i className="fa-regular fa-eye" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <Pagination
            currentPage={page}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={newPage => setPage(newPage)}
            onPageSizeChange={newSize => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      </div>

      {/* Modal Xem chi tiết văn bản dự thảo */}
      {selectedDoc && (
        <div
          className="operations-dialog-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: 16,
          }}
          onClick={() => setSelectedDoc(null)}
        >
          <div
            className="operations-dialog"
            style={{
              background: '#ffffff',
              borderRadius: 12,
              maxWidth: 680,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: 24,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    marginBottom: 6,
                    background: STATUS_CONFIG[selectedDoc.status]?.bg || '#f1f5f9',
                    color: STATUS_CONFIG[selectedDoc.status]?.color || '#475569',
                  }}
                >
                  {STATUS_CONFIG[selectedDoc.status]?.label || selectedDoc.status}
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.4 }}>
                  {selectedDoc.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 18,
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Số / Ký hiệu văn bản:</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedDoc.documentNumber || selectedDoc.documentSymbol || 'Chưa cấp số'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Thể loại văn bản:</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                  {DOCUMENT_TYPE_LABELS[selectedDoc.documentType] || selectedDoc.documentType}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Cán bộ soạn thảo:</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedDoc.draftedByUserName} ({formatDateShort(selectedDoc.draftedAt)})
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Lãnh đạo ký duyệt:</div>
                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedDoc.signedByUserName
                    ? `${selectedDoc.signedByUserName} (${formatDateShort(selectedDoc.signedAt)})`
                    : 'Chưa ký duyệt'}
                </div>
              </div>
            </div>

            {selectedDoc.recipientNote && (
              <div style={{ marginBottom: 16, background: '#f8fafc', padding: '10px 12px', borderRadius: 6 }}>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700 }}>Nơi nhận / Đơn vị tiếp nhận:</div>
                <div style={{ fontSize: '0.84rem', color: '#1e293b' }}>{selectedDoc.recipientNote}</div>
              </div>
            )}

            {selectedDoc.rejectionReason && (
              <div style={{ marginBottom: 16, background: '#fef2f2', padding: '10px 12px', borderRadius: 6, border: '1px solid #fee2e2' }}>
                <div style={{ fontSize: '0.74rem', color: '#b91c1c', fontWeight: 700 }}>Lý do trả lại / Yêu cầu chỉnh sửa:</div>
                <div style={{ fontSize: '0.84rem', color: '#991b1b' }}>{selectedDoc.rejectionReason}</div>
              </div>
            )}

            {selectedDoc.content && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, marginBottom: 4 }}>
                  Nội dung tóm tắt / Dự thảo:
                </div>
                <div
                  style={{
                    fontSize: '0.84rem',
                    color: '#334155',
                    background: '#f8fafc',
                    padding: 12,
                    borderRadius: 6,
                    maxHeight: 180,
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5,
                  }}
                >
                  {selectedDoc.content}
                </div>
              </div>
            )}

            {/* Tệp đính kèm */}
            {selectedDoc.attachmentUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                <i className="fa-solid fa-paperclip" style={{ color: '#2563eb' }} />
                <a
                  href={selectedDoc.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <i className="fa-solid fa-arrow-up-right-from-square" />
                  Mở tệp đính kèm văn bản
                </a>
              </div>
            ) : (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Không có tệp đính kèm.
              </div>
            )}

            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedDoc(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
