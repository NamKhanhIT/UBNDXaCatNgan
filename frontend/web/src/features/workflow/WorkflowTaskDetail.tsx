'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { formatDateShort, formatDateTimeShort, formatTimeShort, vietnamDateTimeToUtc } from '../../lib/formatters';
import { uploadFileApi } from '../../services/files.service';
import { WorkflowDialog } from './WorkflowDialog';
import { WorkflowError, WorkflowLoading } from './WorkflowFeedback';
import { downloadProtectedFile } from './ProtectedFilePreview';
import { TaskComposer } from './TaskComposer';
import { TaskChecklist } from './TaskChecklist';
import { TaskCommentForm } from './TaskCommentForm';
import { useRequestKey, useWorkflowMutation, useWorkflowQuery } from './useWorkflow';
import { dataOf, isOverdue, taskLabel, workflowMutation, WorkflowApiError, type Person, type WorkflowTask } from './workflow.service';
import styles from './workflow.module.css';

export function WorkflowTaskDetail({ taskId, onClose, onOpenTask }: { taskId: string; onClose: () => void; onOpenTask?: (id: string) => void }) {
  const { user } = useAuth();
  const query = useWorkflowQuery<WorkflowTask>(`/api/v1/Tasks/${taskId}`);
  const task = query.data;
  const [note, setNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error>();
  const [uncertain, setUncertain] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [amending, setAmending] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [coordinating, setCoordinating] = useState(false);
  const [checklistDirty, setChecklistDirty] = useState(false);
  const [checklistBusy, setChecklistBusy] = useState(false);
  const [commentDirty, setCommentDirty] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const uploaded = useRef(new Map<File, string>());
  const frozen = useRef<{ path: string; payload: object }>();
  const requestKey = useRequestKey();
  const dirty = !!(note || reviewNote || files.length || uncertain || checklistDirty || commentDirty);
  useEffect(() => { setNote(''); setReviewNote(''); setFiles([]); setCancel(false); setError(undefined); setUncertain(false); uploaded.current.clear(); frozen.current = undefined; }, [taskId]);

  const perform = async (status: string, submissionId?: string) => {
    if (busy || !task) return;
    setError(undefined); setBusy(true);
    try {
      let operation = uncertain ? frozen.current : undefined;
      if (!operation) {
        if ((status === 'Cancelled' || (status === 'InProgress' && task.status === 'InReview')) && !reviewNote.trim()) throw new Error('Vui lòng ghi rõ lý do hoặc yêu cầu chỉnh sửa.');
        if (status === 'InReview' && !note.trim()) throw new Error('Vui lòng nhập nội dung kết quả.');
        const attachmentIds: string[] = [];
        if (status === 'InReview') {
          for (const file of files) {
            let id = uploaded.current.get(file);
            if (!id) { id = dataOf(await uploadFileApi(file, task.id, 'Task', 'Result')); uploaded.current.set(file, id); }
            attachmentIds.push(id);
          }
        }
        const values = { version: task.version, status, submissionId, attachmentIds,
          submissionNote: status === 'InReview' ? note.trim() : undefined,
          approvalNote: status === 'Completed' ? reviewNote.trim() : undefined,
          rejectionReason: status === 'Cancelled' || (status === 'InProgress' && task.status === 'InReview') ? reviewNote.trim() : undefined };
        operation = { path: `/api/v1/Tasks/${task.id}/status`, payload: { ...values, requestId: requestKey(values) } };
        frozen.current = operation;
      }
      await workflowMutation<WorkflowTask>(operation.path, operation.payload, 'PATCH');
      setNote(''); setReviewNote(''); setFiles([]); uploaded.current.clear(); frozen.current = undefined;
      setCancel(false); setUncertain(false); query.refresh();
    } catch (issue) {
      setError(issue as Error);
      setUncertain(issue instanceof WorkflowApiError && issue.status === 0 && !!frozen.current);
    } finally { setBusy(false); }
  };
  const pendingSubmission = task?.submissions.find(submission => submission.decision === 'Pending');
  return <WorkflowDialog title={task?.title || 'Chi tiết công việc'} onClose={onClose} dirty={dirty} busy={busy || checklistBusy || commentBusy} wide>
    <div className={styles.form}>
      <WorkflowError error={query.error || error} retry={query.refresh} />
      {query.loading && <WorkflowLoading />}
      {uncertain && <div className={styles.notice}>Chưa xác nhận được kết quả lưu. <button type="button" className={styles.secondary} disabled={busy} onClick={() => perform('')}>Kiểm tra yêu cầu đã gửi</button></div>}
      {task && <>
        <div className={styles.row}><span className={styles.badge + ' ' + (task.status === 'Completed' ? styles.green : styles.blue)}>{taskLabel(task)}</span>
          {isOverdue(task) && <span className={styles.badge + ' ' + styles.red}>Quá hạn</span>}
          {task.parentTaskId && <span className={styles.badge}>Phần việc phối hợp</span>}</div>
        <dl className={styles.facts}>
          <dt>Người thực hiện</dt><dd>{task.assigneeName}</dd><dt>Người giao</dt><dd>{task.assignerName}</dd>
          <dt>Người nghiệm thu</dt><dd>{task.reviewerName || 'Cần bổ sung'}</dd><dt>Hạn xử lý</dt><dd>{formatDateTimeShort(task.dueDate)}</dd>
        </dl>
        <section className={styles.section}><h3>Chỉ đạo và yêu cầu kết quả</h3>
          {task.description && <p className={styles.text}>{task.description}</p>}<p className={styles.text}>{task.requirements || 'Chưa có yêu cầu kết quả. Người giao cần bổ sung.'}</p></section>
        {!!task.documents.length && <section className={styles.section}><h3>Văn bản nguồn</h3><div className={styles.fileList}>
          {task.documents.map(document => <a key={`${document.kind}:${document.id}`} className={`${styles.secondary} ${styles.sourceLink}`} target="_blank" rel="noopener noreferrer"
            href={`/documents?kind=${document.kind}&documentId=${document.id}`}>{document.number || 'Chưa có số'} · {document.title}</a>)}
        </div></section>}
        {task.canStart && <button className={styles.button} type="button" disabled={busy || uncertain} onClick={() => perform('InProgress')}>Bắt đầu thực hiện</button>}
        {task.assigneeId === user?.userId && task.status === 'InProgress' && <section className={styles.section}>
          <h3>Nộp kết quả</h3>{task.submissionBlockedReason && <p className={styles.notice}>{task.submissionBlockedReason}</p>}
          {task.rejectionReason && <p className={styles.error}>Yêu cầu đang chờ sửa: {task.rejectionReason}</p>}
          <form className={styles.form} onSubmit={event => { event.preventDefault(); perform('InReview'); }}>
            <fieldset disabled={busy || uncertain}>
              <label className={styles.field}>Nội dung kết quả<textarea value={note} onChange={event => setNote(event.target.value)} rows={5} required /></label>
              <label className={styles.field}>Tệp kết quả<input type="file" multiple onChange={event => setFiles(Array.from(event.target.files || []))} /></label>
              {!!files.length && <div className={styles.fileList}>{files.map((file, index) => <span key={index}>{file.name}{uploaded.current.has(file) ? ' · Đã tải lên' : ''}</span>)}</div>}
            </fieldset>
            <div className={styles.actions}><button type="submit" className={styles.button} disabled={busy || uncertain || !task.canSubmit}>{busy ? 'Đang lưu…' : task.rejectionReason ? 'Nộp lại kết quả' : 'Nộp để nghiệm thu'}</button></div>
          </form>
        </section>}
        {(task.canAccept || task.canReturn) && pendingSubmission && <section className={styles.section}>
          <h3>Nghiệm thu lần nộp đang chờ</h3>
          <label className={styles.field}>Nhận xét hoặc yêu cầu chỉnh sửa<textarea value={reviewNote} onChange={event => setReviewNote(event.target.value)} rows={3} disabled={busy || uncertain} /></label>
          <div className={styles.actions}>
            {task.canReturn && <button type="button" className={styles.secondary} disabled={busy || uncertain} onClick={() => perform('InProgress', pendingSubmission.id)}>Yêu cầu chỉnh sửa</button>}
            {task.canAccept && <button type="button" className={styles.button} disabled={busy || uncertain} onClick={() => perform('Completed', pendingSubmission.id)}>Xác nhận nghiệm thu</button>}
          </div>
        </section>}
        {(task.coordinationTasks.length > 0 || task.canAddCoordination) && <section className={styles.section}>
          <div className={styles.heading}><h3>Phần việc phối hợp</h3>{task.canAddCoordination && <button type="button" className={styles.secondary} disabled={dirty || busy} onClick={() => setCoordinating(true)}>Giao phần phối hợp</button>}</div>
          <div className={styles.history}>{task.coordinationTasks.map(part => <div className={styles.queueRow} key={part.id}>
            <div><button className={styles.titleButton} disabled={dirty || busy} onClick={() => onOpenTask?.(part.id)}>{part.title}</button>
              <span className={styles.meta}>{part.assigneeName} · Hạn {formatDateShort(part.dueDate)}</span></div><span className={styles.badge}>{taskLabel(part)}</span>
          </div>)}</div>
        </section>}
        <section className={styles.section}><h3>Các lần nộp kết quả</h3>
          {task.submissions.length === 0 && <p className={styles.muted}>Chưa có lần nộp kết quả.</p>}
          <div className={styles.history}>{task.submissions.map((submission, index) => <article className={styles.submission} key={submission.id}>
            <div className={styles.heading}><h4>{submission.isLegacy ? 'Bằng chứng từ dữ liệu cũ' : `Lần nộp ${task.submissions.slice(index).filter(s => !s.isLegacy).length}`}</h4>
              <span className={styles.badge}>{({ Pending: 'Chờ nghiệm thu', Accepted: 'Đã nghiệm thu', Returned: 'Đã hoàn trả', Historical: 'Lịch sử', Cancelled: 'Đã hủy' } as Record<string, string>)[submission.decision] || submission.decision}</span></div>
            <p className={styles.meta}>Nộp lúc {formatDateTimeShort(submission.submittedAt)} · Hạn tại lúc nộp: {formatDateTimeShort(submission.dueDateAtSubmission)}</p>
            {submission.wasLate !== null && submission.wasLate !== undefined && <span className={styles.badge + ' ' + (submission.wasLate ? styles.red : styles.green)}>{submission.wasLate ? 'Nộp trễ hạn' : 'Nộp trong hạn'}</span>}
            <p className={styles.text}>{submission.note || 'Nội dung lần nộp chưa được lưu trong dữ liệu cũ.'}</p>
            <div className={styles.fileList}>{submission.files.map(file => <button key={file.id} type="button" className={styles.secondary} onClick={() => downloadProtectedFile(file.id, file.name).catch(setError)}>{file.name}</button>)}</div>
            {submission.reviewNote && <p className={styles.text}>Nhận xét của lượt xử lý này: {submission.reviewNote}</p>}
            {submission.reviewedAt && <p className={styles.meta}>Xử lý lúc {formatDateTimeShort(submission.reviewedAt)}</p>}
          </article>)}</div>
        </section>
        {task.attachments.some(file => !task.submissions.some(submission => submission.files.some(saved => saved.id === file.id))) && <section className={styles.section}>
          <h3>Tài liệu và tệp đã lưu</h3>
          <p className={styles.muted}>Các tệp này chưa được xác định thuộc lần nộp nào.</p>
          <div className={styles.fileList}>{task.attachments.filter(file => !task.submissions.some(submission => submission.files.some(saved => saved.id === file.id))).map(file =>
            <button key={file.id} type="button" className={styles.secondary} onClick={() => downloadProtectedFile(file.id, file.originalFileName).catch(setError)}>{file.originalFileName}</button>)}</div>
        </section>}
        {!!task.comments.length && <section className={styles.section}><h3>Trao đổi đã lưu</h3><div className={styles.history}>
          {task.comments.map(comment => <article key={comment.id} className={styles.historyItem}>
            <strong>{comment.userFullName || 'Chưa xác định'}</strong><span className={styles.meta}>{formatDateTimeShort(comment.createdAt)}</span>
            <p className={styles.text}>{comment.content}</p>
          </article>)}
        </div></section>}
        <TaskChecklist key={task.id} task={task} onSaved={query.refresh} onDirtyChange={setChecklistDirty} onBusyChange={setChecklistBusy} />
        <TaskCommentForm key={`comments:${task.id}`} taskId={task.id} onSaved={query.refresh} onDirtyChange={setCommentDirty} onBusyChange={setCommentBusy} />
        <section className={styles.section}><h3>Lịch sử xử lý</h3><div className={styles.history}>
          {task.timeline.map(entry => <div className={styles.historyItem} key={entry.id}><span className={styles.meta}>{formatDateTimeShort(entry.createdAt)} · {entry.userFullName}</span><p className={styles.text}>{entry.summary}</p></div>)}
          {task.changes.filter(change => change.kind === 'LegacyRejection' || change.kind === 'LegacyMigration').map(change => <div className={styles.historyItem} key={change.id}>
            <span className={styles.meta}>{change.kind === 'LegacyRejection' ? 'Ghi chú được bảo toàn từ dữ liệu cũ' : 'Chuyển đổi quy trình'} · {formatDateTimeShort(change.createdAt)}</span>
            <p className={styles.text}>{change.reason}</p>
          </div>)}
          {task.changes.filter(change => change.kind === 'DeadlineChanged').map(change => <div className={styles.historyItem} key={change.id}>
            <span className={styles.meta}>{formatDateTimeShort(change.createdAt)}</span><p>Đổi hạn từ {formatDateTimeShort(change.oldValue)} sang {formatDateTimeShort(change.newValue)}</p><p className={styles.text}>{change.reason}</p>
          </div>)}
        </div></section>
        {(task.canAmend || task.canCancel) && <section className={styles.actions}>
          {task.canAmend && (task.status === 'Todo' || task.status === 'InProgress') && <button type="button" className={styles.secondary} disabled={dirty || busy} onClick={() => setTransferring(true)}>Điều chuyển người thực hiện</button>}
          {task.canAmend && <button type="button" className={styles.secondary} disabled={dirty || busy} onClick={() => setAmending(true)}>Điều chỉnh hạn / nghiệm thu</button>}
          {task.canCancel && <button type="button" className={styles.danger} disabled={busy || uncertain} onClick={() => setCancel(value => !value)}>Hủy công việc</button>}
        </section>}
        {cancel && <section className={styles.form}>
          <p className={styles.notice}>Các phần phối hợp còn mở sẽ được hủy cùng công việc tổng. Lịch sử và kết quả đã có được giữ lại.</p>
          <label className={styles.field}>Lý do hủy<textarea required value={reviewNote} onChange={e => setReviewNote(e.target.value)} disabled={busy || uncertain} /></label>
          <button type="button" className={styles.danger} disabled={busy || uncertain} onClick={() => perform('Cancelled')}>Xác nhận hủy có lý do</button>
        </section>}
      </>}
    </div>
    {task && amending && <TaskAmendmentDialog task={task} onClose={() => setAmending(false)} onSaved={() => { setAmending(false); query.refresh(); }} />}
    {task && transferring && <TaskTransferDialog task={task} onClose={() => setTransferring(false)} onSaved={() => { setTransferring(false); query.refresh(); }} />}
    {task && coordinating && <TaskComposer parent={task} onClose={() => setCoordinating(false)} onCreated={created => { setCoordinating(false); query.refresh(); onOpenTask?.(created.id); }} />}
  </WorkflowDialog>;
}

function TaskTransferDialog({ task, onClose, onSaved }: { task: WorkflowTask; onClose: () => void; onSaved: () => void }) {
  const [targetUserId, setTargetUserId] = useState('');
  const [reviewerId, setReviewerId] = useState(task.reviewerId || '');
  const [reason, setReason] = useState('');
  const mutation = useWorkflowMutation(onSaved);
  const busy = mutation.busy;
  const people = useWorkflowQuery<Person[]>('/api/v1/WorkflowPermissions/people?purpose=assignee');
  const reviewers = useWorkflowQuery<Person[]>(targetUserId && !task.parentTaskId ? `/api/v1/WorkflowPermissions/people?purpose=reviewer&assigneeId=${targetUserId}` : null);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    const values = { version: task.version, targetUserId, reviewerId: task.parentTaskId ? undefined : reviewerId, reason };
    await mutation.run(`/api/v1/Tasks/${task.id}/transfer`, values);
  };
  return <WorkflowDialog title="Điều chuyển công việc" onClose={onClose} dirty={!!targetUserId || !!reason || mutation.uncertain} busy={busy}>
    <form className={styles.form} onSubmit={save}>
      <p className={styles.notice}>Người mới tiếp nhận ở trạng thái chưa bắt đầu. Kết quả và lịch sử đã có được giữ lại.</p>
      <WorkflowError error={mutation.error || people.error || reviewers.error} />
      {mutation.uncertain && <button type="button" className={styles.secondary} disabled={busy} onClick={mutation.retry}>Kiểm tra điều chuyển đã gửi</button>}
      <fieldset disabled={busy || mutation.uncertain}>
        <label className={styles.field}>Người thực hiện mới<select required value={targetUserId} onChange={e => setTargetUserId(e.target.value)}>
          <option value="">Chọn người nhận</option>{people.data?.filter(person => person.id !== task.assigneeId).map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}
        </select></label>
        {!task.parentTaskId && <label className={styles.field}>Người nghiệm thu<select required value={reviewerId} onChange={e => setReviewerId(e.target.value)}>
          <option value="">Chọn người nghiệm thu</option>{reviewers.data?.map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}
        </select></label>}
        <label className={styles.field}>Lý do<textarea required value={reason} onChange={e => setReason(e.target.value)} rows={3} /></label>
      </fieldset>
      <button className={styles.button} disabled={busy || mutation.uncertain || !targetUserId || reviewers.loading}>{busy ? 'Đang lưu…' : 'Xác nhận điều chuyển'}</button>
    </form>
  </WorkflowDialog>;
}

