'use client';

import { WorkflowApiError } from './workflow.service';
import styles from './workflow.module.css';

export function WorkflowError({ error, retry }: { error?: Error; retry?: () => void }) {
  if (!error) return null;
  const status = error instanceof WorkflowApiError ? error.status : undefined;
  return <div className={styles.error} role="alert">
    <div>{status === 401 ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.' : status === 403 ? 'Bạn không có quyền thực hiện thao tác này.' : error.message}</div>
    {status === 401 ? <a className={styles.secondary} href="/login">Đăng nhập</a>
      : retry && <button className={styles.secondary} type="button" onClick={retry}>Thử lại</button>}
  </div>;
}
export function WorkflowLoading() { return <div className={styles.notice} role="status" aria-live="polite">Đang tải dữ liệu…</div>; }
export function WorkflowEmpty({ filtered = false }: { filtered?: boolean }) {
  return <div className={styles.empty}><h2>{filtered ? 'Không có kết quả phù hợp' : 'Chưa có dữ liệu trong phạm vi của bạn'}</h2>
    <p className={styles.muted}>{filtered ? 'Thử đổi bộ lọc hoặc xóa từ khóa tìm kiếm.' : 'Dữ liệu sẽ xuất hiện khi có văn bản hoặc công việc liên quan.'}</p></div>;
}
export function WorkflowPaging({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <div className={styles.pagination}><span>{total} kết quả · Trang {page}/{pages}</span><div className={styles.row}>
    <button type="button" className={styles.secondary} disabled={page <= 1} onClick={() => onPage(page - 1)}>Trước</button>
    <button type="button" className={styles.secondary} disabled={page >= pages} onClick={() => onPage(page + 1)}>Sau</button>
  </div></div>;
}
