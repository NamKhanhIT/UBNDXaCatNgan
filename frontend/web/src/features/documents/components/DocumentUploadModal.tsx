'use client';

import React, { useState } from 'react';
import { useToast } from '../../../components/ui/ToastContext';

interface DocumentUploadModalProps {
  onUploadSuccess: (newDoc: any) => void;
  onClose: () => void;
}

export function DocumentUploadModal({ onUploadSuccess, onClose }: DocumentUploadModalProps) {
  const { addToast } = useToast();

  const [documentType, setDocumentType] = useState<'incoming' | 'outgoing'>('incoming');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentSymbol, setDocumentSymbol] = useState('UBND-VP');
  const [subject, setSubject] = useState('');
  const [issuingAgency, setIssuingAgency] = useState('UBND Huyện Thanh Chương');
  const [isUrgent, setIsUrgent] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!subject) {
        setSubject(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      addToast('Cảnh báo', 'Vui lòng nhập trích yếu nội dung văn bản', 'warning');
      return;
    }

    try {
      setIsAnalyzing(true);
      addToast('Đang xử lý', 'Hệ thống đang trích xuất và phân tích nội dung văn bản...', 'info');

      await new Promise(resolve => setTimeout(resolve, 800));

      const newDoc = {
        id: `DOC-${Date.now().toString().slice(-4)}`,
        documentNumber: documentNumber || '156',
        documentSymbol: documentSymbol || 'UBND-VP',
        subject: subject.trim(),
        category: 'Chỉ đạo điều hành',
        sender: issuingAgency || 'UBND Huyện Thanh Chương',
        issuedDate: new Date().toISOString().split('T')[0],
        receivedDate: new Date().toISOString().split('T')[0],
        isUrgent,
        isScheduled: false,
        processingStatus: 'PendingConfirmation',
        aiSummary: subject.trim(),
      };

      addToast('Tiếp nhận thành công', 'Đã phân tích văn bản hoàn tất!', 'success');
      onUploadSuccess(newDoc);
    } catch (err: any) {
      addToast('Lỗi tiếp nhận', err.message || 'Không thể tải lên văn bản', 'danger');
    } finally {
      setIsAnalyzing(false);
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
          maxWidth: 620,
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
              Tiếp Nhận & Tải Lên Văn Bản Công Vụ Mới
            </h2>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
              Hỗ trợ tệp định dạng PDF, DOCX với khả năng trích xuất chứng cứ
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
            {/* Chọn tệp */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                Tệp đính kèm toàn văn (PDF / DOCX):
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.doc"
                className="form-input"
                onChange={handleFileChange}
              />
              {selectedFile && (
                <div style={{ fontSize: '0.76rem', color: '#166534', marginTop: 4, fontWeight: 600 }}>
                  ✓ Đã chọn: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>

            {/* Hướng văn bản */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                  Luồng văn bản:
                </label>
                <select
                  className="form-input"
                  value={documentType}
                  onChange={e => setDocumentType(e.target.value as any)}
                >
                  <option value="incoming">Văn bản đến (Cấp trên / Cơ quan gửi đến)</option>
                  <option value="outgoing">Văn bản đi (UBND xã ban hành)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                  Cơ quan ban hành / Nơi gửi:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={issuingAgency}
                  onChange={e => setIssuingAgency(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Số & Ký hiệu */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                  Số văn bản:
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: 142"
                  value={documentNumber}
                  onChange={e => setDocumentNumber(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                  Ký hiệu văn bản:
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ví dụ: CT-UBND"
                  value={documentSymbol}
                  onChange={e => setDocumentSymbol(e.target.value)}
                />
              </div>
            </div>

            {/* Trích yếu */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 4 }}>
                Trích yếu nội dung văn bản (*):
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Nhập tóm tắt nội dung hoặc để AI tự động trích xuất từ tệp..."
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
              />
            </div>

            {/* Độ khẩn */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={e => setIsUrgent(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#dc2626' }}
              />
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: isUrgent ? '#dc2626' : '#334155' }}>
                Văn bản khẩn / Hỏa tốc cần xử lý ngay trong ngày
              </span>
            </label>
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
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isAnalyzing}
              style={{ fontWeight: 800, padding: '8px 20px' }}
            >
              {isAnalyzing ? 'Đang phân tích...' : 'Tiếp Nhận & Phân Tích'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
