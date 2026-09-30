'use client';

import { useState } from 'react';
import { apiFetch } from '../../services/api.config';
import type { OutgoingDocumentDto } from '../../services/outgoing-document.service';
import { formatDateLong, formatDateTimeShort } from '../../lib/formatters';
import { WorkflowDialog } from './WorkflowDialog';
import { WorkflowError, WorkflowLoading } from './WorkflowFeedback';
import { ProtectedFilePreview } from './ProtectedFilePreview';
import { DocumentEditor } from './DocumentEditor';
import { TaskComposer } from './TaskComposer';
import { InvitationCalendarComposer } from './InvitationCalendarComposer';
import { useRouter } from 'next/navigation';
import { useWorkflowMutation, useWorkflowQuery } from './useWorkflow';
import { dataOf, documentLabels, taskLabel, type DocumentDetail, type DocumentKind, type Person, type WorkflowTask } from './workflow.service';
import styles from './workflow.module.css';

export function WorkflowDocumentDetail({ kind, documentId, onClose, onOpenTask }: {
  kind: DocumentKind; documentId: string; onClose: () => void; onOpenTask: (task: string) => void;
}) {
  const query = useWorkflowQuery<DocumentDetail>(`/api/v1/Documents/${kind}/${documentId}`);
  const detail = query.data;
  const [composing, setComposing] = useState(false);
  const [creatingCalendar, setCreatingCalendar] = useState(false);
  const router = useRouter();
  const [editing, setEditing] = useState<OutgoingDocumentDto>();
  const [mode, setMode] = useState<'present' | 'supplement' | 'archive' | 'reject' | 'recall' | 'cancel' | null>(null);
  const [note, setNote] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [fileBusy, setFileBusy] = useState(false);
  const [fileDirty, setFileDirty] = useState(false);
  const [error, setError] = useState<Error>();
  const mutation = useWorkflowMutation(() => { setMode(null); setNote(''); query.refresh(); });
  const busy = mutation.busy || fileBusy;
  const disabled = busy || mutation.uncertain || fileDirty;
  const people = useWorkflowQuery<Person[]>(mode === 'present' ? '/api/v1/WorkflowPermissions/people?purpose=presentation' : null);
  const action = async () => {
    if (!detail || !mode || busy) return;
    setError(undefined);
    try {
      if (mode === 'reject' || mode === 'recall' || mode === 'cancel') {
        if (!note.trim()) throw new Error('Vui lòng ghi rõ yêu cầu chỉnh sửa.');
        const values = { version: detail.document.version, rejectionReason: mode === 'reject' ? note : undefined, reason: mode === 'reject' ? undefined : note };
        await mutation.run(`/api/v1/OutgoingDocuments/${documentId}/${mode === 'recall' ? 'revoke-issued' : mode}`, values);
      } else {
        const pending = detail.presentations.find(p => p.status === 'Pending');
        const values = mode === 'present' ? { version: detail.document.version, recipientId, note }
          : { version: detail.document.version, presentationId: pending?.id, decision: mode === 'archive' ? 'Archive' : 'Supplement', note };
        await mutation.run(`/api/v1/Documents/${documentId}/${mode === 'present' ? 'presentations' : 'decision'}`, values);
      }
    } catch (issue) { setError(issue as Error); }
  };
  const outgoingAction = async (suffix: string) => {
    if (busy) return;
    setError(undefined);
    try {
      const values = { version: detail?.document.version };
      await mutation.run(`/api/v1/OutgoingDocuments/${documentId}/${suffix}`, values);
    }
    catch (issue) { setError(issue as Error); }
  };
  const edit = async () => {
    try { setEditing(dataOf(await apiFetch<OutgoingDocumentDto>(`/api/v1/OutgoingDocuments/${documentId}`))); }
    catch (issue) { setError(issue as Error); }
  };
  return <WorkflowDialog title={detail?.document.title || 'Chi tiết văn bản'} onClose={onClose} dirty={!!note || fileDirty || mutation.uncertain} busy={busy} wide>
    <WorkflowError error={error || mutation.error || query.error} retry={query.refresh} />
    {mutation.uncertain && <div className={styles.notice}>Chưa xác nhận được kết quả lưu. <button className={styles.secondary} disabled={busy} onClick={mutation.retry}>Kiểm tra yêu cầu đã gửi</button></div>}
    {query.loading && <WorkflowLoading />}
    {detail && <div className={styles.split}>
      <div><ProtectedFilePreview documentId={documentId} kind={kind} canUpload={detail.canUploadFiles && !mutation.busy && !mutation.uncertain}
        onBusyChange={setFileBusy} onDirtyChange={setFileDirty} />{kind === 'Outgoing' && <p className={styles.text}>{detail.summary}</p>}</div>
      <div className={styles.form}>
        <div className={styles.row}><span className={styles.badge + ' ' + styles.blue}>{documentLabels[detail.document.status] || 'Chưa xác định'}</span>
          {detail.document.isUrgent && <span className={styles.badge + ' ' + styles.red}>Khẩn</span>}</div>
        <dl className={styles.facts}><dt>Số / ký hiệu</dt><dd>{detail.document.number || 'Chưa có số'}</dd>
          <dt>{kind === 'Inbox' ? 'Nguồn gửi' : 'Nơi nhận'}</dt><dd>{detail.document.sender || 'Chưa xác định'}</dd>
          <dt>{detail.document.dateLabel}</dt><dd>{formatDateLong(detail.document.date)}</dd>
          <dt>Ngày ban hành</dt><dd>{formatDateLong(detail.issuedDate)}</dd>
          <dt>Đang xử lý</dt><dd>{detail.document.handlerName || 'Chưa có lượt xử lý đang chờ'}</dd></dl>
        {kind === 'Inbox' && detail.summary && <details><summary>Tóm tắt hỗ trợ</summary><p className={styles.text}>{detail.summary}</p></details>}
        {detail.processingNote && <p className={styles.notice}>{detail.processingNote}</p>}
        <fieldset className={styles.row} disabled={disabled}>
          {detail.canCreateCalendar && <button className={styles.secondary} disabled={busy || !!note} onClick={() => setCreatingCalendar(true)}>Tạo lịch từ giấy mời</button>}
          {detail.canPresent && <button className={styles.button} disabled={busy} onClick={() => setMode('present')}>Trình xử lý</button>}
          {detail.canAssign && <button className={styles.button} disabled={busy || !!note} onClick={() => setComposing(true)}>{detail.tasks.length ? 'Giao thêm việc' : 'Giao việc'}</button>}
          {detail.canDecide && <button className={styles.secondary} disabled={busy} onClick={() => setMode('supplement')}>Yêu cầu bổ sung</button>}
          {detail.canArchive && <button className={styles.secondary} disabled={busy} onClick={() => setMode('archive')}>Lưu tra cứu</button>}
          {detail.canEditOutgoing && <button className={styles.secondary} disabled={busy} onClick={edit}>Sửa bản nháp</button>}
          {detail.canRevokeOutgoing && <button className={styles.secondary} disabled={busy} onClick={() => outgoingAction('revoke')}>Thu hồi bản trình ký</button>}
          {detail.canRecallOutgoing && <button className={styles.secondary} disabled={busy} onClick={() => setMode('recall')}>Thu hồi văn bản</button>}
          {detail.canCancelOutgoing && <button className={styles.danger} disabled={busy} onClick={() => setMode('cancel')}>Hủy văn bản</button>}
          {detail.canSubmitSignature && <button className={styles.button} disabled={busy} onClick={() => outgoingAction('submit-for-signature')}>Trình ký</button>}
          {detail.canSign && <><button className={styles.button} disabled={busy} onClick={() => outgoingAction('sign')}>Ký và phát hành</button><button className={styles.secondary} disabled={busy} onClick={() => setMode('reject')}>Yêu cầu sửa bản nháp</button></>}
        </fieldset>
        {mode && <form className={styles.coordination} onSubmit={event => { event.preventDefault(); action(); }}>
          <h3>{({ present: 'Trình xử lý', supplement: 'Yêu cầu bổ sung', archive: 'Lưu để tra cứu', reject: 'Yêu cầu chỉnh sửa', recall: 'Xác nhận thu hồi văn bản', cancel: 'Xác nhận hủy văn bản' })[mode]}</h3>
          {mode === 'present' && <label className={styles.field}>Người nhận trình<select value={recipientId} onChange={e => setRecipientId(e.target.value)} required disabled={busy}>
            <option value="">Chọn người có thẩm quyền</option>{people.data?.map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}
          </select></label>}
          <WorkflowError error={people.error} retry={people.refresh} />
          <label className={styles.field}>Ghi chú / lý do<textarea value={note} onChange={e => setNote(e.target.value)} required={mode !== 'present' && mode !== 'archive'} rows={3} disabled={disabled} /></label>
          <button type="submit" className={styles.button} disabled={disabled}>{busy ? 'Đang lưu…' : 'Xác nhận'}</button>
        </form>}
        <section className={styles.section}><h3>Công việc liên quan ({detail.tasks.length})</h3>
          {detail.tasks.length === 0 && <p className={styles.muted}>Chưa phát sinh công việc từ văn bản này.</p>}
          {detail.tasks.map(task => <div key={task.id} className={styles.queueRow}><div>
            <strong>{task.title}</strong>
            <span className={styles.meta}>{task.assigneeName} · {taskLabel(task)}</span></div>
            <button className={styles.secondary} aria-label={`Mở công việc: ${task.title}`} disabled={!!note || busy} onClick={() => onOpenTask(task.id)}>Mở công việc</button></div>)}
        </section>
        {!!detail.calendarEvents?.length && <section className={styles.section}><h3>Lịch liên quan</h3>
          {detail.calendarEvents.map(event => <p key={event.id}><a className={styles.titleButton} href={`/calendar?eventId=${event.id}`}>{event.title}</a>
            <span className={styles.meta}>{formatDateTimeShort(event.startDateTime)}</span></p>)}
        </section>}
        {!!detail.presentations.length && <section className={styles.section}><h3>Lịch sử trình xử lý</h3><div className={styles.history}>
          {detail.presentations.map(presentation => <article key={presentation.id} className={styles.historyItem}>
            <strong>{presentation.submittedByName || 'Chưa xác định'} → {presentation.recipientName || 'Chưa xác định'}</strong>
            <span className={styles.meta}>{formatDateTimeShort(presentation.createdAt)}</span><p className={styles.text}>{presentation.note}</p>
            <span className={styles.badge}>{({ Pending: 'Chờ xử lý', SupplementRequested: 'Đã yêu cầu bổ sung', Assigned: 'Đã giao việc', Archived: 'Đã lưu tra cứu' } as Record<string, string>)[presentation.status] || 'Lịch sử'}</span>
            {presentation.decisionNote && <p className={styles.text}>{presentation.decisionNote}</p>}{presentation.decidedAt && <span className={styles.meta}>Xử lý: {formatDateTimeShort(presentation.decidedAt)}</span>}
          </article>)}
        </div></section>}
        {!!detail.history?.length && <section className={styles.section}><h3>Lịch sử văn bản</h3><div className={styles.history}>
          {detail.history.map(entry => <article key={entry.id} className={styles.historyItem}><span className={styles.meta}>{formatDateTimeShort(entry.createdAt)}</span><p className={styles.text}>{entry.details}</p></article>)}
        </div></section>}
      </div>
    </div>}
    {detail && composing && <TaskComposer source={detail} onClose={() => setComposing(false)} onCreated={(task: WorkflowTask) => { setComposing(false); onOpenTask(task.id); query.refresh(); }} />}
    {editing && <DocumentEditor kind="Outgoing" existing={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); query.refresh(); }} />}
    {detail && creatingCalendar && <InvitationCalendarComposer source={detail} onClose={() => setCreatingCalendar(false)} onCreated={id => {
      setCreatingCalendar(false); router.push(`/calendar?eventId=${id}`);
    }} />}
  </WorkflowDialog>;
}