function TaskAmendmentDialog({ task, onClose, onSaved }: { task: WorkflowTask; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(task.dueDate ? formatDateShort(task.dueDate) : '');
  const [time, setTime] = useState(task.dueDate ? formatTimeShort(task.dueDate) : '17:00');
  const [reviewerId, setReviewerId] = useState(task.reviewerId || '');
  const [requirements, setRequirements] = useState(task.requirements || '');
  const [reason, setReason] = useState('');
  const mutation = useWorkflowMutation(onSaved);
  const busy = mutation.busy;
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<Error>();
  const people = useWorkflowQuery<Person[]>(!task.parentTaskId ? `/api/v1/WorkflowPermissions/people?purpose=reviewer&assigneeId=${task.assigneeId}` : null);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    try {
      const dueDate = vietnamDateTimeToUtc(date, time);
      if (!dueDate) throw new Error('Vui lòng xác nhận hạn hợp lệ.');
      const values = { version: task.version, dueDate, reviewerId: task.parentTaskId ? undefined : reviewerId, requirements, reason };
      setError(undefined);
      await mutation.run(`/api/v1/Tasks/${task.id}/details`, values, 'PATCH');
    } catch (issue) { setError(issue as Error); }
  };
  return <WorkflowDialog title="Điều chỉnh công việc" onClose={onClose} dirty={dirty || mutation.uncertain} busy={busy}>
    <form className={styles.form} onSubmit={save} onChange={() => setDirty(true)}>
      <WorkflowError error={error || mutation.error || people.error} />
      {mutation.uncertain && <button type="button" className={styles.secondary} disabled={busy} onClick={mutation.retry}>Kiểm tra điều chỉnh đã gửi</button>}
      <fieldset disabled={busy || mutation.uncertain}>
        <label className={styles.field}>Yêu cầu kết quả<textarea required value={requirements} onChange={e => setRequirements(e.target.value)} rows={3} /></label>
        <div className={styles.columns}><label className={styles.field}>Ngày hạn<input required value={date} placeholder="DD-MM-YYYY" onChange={e => setDate(e.target.value)} /></label>
          <label className={styles.field}>Giờ hạn (Việt Nam)<input required type="time" value={time} onChange={e => setTime(e.target.value)} /></label></div>
        {!task.parentTaskId && <label className={styles.field}>Người nghiệm thu<select required value={reviewerId} onChange={e => setReviewerId(e.target.value)}><option value="">Chọn người nghiệm thu</option>{people.data?.map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}</select></label>}
        <label className={styles.field}>Lý do điều chỉnh<textarea required value={reason} onChange={e => setReason(e.target.value)} rows={3} /></label>
      </fieldset>
      <div className={styles.actions}><button className={styles.button} disabled={busy || mutation.uncertain} type="submit">{busy ? 'Đang lưu…' : 'Lưu điều chỉnh'}</button></div>
    </form>
  </WorkflowDialog>;
}
