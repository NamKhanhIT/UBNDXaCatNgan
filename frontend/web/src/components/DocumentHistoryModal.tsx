import React, { useState, useEffect } from 'react';
import { getDocumentVersionsApi, DocumentVersionDto } from '../services/outgoing-document.service';

export interface DocumentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  documentNumberSymbol: string;
}

export const DocumentHistoryModal: React.FC<DocumentHistoryModalProps> = ({
  isOpen,
  onClose,
  documentId,
  documentTitle,
  documentNumberSymbol
}) => {
  const [activeTab, setActiveTab] = useState<'versions' | 'audit'>('versions');
  const [versions, setVersions] = useState<DocumentVersionDto[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersionDto | null>(null);

  useEffect(() => {
    if (isOpen && documentId) {
      loadVersions();
    }
  }, [isOpen, documentId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const res = await getDocumentVersionsApi(documentId);
      if (res.success && res.data) {
        setVersions(res.data);
        if (res.data.length > 0) setSelectedVersion(res.data[0]);
      } else {
        setVersions([]);
      }
    } catch {
      setVersions([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 860,
          height: '85vh',
          backgroundColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Top Header */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #1e293b'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <span style={{ background: '#2563eb', color: '#ffffff', fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px', borderRadius: 4 }}>
              {documentNumberSymbol}
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 500 }}>
              {documentTitle}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#334155',
              border: 'none',
              color: '#ffffff',
              borderRadius: 6,
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ✕ Đóng
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '0 20px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('versions')}
            style={{
              padding: '12px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'versions' ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === 'versions' ? '#2563eb' : '#64748b'
            }}
          >
            📜 Lịch Sử Phiên Bản (Document Versions)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            style={{
              padding: '12px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === 'audit' ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === 'audit' ? '#2563eb' : '#64748b'
            }}
          >
            🔍 Nhật Ký Kiểm Toán (Audit Log)
          </button>
        </div>

        {/* Tab 1: Version History Pane */}
        {activeTab === 'versions' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Left Version List */}
            <div style={{ width: 280, borderRight: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: 12, overflowY: 'auto' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                DANH SÁCH PHIÊN BẢN ({versions.length})
              </div>

              {loading ? (
                <div style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', padding: 20 }}>Đang tải lịch sử phiên bản...</div>
              ) : versions.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#64748b', padding: 16, background: '#ffffff', borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  Chưa có phiên bản đính chính nào. Đây là phiên bản gốc ban đầu.
                </div>
              ) : (
                versions.map((ver, idx) => (
                  <div
                    key={ver.id || idx}
                    onClick={() => setSelectedVersion(ver)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: selectedVersion?.id === ver.id ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      background: selectedVersion?.id === ver.id ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      marginBottom: 8,
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, color: '#0f172a' }}>
                      <span>v{ver.versionNumber}.0 — {ver.versionName}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
                      👤 {ver.changedByName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                      🕒 {new Date(ver.changedAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Right Version Detail Preview Pane */}
            <div style={{ flex: 1, padding: 20, overflowY: 'auto', backgroundColor: '#ffffff' }}>
              {selectedVersion ? (
                <div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.82rem', color: '#166534' }}>
                    <strong>Thông tin phiên bản v{selectedVersion.versionNumber}.0:</strong> {selectedVersion.changeReason || 'Phiên bản ban hành chính thức.'}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Tiêu đề / Trích yếu văn bản</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{selectedVersion.title}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Nội dung chi tiết</div>
                    <div style={{ fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      {selectedVersion.content || 'Nội dung văn bản được đính kèm qua file chính thức.'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                  Vui lòng chọn một phiên bản từ danh sách bên trái để xem thông tin đính chính.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Audit Log Pane */}
        {activeTab === 'audit' && (
          <div style={{ flex: 1, padding: 20, overflowY: 'auto', backgroundColor: '#ffffff' }}>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.82rem', color: '#1e40af' }}>
              <strong>Sổ nhật ký kiểm toán Append-Only:</strong> Ghi lại chính xác từng thao tác (Tạo nháp, Trình ký, Ký duyệt, Ban hành, Xem file, Download, Thu hồi, Hủy văn bản) cùng dấu mốc thời gian.
            </div>

            <div className="doc-timeline" style={{ paddingLeft: 10 }}>
              <div className="timeline-item completed">
                <div className="timeline-badge">✓</div>
                <div className="timeline-content">
                  <div className="timeline-title">Khởi tạo văn bản hành chính</div>
                  <div className="timeline-time">Lưu trữ trên CSDL hệ thống bởi Cán bộ Văn thư</div>
                </div>
              </div>

              <div className="timeline-item completed">
                <div className="timeline-badge">✓</div>
                <div className="timeline-content">
                  <div className="timeline-title">Cấp số hiệu tự động: {documentNumberSymbol}</div>
                  <div className="timeline-time">Hệ thống cấp số tự động atomic concurrency-safe</div>
                </div>
              </div>

              <div className="timeline-item completed">
                <div className="timeline-badge">✓</div>
                <div className="timeline-content">
                  <div className="timeline-title">Xem file / Tải văn bản an toàn (Secure File Streaming)</div>
                  <div className="timeline-time">Tài liệu được bảo mật truy cập qua Bearer Authorization Token</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
