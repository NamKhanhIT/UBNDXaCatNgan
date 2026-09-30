'use client';

import { useState } from 'react';
import { formatDateTimeShort } from '../../lib/formatters';
import { useDebounce } from '../../hooks/useDebounce';
import { useWorkflowMutation, useWorkflowPermissions, useWorkflowQuery } from './useWorkflow';
import { queryString, type Page } from './workflow.service';
import { WorkflowDialog } from './WorkflowDialog';
import { WorkflowError, WorkflowLoading, WorkflowPaging } from './WorkflowFeedback';
import styles from './workflow.module.css';

interface IntakeUser { id: string; fullName: string; canReceiveDocuments: boolean; version?: string }
interface IntakeHistory { id: string; userId: string; entityId: string; details: string; createdAt: string }
export function WorkflowAdmin() {
  const permissions = useWorkflowPermissions();
  const enabled = !!permissions.data?.canManageWorkflowPermissions;
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const debounced = useDebounce(search, 300);
  const users = useWorkflowQuery<Page<IntakeUser>>(enabled ? `/api/v1/WorkflowPermissions/intake?${queryString({ search: debounced, page })}` : null);
  const history = useWorkflowQuery<IntakeHistory[]>(enabled ? '/api/v1/WorkflowPermissions/intake/history' : null);
  const [selected, setSelected] = useState<IntakeUser>(); const [reason, setReason] = useState('');
  const mutation = useWorkflowMutation(() => { setSelected(undefined); setReason(''); users.refresh(); history.refresh(); });
  const busy = mutation.busy;
  const save = async () => {
    if (!selected || busy) return;
    const values = { version: selected.version, canReceiveDocuments: !selected.canReceiveDocuments, reason };
    await mutation.run(`/api/v1/WorkflowPermissions/intake/${selected.id}`, values, 'PUT');
  };
  return <section className={styles.page}>
    <div><h2>Quyền tiếp nhận và trình văn bản</h2><p className={styles.muted}>Chỉ định người được tiếp nhận và trình xử lý; thao tác này không thay đổi vai trò hoặc cấp quyền giao việc.</p></div>
    <WorkflowError error={permissions.error || users.error || history.error} retry={() => { permissions.refresh(); users.refresh(); history.refresh(); }} />
    {permissions.loading && <WorkflowLoading />}
    {!permissions.loading && !enabled && <p className={styles.notice}>Chức năng này dành cho tài khoản quản trị hệ thống đã được chỉ định.</p>}
    {enabled && <>
      <div className={styles.toolbar}><input aria-label="Tìm tài khoản" placeholder="Tìm theo họ tên" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
      {users.loading && <WorkflowLoading />}
      {users.data && <><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Tài khoản</th><th>Quyền tiếp nhận / trình</th><th>Thao tác</th></tr></thead>
        <tbody>{users.data.items.map(person => <tr key={person.id}><td>{person.fullName}</td><td>{person.canReceiveDocuments ? 'Đã được chỉ định' : 'Chưa được chỉ định'}</td>
          <td><button className={styles.secondary} disabled={busy || mutation.uncertain} onClick={() => { setSelected(person); setReason(''); }}>{person.canReceiveDocuments ? 'Thu quyền' : 'Cấp quyền'}</button></td></tr>)}</tbody></table></div>
        <WorkflowPaging page={page} total={users.data.totalCount} size={25} onPage={setPage} /></>}
      <section className={styles.section}><h3>Lịch sử thay đổi gần đây</h3><div className={styles.history}>
        {history.data?.map(item => <article className={styles.historyItem} key={item.id}><span className={styles.meta}>{formatDateTimeShort(item.createdAt)}</span><p className={styles.text}>{item.details}</p></article>)}
      </div></section>
    </>}
    {selected && <WorkflowDialog title={`${selected.canReceiveDocuments ? 'Thu' : 'Cấp'} quyền: ${selected.fullName}`} onClose={() => setSelected(undefined)} dirty={!!reason || mutation.uncertain} busy={busy}>
      <form className={styles.form} onSubmit={e => { e.preventDefault(); save(); }}><WorkflowError error={mutation.error} />
        {mutation.uncertain && <button type="button" className={styles.secondary} disabled={busy} onClick={mutation.retry}>Kiểm tra yêu cầu đã gửi</button>}
        <label className={styles.field}>Lý do thay đổi<textarea required rows={4} value={reason} onChange={e => setReason(e.target.value)} disabled={busy || mutation.uncertain} /></label>
        <button className={styles.button} type="submit" disabled={busy || mutation.uncertain}>{busy ? 'Đang lưu…' : 'Xác nhận thay đổi quyền'}</button>
      </form>
    </WorkflowDialog>}
  </section>;
}
