'use client';

import React, { useState, useRef, useEffect } from 'react';
import { formatDateShort } from '../../../lib/formatters';

// Interface dữ liệu truyền vào modal xem minh chứng
export interface ViewingProofData {
  title: string;
  fileName: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: string;
  uploadedAt?: string;
  category?: 'EDUCATION' | 'CERTIFICATION' | 'ACHIEVEMENT' | 'POSITION' | 'CV_DOCUMENT' | 'GENERAL';
  recipientName?: string;
  degreeMajor?: string;
  institution?: string;
  graduationYear?: number | string;
  sourceText?: string;
  sourcePage?: number;
}

interface ProofDocumentViewerModalProps {
  proof: ViewingProofData;
  onClose: () => void;
}

// Chuyển chuỗi Base64 Data URL thành ArrayBuffer cho docx-preview
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const base64Clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = window.atob(base64Clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Giải mã Base64 sang văn bản UTF-8
function decodeBase64ToUtf8(base64: string): string {
  try {
    const base64Clean = base64.includes(',') ? base64.split(',')[1] : base64;
    const binaryString = window.atob(base64Clean);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  } catch {
    return 'Không thể giải mã nội dung văn bản.';
  }
}

export function ProofDocumentViewerModal({ proof, onClose }: ProofDocumentViewerModalProps) {
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isDocxLoading, setIsDocxLoading] = useState<boolean>(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  const documentPrintRef = useRef<HTMLDivElement>(null);
  const docxContainerRef = useRef<HTMLDivElement>(null);

  // Khóa cuộn trang nền khi mở modal
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const lowerName = (proof.fileName || '').toLowerCase();
  const rawFileUrl = proof.fileUrl || '';

  // Nhận diện loại tệp hình ảnh
  const isImageFile =
    rawFileUrl.startsWith('data:image/') ||
    /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(lowerName);

  // Nhận diện loại tệp PDF
  const isPdfFile =
    rawFileUrl.startsWith('data:application/pdf') ||
    /\.pdf$/i.test(lowerName) ||
    rawFileUrl.includes('.pdf');

  // Nhận diện loại tệp Word (.docx / .doc)
  const isDocxFile =
    /\.(docx|doc|rtf|odt)$/i.test(lowerName) ||
    rawFileUrl.startsWith('data:application/vnd.openxmlformats-officedocument.wordprocessingml') ||
    rawFileUrl.startsWith('data:application/msword');

  // Nhận diện loại tệp văn bản thuần / dữ liệu
  const isTextFile =
    /\.(txt|md|csv|json|log)$/i.test(lowerName) ||
    rawFileUrl.startsWith('data:text/');

  // Chuẩn hóa Data URL để trình duyệt hiển thị đúng chuẩn MIME
  const normalizedFileUrl = React.useMemo(() => {
    if (!rawFileUrl) return '';
    if (isPdfFile && (rawFileUrl.startsWith('data:application/octet-stream') || rawFileUrl.startsWith('data:;'))) {
      return rawFileUrl.replace(/^data:[^;]*/, 'data:application/pdf');
    }
    if (isImageFile && (rawFileUrl.startsWith('data:application/octet-stream') || rawFileUrl.startsWith('data:;'))) {
      const mime = lowerName.endsWith('.png') ? 'image/png' : lowerName.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      return rawFileUrl.replace(/^data:[^;]*/, `data:${mime}`);
    }
    return rawFileUrl;
  }, [rawFileUrl, isPdfFile, isImageFile, lowerName]);

  const hasActualFile = Boolean(proof.fileUrl && proof.fileUrl.length > 0);

  // Xử lý nạp và render tài liệu Word trực tiếp vào trình duyệt
  useEffect(() => {
    if (isDocxFile && proof.fileUrl && docxContainerRef.current) {
      let isMounted = true;
      setIsDocxLoading(true);
      setDocxError(null);

      import('docx-preview')
        .then(docxModule => {
          if (!isMounted || !docxContainerRef.current) return;
          docxContainerRef.current.innerHTML = '';

          const renderOptions = {
            className: 'docx-preview-rendered-page',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderEndnotes: true,
          };

          if (proof.fileUrl?.startsWith('data:')) {
            const buffer = base64ToArrayBuffer(proof.fileUrl);
            return docxModule.renderAsync(buffer, docxContainerRef.current, undefined, renderOptions);
          } else if (proof.fileUrl) {
            return fetch(proof.fileUrl)
              .then(res => res.arrayBuffer())
              .then(buffer => {
                if (!isMounted || !docxContainerRef.current) return;
                return docxModule.renderAsync(buffer, docxContainerRef.current, undefined, renderOptions);
              });
          }
        })
        .then(() => {
          if (isMounted) setIsDocxLoading(false);
        })
        .catch(err => {
          console.warn('docx-preview warning/error:', err);
          if (isMounted) {
            setIsDocxLoading(false);
            setDocxError('Tài liệu Word này sử dụng định dạng nhị phân cổ điển (.doc) hoặc chứa macro bảo mật. Đồng chí có thể xem thông tin tóm tắt bên dưới hoặc tải tệp về máy.');
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isDocxFile, proof.fileUrl]);

  // Xử lý nạp văn bản thuần (Text / JSON / CSV)
  useEffect(() => {
    if (isTextFile && proof.fileUrl) {
      if (proof.fileUrl.startsWith('data:')) {
        setTextContent(decodeBase64ToUtf8(proof.fileUrl));
      } else {
        fetch(proof.fileUrl)
          .then(res => res.text())
          .then(txt => setTextContent(txt))
          .catch(() => setTextContent('Không thể tải nội dung tệp văn bản.'));
      }
    }
  }, [isTextFile, proof.fileUrl]);

  // Xử lý Zoom
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.4));
  const handleResetZoom = () => {
    setZoom(1.0);
    setRotation(0);
  };

  // Xử lý Xoay
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  // In văn bản minh chứng
  const handlePrint = () => {
    window.print();
  };

  // Tải tệp minh chứng về máy
  const handleDownload = () => {
    if (proof.fileUrl) {
      const link = document.createElement('a');
      link.href = proof.fileUrl;
      link.download = proof.fileName || 'Minh_Chung_Ho_So.docx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.86)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: isFullscreen ? 0 : 12,
        transition: 'all 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: isFullscreen ? '100vw' : '96vw',
          maxWidth: isFullscreen ? '100vw' : '1280px',
          height: isFullscreen ? '100vh' : '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          borderRadius: isFullscreen ? 0 : 12,
          overflow: 'hidden',
          background: '#ffffff',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── 1. HEADER & TOOLBAR ĐIỀU KHIỂN XEM VĂN BẢN TRỰC TIẾP ── */}
        <div
          style={{
            background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #334155',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Tiêu đề & Thông tin tệp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: '60%' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: isDocxFile
                  ? 'rgba(37, 99, 235, 0.25)'
                  : isPdfFile
                    ? 'rgba(239, 68, 68, 0.25)'
                    : isImageFile
                      ? 'rgba(16, 185, 129, 0.25)'
                      : 'rgba(59, 130, 246, 0.25)',
                border: `1.5px solid ${isDocxFile
                  ? '#3b82f6'
                  : isPdfFile
                    ? '#ef4444'
                    : isImageFile
                      ? '#10b981'
                      : '#60a5fa'
                  }`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDocxFile ? '#60a5fa' : isPdfFile ? '#f87171' : isImageFile ? '#34d399' : '#60a5fa',
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              <i
                className={`fa-solid ${isDocxFile
                  ? 'fa-file-word'
                  : isPdfFile
                    ? 'fa-file-pdf'
                    : isImageFile
                      ? 'fa-file-image'
                      : 'fa-file-lines'
                  }`}
              />
            </div>

            <div style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 800,
                    margin: 0,
                    color: '#f8fafc',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={proof.title}
                >
                  {proof.title}
                </h3>
                {hasActualFile && (
                  <span
                    style={{
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#4ade80',
                      border: '1px solid rgba(34, 197, 94, 0.4)',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <i className="fa-solid fa-circle-check" /> Trình Duyệt Đang Xem Trực Tiếp
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: '#94a3b8',
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <span title={proof.fileName}>
                  <i className="fa-solid fa-paperclip" style={{ marginRight: 4 }} /> {proof.fileName}
                </span>
                {proof.fileSize && <span>• Dung lượng: {proof.fileSize}</span>}
                {proof.uploadedAt && <span>• Ngày tải: {proof.uploadedAt}</span>}
              </div>
            </div>
          </div>

          {/* Thanh công cụ tương tác & Phóng to / Thu nhỏ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasActualFile && (isImageFile || isDocxFile || isTextFile) && (
              <>
                {/* Bộ điều khiển Phóng to / Thu nhỏ */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#334155',
                    borderRadius: 6,
                    padding: '2px 4px',
                    border: '1px solid #475569',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    title="Thu nhỏ (-)"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#cbd5e1',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontSize: '0.8rem',
                    }}
                  >
                    <i className="fa-solid fa-minus" />
                  </button>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      minWidth: 46,
                      textAlign: 'center',
                      color: '#f8fafc',
                    }}
                  >
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    title="Phóng to (+)"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#cbd5e1',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontSize: '0.8rem',
                    }}
                  >
                    <i className="fa-solid fa-plus" />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    title="Đặt lại kích thước chuẩn 100%"
                    style={{
                      background: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: 4,
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      marginLeft: 2,
                    }}
                  >
                    100%
                  </button>
                </div>

                {/* Xoay 90 độ (cho ảnh) */}
                {isImageFile && (
                  <button
                    type="button"
                    onClick={handleRotate}
                    title="Xoay ảnh 90 độ"
                    style={{
                      background: '#334155',
                      border: '1px solid #475569',
                      color: '#f8fafc',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    <i className="fa-solid fa-rotate-right" />
                  </button>
                )}
              </>
            )}

            {hasActualFile && (
              <>
                {/* In ấn */}
                <button
                  type="button"
                  onClick={handlePrint}
                  title="In văn bản minh chứng này"
                  style={{
                    background: '#334155',
                    border: '1px solid #475569',
                    color: '#f8fafc',
                    borderRadius: 6,
                    padding: '6px 11px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  <i className="fa-solid fa-print" />
                </button>

                {/* Tải về máy */}
                <button
                  type="button"
                  onClick={handleDownload}
                  title="Tải bản gốc về máy tính"
                  style={{
                    background: '#2563eb',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: 6,
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <i className="fa-solid fa-download" /> Tải Về
                </button>
              </>
            )}

            {/* Toàn màn hình */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Xem toàn màn hình'}
              style={{
                background: '#334155',
                border: '1px solid #475569',
                color: '#f8fafc',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} />
            </button>

            {/* Đóng modal */}
            <button
              type="button"
              onClick={onClose}
              title="Đóng trình xem"
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#f87171',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                marginLeft: 4,
              }}
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        </div>

        {/* ── 2. VIEWPORT HIỂN THỊ NỘI DUNG TỆP TRỰC TIẾP TRÊN TRÌNH DUYỆT ── */}
        <div
          style={{
            flex: 1,
            background: '#334155',
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: isPdfFile ? 'stretch' : 'flex-start',
            padding: isPdfFile ? 0 : '24px 16px',
            position: 'relative',
          }}
        >
          {/* ════ TRƯỜNG HỢP 1: TỆP WORD (.DOCX / .DOC) RENDER NGUYÊN BẢN TRANG A4 ════ */}
          {hasActualFile && isDocxFile ? (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minHeight: '100%',
              }}
            >
              {isDocxLoading && (
                <div
                  style={{
                    background: '#ffffff',
                    padding: '30px 40px',
                    borderRadius: 10,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                    textAlign: 'center',
                    margin: '40px auto',
                  }}
                >
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ color: '#2563eb', fontSize: 32, marginBottom: 12 }} />
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                    Đang nạp và hiển thị tài liệu Word trực tiếp...
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                    Hệ thống đang phân tích cấu trúc trang, bảng biểu và phông chữ hành chính.
                  </div>
                </div>
              )}

              {docxError && (
                <div
                  style={{
                    background: '#fffaf0',
                    border: '1.5px solid #fed7aa',
                    padding: 20,
                    borderRadius: 8,
                    maxWidth: 640,
                    margin: '20px auto',
                    textAlign: 'center',
                  }}
                >
                  <i className="fa-solid fa-circle-info" style={{ color: '#ea580c', fontSize: 24, marginBottom: 8 }} />
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#9a3412', marginBottom: 4 }}>
                    {docxError}
                  </div>
                  {proof.sourceText && (
                    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12, fontSize: '0.8rem', color: '#475569', textAlign: 'left', marginTop: 12 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Trích đoạn hồ sơ đã trích xuất:</div>
                      <div style={{ fontStyle: 'italic' }}>"{proof.sourceText}"</div>
                    </div>
                  )}
                </div>
              )}

              {/* Khung chứa các trang A4 Word được docx-preview render */}
              <div
                ref={docxContainerRef}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                  width: '100%',
                  maxWidth: '880px',
                  margin: '0 auto',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                  borderRadius: 4,
                  background: '#ffffff',
                }}
              />
            </div>
          ) : hasActualFile && isPdfFile ? (
            /* ════ TRƯỜNG HỢP 2: TỆP PDF NHÚNG IFRAME TOÀN DIỆN ════ */
            <div
              style={{
                width: '100%',
                height: '100%',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <iframe
                src={normalizedFileUrl}
                title={proof.title}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '75vh',
                  border: 'none',
                  flex: 1,
                }}
              />
            </div>
          ) : hasActualFile && isImageFile ? (
            /* ════ TRƯỜNG HỢP 3: TỆP HÌNH ẢNH (JPG, PNG, WEBP) ════ */
            <div
              ref={documentPrintRef}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                maxWidth: '96%',
                maxHeight: '96%',
                margin: 'auto',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  padding: 12,
                  borderRadius: 8,
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
                  maxWidth: 920,
                  width: '100%',
                }}
              >
                <img
                  src={normalizedFileUrl}
                  alt={proof.title}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '75vh',
                    objectFit: 'contain',
                    borderRadius: 4,
                    display: 'block',
                  }}
                />
              </div>
            </div>
          ) : hasActualFile && isTextFile ? (
            /* ════ TRƯỜNG HỢP 4: TỆP VĂN BẢN THUẦN (TXT, MD, CSV, JSON) ════ */
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
                width: '100%',
                maxWidth: '880px',
                background: '#ffffff',
                borderRadius: 8,
                padding: '24px 32px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                fontFamily: '"Times New Roman", Times, serif',
                lineHeight: 1.8,
                fontSize: '1rem',
                color: '#1e293b',
                whiteSpace: 'pre-wrap',
              }}
            >
              {textContent || 'Đang tải nội dung văn bản...'}
            </div>
          ) : hasActualFile ? (
            /* ════ TRƯỜNG HỢP 5: TỆP KHÁC ĐÃ NẠP ════ */
            <div
              style={{
                background: '#ffffff',
                borderRadius: 12,
                padding: '36px 32px',
                maxWidth: 520,
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.4)',
                margin: 'auto',
              }}
            >
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 14,
                  background: '#f1f5f9',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 30,
                  margin: '0 auto 16px auto',
                }}
              >
                <i className="fa-solid fa-file-lines" />
              </div>

              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                {proof.fileName}
              </h4>

              <p style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px 0' }}>
                Tệp minh chứng đã được tải lên và sẵn sàng trong hệ thống.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDownload}
                  style={{ fontWeight: 700 }}
                >
                  <i className="fa-solid fa-download" style={{ marginRight: 6 }} /> Tải Về Máy
                </button>
              </div>
            </div>
          ) : (
            /* ════ TRƯỜNG HỢP 6: CHƯA CÓ TỆP NÀO ĐƯỢC TẢI LÊN ════ */
            <div
              style={{
                background: '#ffffff',
                borderRadius: 12,
                padding: '36px 32px',
                maxWidth: 480,
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 30px -5px rgba(0, 0, 0, 0.3)',
                margin: 'auto',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  margin: '0 auto 16px auto',
                }}
              >
                <i className="fa-solid fa-file-circle-xmark" />
              </div>

              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                Chưa Có Tệp Minh Chứng Thực Tế
              </h4>

              <p style={{ fontSize: '0.84rem', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px 0' }}>
                Mục <strong>"{proof.title}"</strong> hiện chưa có tệp đính kèm (.docx, .pdf, .jpg, .png).
                Đồng chí vui lòng bấm <strong>Chỉnh Sửa Hồ Sơ</strong> để tải tệp minh chứng lên hệ thống.
              </p>

              {proof.sourceText && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, fontSize: '0.78rem', color: '#475569', textAlign: 'left', marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Trích đoạn liên quan:</div>
                  <div style={{ fontStyle: 'italic' }}>"{proof.sourceText}"</div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onClose}
                  style={{ fontWeight: 700, padding: '6px 20px' }}
                >
                  Đóng Cửa Sổ
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. FOOTER THÔNG TIN & TRẠNG THÁI ── */}
        <div
          style={{
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            padding: '10px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-shield-check" style={{ color: '#16a34a' }} />
            <span>
              Trình duyệt minh chứng điện tử — Hệ thống quản lý công vụ UBND Xã Cát Ngạn.
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onClose}
              style={{ fontWeight: 700, padding: '6px 18px' }}
            >
              <i className="fa-solid fa-check" style={{ marginRight: 6 }} /> Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
