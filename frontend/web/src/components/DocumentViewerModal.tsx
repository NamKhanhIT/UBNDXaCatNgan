import React, { useState } from 'react';

export interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  documentNumberSymbol: string;
  issuingAgency?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  attachments?: { id?: string; name: string; size: string; type: string; url?: string }[];
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  documentNumberSymbol,
  issuingAgency = 'UBND Huyện',
  fileUrl,
  fileName = 'VanBan.pdf',
  fileType = 'pdf',
  attachments = []
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeFileUrl, setActiveFileUrl] = useState<string | undefined>(fileUrl);
  const [activeFileName, setActiveFileName] = useState<string>(fileName);

  if (!isOpen) return null;

  const currentUrl = activeFileUrl || fileUrl || '/sample-doc.pdf';

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 25, 50));
  };

  const handleResetZoom = () => {
    setZoomLevel(100);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
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
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isFullscreen ? 0 : 20
      }}
    >
      <div
        style={{
          width: isFullscreen ? '100vw' : '92vw',
          height: isFullscreen ? '100vh' : '92vh',
          backgroundColor: '#ffffff',
          borderRadius: isFullscreen ? 0 : 12,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Top Header */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: '#1e293b',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #334155'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
            <span
              style={{
                background: '#3b82f6',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 4,
                whiteSpace: 'nowrap'
              }}
            >
              {documentNumberSymbol}
            </span>
            <span
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#f8fafc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 600
              }}
            >
              {documentTitle}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={toggleFullscreen}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              {isFullscreen ? '↙ Thu nhỏ' : '⛶ Toàn màn hình'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#ef4444',
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
        </div>

        {/* Toolbar Controls */}
        <div
          style={{
            padding: '8px 20px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, color: '#475569' }}>Đang xem:</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>{activeFileName}</span>
          </div>

          {/* Zoom & View Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6 }}>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 50}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: '4px 10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: zoomLevel <= 50 ? 'not-allowed' : 'pointer',
                  color: '#334155'
                }}
              >
                -
              </button>
              <span style={{ padding: '0 8px', fontWeight: 700, color: '#0f172a', minWidth: 48, textAlign: 'center' }}>
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 200}
                style={{
                  border: 'none',
                  background: 'none',
                  padding: '4px 10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: zoomLevel >= 200 ? 'not-allowed' : 'pointer',
                  color: '#334155'
                }}
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetZoom}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              Đặt lại
            </button>

            <a
              href={currentUrl}
              download={activeFileName}
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#2563eb',
                color: '#ffffff',
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              ⬇ Tải file xuống
            </a>
          </div>
        </div>

        {/* Main Body 2-Pane: Left Sidebar File Selector & Right PDF Canvas Viewer */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left Metadata & Attachments Selector Pane */}
          <div
            style={{
              width: 300,
              backgroundColor: '#ffffff',
              borderRight: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              padding: 16,
              overflowY: 'auto'
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Cơ quan ban hành</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{issuingAgency}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Số / Ký hiệu</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#2563eb' }}>{documentNumberSymbol}</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Trích yếu nội dung</div>
              <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.4, background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                {documentTitle}
              </div>
            </div>

            {/* List of Attachments */}
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>DANH SÁCH FILE ({attachments.length > 0 ? attachments.length : 1})</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* File chính */}
                <div
                  onClick={() => {
                    setActiveFileUrl(fileUrl);
                    setActiveFileName(fileName);
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: activeFileName === fileName ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    background: activeFileName === fileName ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '0.82rem'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>📄 {fileName}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Văn bản chính chính thức</div>
                </div>

                {/* File phụ lục / kèm theo */}
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      if (att.url) setActiveFileUrl(att.url);
                      setActiveFileName(att.name);
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: activeFileName === att.name ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: activeFileName === att.name ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>📎 {att.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>Phụ lục ({att.size})</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Document Viewer Canvas */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#525659',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'auto',
              padding: 20
            }}
          >
            <div
              style={{
                width: `${zoomLevel}%`,
                maxWidth: '1000px',
                height: '100%',
                backgroundColor: '#ffffff',
                boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                borderRadius: 4,
                overflow: 'hidden',
                transition: 'width 0.2s ease'
              }}
            >
              {fileType === 'pdf' || currentUrl.includes('.pdf') ? (
                <iframe
                  src={currentUrl}
                  title={activeFileName}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                />
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 16 }}>📄</div>
                  <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: 8 }}>{activeFileName}</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: 360, marginBottom: 20 }}>
                    Tài liệu thuộc định dạng văn bản đính kèm ({fileType.toUpperCase()}). Bạn có thể xem thông tin trích yếu hoặc bấm tải về để mở trên máy tính.
                  </p>
                  <a
                    href={currentUrl}
                    download={activeFileName}
                    className="btn btn-primary"
                    style={{ textDecoration: 'none', padding: '8px 20px', borderRadius: 6, fontSize: '0.88rem' }}
                  >
                    ⬇ Tải file {activeFileName}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
