'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateShort } from '../../lib/formatters';
import { DocumentEditor } from '../workflow/DocumentEditor';
import { WorkflowDocumentDetail } from '../workflow/WorkflowDocumentDetail';
import { WorkflowTaskDetail } from '../workflow/WorkflowTaskDetail';
import { WorkflowEmpty, WorkflowError, WorkflowLoading, WorkflowPaging } from '../workflow/WorkflowFeedback';
import { useWorkflowQuery } from '../workflow/useWorkflow';
import { documentLabels, queryString, type DocumentKind, type DocumentRow, type Page } from '../workflow/workflow.service';
import styles from '../workflow/workflow.module.css';

export function DocumentsFeature() {
  const router = useRouter();
  const params = useSearchParams();
  const search = params.get('q') || '';
  const source = params.get('source') || 'all';
  const scope = params.get('scope') || 'mine';
  const status = params.get('status') || 'all';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const documentId = params.get('documentId');
  const kind: DocumentKind = params.get('kind') === 'Outgoing' ? 'Outgoing' : 'Inbox';
  const taskId = params.get('taskId');
  const debouncedSearch = useDebounce(search, 300);
  const [creating, setCreating] = useState<DocumentKind>();
  const query = useWorkflowQuery<Page<DocumentRow>>('/api/v1/Documents?' + queryString({ search: debouncedSearch, source, scope, status, page, pageSize: 20 }));
  const navigate = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(changes).forEach(([key, value]) => value === null || value === '' ? next.delete(key) : next.set(key, String(value)));
    router.replace('/documents?' + next.toString(), { scroll: false });
  };
  return <main className={styles.page}>
    <header className={styles.heading}>
      <div><h1>Kho văn bản</h1><p className={styles.muted}>Tiếp nhận, trình xử lý và theo dõi các công việc phát sinh từ văn bản.</p></div>
      <div className={styles.row}><button className={styles.secondary} onClick={() => setCreating('Outgoing')}>Soạn văn bản đi</button>
        <button className={styles.button} onClick={() => setCreating('Inbox')}>Tải văn bản</button></div>
    </header>
    <div className={styles.toolbar}>
      <input value={search} aria-label="Tìm văn bản" placeholder="Tìm trích yếu, số / ký hiệu, nguồn gửi…" onChange={event => navigate({ q: event.target.value, page: 1 })} />
      <button className={styles.secondary} onClick={query.refresh}>Làm mới</button>
    </div>
    <div className={styles.toolbar}>
      <label>Nguồn <select aria-label="Nguồn văn bản" value={source} onChange={e => navigate({ source: e.target.value, page: 1, status: 'all' })}>
        <option value="all">Tất cả nguồn</option><option value="Inbox">Văn bản đầu vào</option><option value="Outgoing">Văn bản đi</option>
      </select></label>
      <label>Phạm vi <select aria-label="Phạm vi văn bản" value={scope} onChange={e => navigate({ scope: e.target.value, page: 1 })}>
        <option value="mine">Liên quan đến tôi</option><option value="accessible">Tất cả được phép xem</option>
      </select></label>
      <label>Trạng thái <select aria-label="Trạng thái văn bản" value={status} onChange={e => navigate({ status: e.target.value, page: 1 })}>
        <option value="all">Tất cả trạng thái</option>{Object.entries(documentLabels).filter(([key]) => source === 'all' || (source === 'Inbox' ? ['New', 'Submitted', 'NeedsSupplement', 'Assigned', 'Archived'].includes(key) : ['Draft', 'PendingSignature', 'Issued', 'Sent', 'Rejected', 'Recalled', 'Cancelled'].includes(key)))
          .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      {(search || source !== 'all' || status !== 'all') && <button className={styles.secondary} onClick={() => navigate({ q: null, source: 'all', status: 'all', page: 1 })}>Xóa bộ lọc</button>}
    </div>
    <WorkflowError error={query.error} retry={query.refresh} />
    {query.loading && <WorkflowLoading />}
    {query.data?.items.length === 0 && <WorkflowEmpty filtered={!!search || source !== 'all' || status !== 'all'} />}
    {!!query.data?.items.length && <div className={styles.tableWrap}><table className={styles.table}>
      <thead><tr><th>Văn bản</th><th>Nguồn / nơi nhận</th><th>Ngày</th><th>Trạng thái</th><th>Công việc</th></tr></thead>
      <tbody>{query.data.items.map(document => <tr key={document.kind + document.id}>
        <td className={styles.titleCell}><button className={styles.titleButton} onClick={() => navigate({ kind: document.kind, documentId: document.id })}>{document.title}</button>
          <span className={styles.meta}>{document.number || 'Chưa có số'} · {document.kind === 'Inbox' ? 'Đầu vào' : 'Văn bản đi'}{document.isUrgent ? ' · Khẩn' : ''}</span></td>
        <td>{document.sender || 'Chưa xác định'}</td><td className={styles.dateCell}>{formatDateShort(document.date)}<span className={styles.meta}>{document.dateLabel}</span></td>
        <td><span className={styles.badge + ' ' + (document.status === 'NeedsSupplement' ? styles.red : styles.blue)}>{documentLabels[document.status] || 'Chưa xác định'}</span>
          {document.handlerName && <span className={styles.meta}>Đang xử lý: {document.handlerName}</span>}</td>
        <td><button className={styles.titleButton} onClick={() => navigate({ kind: document.kind, documentId: document.id })}>{document.taskCount ? `Mở công việc (${document.taskCount})` : '0 công việc'}</button></td>
      </tr>)}</tbody>
    </table></div>}
    {query.data && <WorkflowPaging page={page} size={20} total={query.data.totalCount} onPage={value => navigate({ page: value })} />}
    {creating && <DocumentEditor kind={creating} onClose={() => setCreating(undefined)} onSaved={(savedKind, id) => { setCreating(undefined); navigate({ kind: savedKind, documentId: id }); query.refresh(); }} />}
    {documentId && <WorkflowDocumentDetail key={kind + documentId} kind={kind} documentId={documentId} onClose={() => navigate({ documentId: null, kind: null })}
      onOpenTask={id => navigate({ taskId: id })} />}
    {taskId && <WorkflowTaskDetail key={taskId} taskId={taskId} onClose={() => navigate({ taskId: null })} onOpenTask={id => navigate({ taskId: id })} />}
  </main>;
}
