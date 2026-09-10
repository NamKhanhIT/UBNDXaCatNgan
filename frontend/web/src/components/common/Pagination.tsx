import React from 'react';

export interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
  className?: string;
}

export function Pagination({
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  itemName = 'mục',
  className = '',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Tính khoảng bản ghi hiển thị (VD: 1 - 20 trên tổng số 105)
  const fromIndex = totalCount === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const toIndex = Math.min(safeCurrentPage * pageSize, totalCount);

  // Tạo danh sách số trang thông minh kèm ellipsis '...'
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (safeCurrentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  return (
    <nav
      className={`pagination-container ${className}`}
      aria-label="Điều hướng phân trang"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderTop: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        gap: 12,
        borderRadius: '0 0 8px 8px',
      }}
    >
      {/* ── 1. THỐNG KÊ BẢN GHI VÀ CHỌN PAGE SIZE ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.84rem', color: '#475569' }}>
        <span>
          Hiển thị <strong>{fromIndex}</strong> – <strong>{toIndex}</strong> trong tổng số{' '}
          <strong style={{ color: '#1e293b' }}>{totalCount.toLocaleString('vi-VN')}</strong> {itemName}
        </span>

        {onPageSizeChange && pageSizeOptions && pageSizeOptions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Mỗi trang:</span>
            <select
              className="form-select"
              aria-label="Chọn số mục hiển thị trên mỗi trang"
              value={pageSize}
              onChange={e => {
                const newSize = Number(e.target.value);
                if (newSize > 0) {
                  onPageSizeChange(newSize);
                  onPageChange(1);
                }
              }}
              style={{
                width: 'auto',
                padding: '3px 8px',
                height: 30,
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#1e293b',
                borderRadius: 6,
                borderColor: '#cbd5e1',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
              }}
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>
                  {size} / trang
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── 2. NÚT CHUYỂN TRANG THÔNG MINH ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {/* Về trang đầu */}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange(1)}
          title="Trang đầu tiên"
          aria-label="Về trang đầu tiên"
          style={{
            height: 32,
            minWidth: 32,
            padding: '0 8px',
            fontSize: '0.78rem',
            color: safeCurrentPage <= 1 ? '#cbd5e1' : '#475569',
            opacity: safeCurrentPage <= 1 ? 0.6 : 1,
          }}
        >
          <i className="fa-solid fa-angles-left" aria-hidden="true" />
        </button>

        {/* Trang trước */}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          title="Trang trước"
          aria-label="Về trang trước"
          style={{
            height: 32,
            padding: '0 10px',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: safeCurrentPage <= 1 ? '#cbd5e1' : '#334155',
            opacity: safeCurrentPage <= 1 ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          <span>Trước</span>
        </button>

        {/* Danh sách các số trang */}
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span
                key={`ellipsis-${idx}`}
                style={{
                  minWidth: 32,
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '0.82rem',
                  userSelect: 'none',
                }}
              >
                •••
              </span>
            );
          }

          const pageNumber = p as number;
          const isActive = pageNumber === safeCurrentPage;

          return (
            <button
              key={pageNumber}
              type="button"
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Trang ${pageNumber}`}
              onClick={() => onPageChange(pageNumber)}
              style={{
                height: 32,
                minWidth: 32,
                padding: '0 8px',
                fontSize: '0.82rem',
                fontWeight: isActive ? 800 : 500,
                borderRadius: 6,
                background: isActive ? '#2563eb' : 'transparent',
                color: isActive ? '#ffffff' : '#334155',
                boxShadow: isActive ? '0 1px 3px rgba(37,99,235,0.3)' : 'none',
              }}
            >
              {pageNumber}
            </button>
          );
        })}

        {/* Trang tiếp */}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={safeCurrentPage >= totalPages}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          title="Trang tiếp theo"
          aria-label="Sang trang tiếp theo"
          style={{
            height: 32,
            padding: '0 10px',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: safeCurrentPage >= totalPages ? '#cbd5e1' : '#334155',
            opacity: safeCurrentPage >= totalPages ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>Sau</span>
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>

        {/* Đến trang cuối */}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={safeCurrentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Trang cuối cùng"
          aria-label="Đến trang cuối cùng"
          style={{
            height: 32,
            minWidth: 32,
            padding: '0 8px',
            fontSize: '0.78rem',
            color: safeCurrentPage >= totalPages ? '#cbd5e1' : '#475569',
            opacity: safeCurrentPage >= totalPages ? 0.6 : 1,
          }}
        >
          <i className="fa-solid fa-angles-right" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
