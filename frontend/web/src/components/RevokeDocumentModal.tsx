import React, { useState } from 'react';

export interface RevokeDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  documentNumberSymbol: string;
  onConfirmRevoke: (reason: string) => Promise<void>;
}

export const RevokeDocumentModal: React.FC<RevokeDocumentModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  documentNumberSymbol,
  onConfirmRevoke
}) => {
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 8) {
      setErrorText('Vui lòng nhập lý do thu hồi rõ ràng (tối thiểu 8 ký tự).');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorText('');
      await onConfirmRevoke(reason.trim());
      setReason('');
      onClose();
    } catch (err: any) {
      setErrorText(err?.message || 'Có lỗi xảy ra khi thực hiện thu hồi văn bản.');
    } finally {
      setIsSubmitting(false);
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
          maxWidth: 540,
          backgroundColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: '1rem' }}>
            <span>⚠️ THU HỒI VĂN BẢN ĐÃ BAN HÀNH</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              fontSize: '1.2rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ padding: 20 }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.83rem', color: '#991b1b', lineHeight: 1.45 }}>
            <strong>Cảnh báo nghiệp vụ văn thư:</strong> Văn bản đã được ký phát hành chính thức. Khi thực hiện thu hồi, trạng thái văn bản sẽ được chuyển sang <strong>[THU HỒI]</strong>, đồng thời thông báo thu hồi sẽ được gửi đến tất cả các đơn vị nhận.
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Số / Ký hiệu văn bản</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#dc2626' }}>{documentNumberSymbol}</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Trích yếu văn bản</div>
            <div style={{ fontSize: '0.85rem', color: '#1e293b', background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              {documentTitle}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Lý do thu hồi văn bản <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Nhập lý do thu hồi văn bản theo quy định hành chính..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                resize: 'vertical'
              }}
            />
            {errorText && (
              <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, marginTop: 4 }}>
                {errorText}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '8px 20px',
                borderRadius: 6,
                border: 'none',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'Đang thu hồi...' : 'Xác nhận Thu hồi Văn bản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
