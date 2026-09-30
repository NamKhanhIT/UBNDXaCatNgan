'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateShort } from '../../lib/formatters';
import { TaskComposer } from '../workflow/TaskComposer';
import { WorkflowTaskDetail } from '../workflow/WorkflowTaskDetail';
import { WorkflowEmpty, WorkflowError, WorkflowLoading, WorkflowPaging } from '../workflow/WorkflowFeedback';
import { useWorkflowPermissions, useWorkflowQuery } from '../workflow/useWorkflow';
import { isOverdue, queryString, taskLabel, type DocumentRow, type Page } from '../workflow/workflow.service';
import type { TaskItemDto } from '../../services/task.service';
import styles from '../workflow/workflow.module.css';

const tabs = [['action_needed', 'Cần xử lý'], ['pending_review', 'Chờ nghiệm thu'], ['sent', 'Tôi đã giao'], ['completed', 'Đã nghiệm thu'], ['all', 'Tất cả']];
const quickFilters = [['today', 'Hôm nay'], ['soon', 'Sắp đến hạn'], ['overdue', 'Quá hạn'], ['revision', 'Cần chỉnh sửa']];

export function WorkCenterFeature() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab = tabs.some(([key]) => key === rawTab) ? rawTab! : 'action_needed';
  const scope = searchParams.get('scope') || 'mine';
  const timeFilter = searchParams.get('timeFilter') || '';
  const search = searchParams.get('q') || '';
  const debouncedSearch = useDebounce(search, 300);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const reviewScope = searchParams.get('reviewScope') || '';
  const taskId = searchParams.get('taskId');
  const [composing, setComposing] = useState(false);
  const permissions = useWorkflowPermissions();
  const query = useWorkflowQuery<Page<TaskItemDto>>('/api/v1/Tasks?' + queryString({
    tab, scope, timeFilter, q: debouncedSearch, page, pageSize: 20, reviewScope,
  }));
  const pending = useWorkflowQuery<DocumentRow[]>('/api/v1/Documents/pending');
  const navigate = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => value === null || value === '' ? next.delete(key) : next.set(key, String(value)));
    router.replace('/workcenter?' + next.toString(), { scroll: false });
  };
  useEffect(() => {
    if (rawTab && ['incoming', 'scheduled', 'documents', 'outgoing'].includes(rawTab)) {
      router.replace('/documents', { scroll: false });
    } else if (rawTab === 'today') {
      router.replace('/workcenter?tab=action_needed&timeFilter=today', { scroll: false });
    }
  }, [rawTab, router]);
  const filtered = !!(search || timeFilter);
  return <main className={styles.page}>
    <header className={styles.heading}>
      <div><h1>Công việc hôm nay</h1><p className={styles.muted}>Theo dõi việc cần làm, kết quả đang chờ và trách nhiệm của từng người.</p></div>
      {permissions.data?.canAssign && <button className={styles.button} onClick={() => setComposing(true)}>Giao công việc</button>}
    </header>
    <WorkflowError error={permissions.error} retry={permissions.refresh} />
    <nav className={styles.tabs} role="tablist" aria-label="Nhóm công việc">
      {tabs.map(([key, label]) => <button key={key} className={styles.tab} role="tab" aria-selected={tab === key}
        onClick={() => navigate({ tab: key, page: 1, taskId: null })}>{label}<span>{query.data?.counts?.[key] ?? '…'}</span></button>)}
    </nav>
    <div className={styles.toolbar}>
      <input aria-label="Tìm công việc" placeholder="Tìm công việc, người thực hiện, số văn bản…" value={search} onChange={event => navigate({ q: event.target.value, page: 1 })} />
      <select aria-label="Phạm vi công việc" value={scope} onChange={event => navigate({ scope: event.target.value, page: 1 })}>
        <option value="mine">Liên quan đến tôi</option>
        {permissions.data?.canViewDepartment && <option value="department">Phòng ban của tôi</option>}
        {permissions.data?.canViewOrganization && <option value="system">Trong phạm vi toàn cơ quan</option>}
      </select>
      <button type="button" className={styles.secondary} onClick={() => { query.refresh(); pending.refresh(); }}>Làm mới</button>
    </div>
    <div className={styles.filters} aria-label="Lọc nhanh">
      {quickFilters.map(([key, label]) => <button key={key} type="button" className={styles.filter} aria-pressed={timeFilter === key}
        onClick={() => navigate({ timeFilter: timeFilter === key ? null : key, page: 1 })}>{label}</button>)}
      {filtered && <button type="button" className={styles.secondary} onClick={() => navigate({ q: null, timeFilter: null, page: 1 })}>Xóa bộ lọc</button>}
    </div>
    {!query.isConnected && <div className={styles.notice}>Kết nối cập nhật tự động đang gián đoạn. Danh sách được kiểm tra lại mỗi 30 giây khi bạn mở màn hình này.</div>}
    {tab === 'action_needed' && <section className={styles.queue} aria-label="Văn bản cần xử lý">
      <h2>Văn bản đang đến lượt bạn {pending.data ? '(' + pending.data.length + ')' : ''}</h2>
      <WorkflowError error={pending.error} retry={pending.refresh} />
      {pending.loading && <WorkflowLoading />}
      {pending.data?.length === 0 && <p className={styles.muted}>Không có văn bản đang chờ bạn quyết định hoặc bổ sung.</p>}
      {pending.data?.map(document => <div key={document.id} className={styles.queueRow}>
        <div><button type="button" className={styles.titleButton} onClick={() => router.push('/documents?kind=Inbox&documentId=' + document.id)}>{document.title}</button>
          <span className={styles.meta}>{document.number || 'Chưa có số'} · {document.status === 'NeedsSupplement' ? 'Cần bổ sung' : 'Chờ quyết định'} · Tiếp nhận {formatDateShort(document.date)}</span></div>
        <button type="button" className={styles.secondary} onClick={() => router.push('/documents?kind=Inbox&documentId=' + document.id)}>Mở văn bản</button>
      </div>)}
    </section>}
    {tab === 'pending_review' && <div className={styles.filters} aria-label="Vai trò nghiệm thu">
      {[['', 'Liên quan đến tôi'], ['to_review', 'Tôi cần nghiệm thu'], ['submitted', 'Tôi đã nộp']].map(([key, label]) =>
        <button key={key} type="button" className={styles.filter} aria-pressed={reviewScope === key} onClick={() => navigate({ reviewScope: key, page: 1 })}>{label}</button>)}
    </div>}
    <WorkflowError error={query.error} retry={query.refresh} />
    {query.loading && <WorkflowLoading />}
    {query.data?.items.length === 0 && <WorkflowEmpty filtered={filtered} />}
    {!!query.data?.items.length && <div className={styles.tableWrap}><table className={styles.table}>
      <thead><tr><th>Công việc</th><th>Người thực hiện</th><th>Hạn xử lý</th><th>Trạng thái</th></tr></thead>
      <tbody>{query.data.items.map(task => <tr key={task.id}>
        <td className={styles.titleCell}><button className={styles.titleButton} onClick={() => navigate({ taskId: task.id })}>{task.title}</button>
          <span className={styles.meta}>Người giao: {task.assignerName}{task.parentTaskId ? ' · Phần phối hợp' : ''}</span></td>
        <td>{task.assigneeName}<span className={styles.meta}>{task.departmentName}</span></td>
        <td>{formatDateShort(task.dueDate)}{isOverdue(task) && <span className={styles.meta}><span className={styles.badge + ' ' + styles.red}>Quá hạn</span></span>}</td>
        <td><span className={styles.badge + ' ' + (task.status === 'Completed' ? styles.green : task.status === 'InReview' ? styles.blue : '')}>{taskLabel(task)}</span>
          {task.priority === 'Urgent' && <span className={styles.meta}>Ưu tiên khẩn</span>}</td>
      </tr>)}</tbody>
    </table></div>}
    {query.data && <WorkflowPaging page={page} total={query.data.totalCount} size={20} onPage={next => navigate({ page: next })} />}
    {composing && <TaskComposer onClose={() => setComposing(false)} onCreated={task => { setComposing(false); navigate({ tab: 'sent', taskId: task.id, page: 1 }); }} />}
    {taskId && <WorkflowTaskDetail taskId={taskId} onClose={() => navigate({ taskId: null })} onOpenTask={id => navigate({ taskId: id })} />}
  </main>;
}
