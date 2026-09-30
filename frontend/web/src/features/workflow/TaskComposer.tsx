'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { formatDateShort, vietnamDateTimeToUtc } from '../../lib/formatters';
import { WorkflowDialog } from './WorkflowDialog';
import { WorkflowError, WorkflowLoading } from './WorkflowFeedback';
import { useRequestKey, useWorkflowPermissions, useWorkflowQuery } from './useWorkflow';
import { dataOf, queryString, workflowMutation, WorkflowApiError, type DocumentDetail, type DocumentRow, type Page, type Person, type TaskInput, type WorkflowTask } from './workflow.service';
import { apiFetch } from '../../services/api.config';
import styles from './workflow.module.css';

interface PartInput { key: string; title: string; requirements: string; assigneeId: string; date: string; time: string }

export function TaskComposer({ source, parent, onClose, onCreated }: {
  source?: DocumentDetail; parent?: WorkflowTask; onClose: () => void; onCreated: (task: WorkflowTask) => void;
}) {
  const { user } = useAuth();
  const permissions = useWorkflowPermissions();
  const people = useWorkflowQuery<Person[]>('/api/v1/WorkflowPermissions/people?purpose=assignee');
  const [title, setTitle] = useState(source?.document.title || '');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState(source?.requirements || '');
  const [assigneeId, setAssigneeId] = useState('');
  const [reviewerId, setReviewerId] = useState(user?.userId || '');
  const reviewers = useWorkflowQuery<Person[]>(assigneeId && !parent ? `/api/v1/WorkflowPermissions/people?purpose=reviewer&assigneeId=${assigneeId}` : null);
  const [date, setDate] = useState(source?.suggestedDeadline ? formatDateShort(source.suggestedDeadline) : '');
  const [time, setTime] = useState('17:00');
  const [priority, setPriority] = useState(source?.document.isUrgent ? 'Urgent' : 'Medium');
  const [sourceKey, setSourceKey] = useState(source ? `${source.document.kind}:${source.document.id}` : '');
  const [documentSearch, setDocumentSearch] = useState('');
  const availableDocuments = useWorkflowQuery<Page<DocumentRow>>(!source && !parent
    ? `/api/v1/Documents?${queryString({ scope: 'accessible', search: documentSearch, pageSize: 50 })}` : null);
  const [sourceKind, sourceId] = sourceKey.split(':');
  const selectedSource = useWorkflowQuery<DocumentDetail>(sourceId ? `/api/v1/Documents/${sourceKind}/${sourceId}` : null);
  const [parts, setParts] = useState<PartInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<Error>();
  const [dirty, setDirty] = useState(false);
  const frozen = useRef<(TaskInput & { requestId: string }) | null>(null);
  const requestKey = useRequestKey();

  useEffect(() => {
    const document = selectedSource.data;
    if (!document) return;
    setTitle(value => value || document.document.title);
    setRequirements(value => value || document.requirements || '');
    if (document.suggestedDeadline) setDate(value => value || formatDateShort(document.suggestedDeadline));
  }, [selectedSource.data]);

  const updatePart = (key: string, change: Partial<PartInput>) => {
    setParts(current => current.map(part => part.key === key ? { ...part, ...change } : part));
    setDirty(true);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(undefined);
    try {
      let payload = frozen.current;
      if (!uncertain || !payload) {
        const deadline = vietnamDateTimeToUtc(date, time);
        if (!deadline) throw new Error('Nhập hạn hợp lệ theo DD-MM-YYYY và HH:mm.');
        if (!assigneeId || !people.data?.some(person => person.id === assigneeId)) throw new Error('Vui lòng chọn người thực hiện đủ thẩm quyền.');
        if (!parent && !reviewers.data?.some(person => person.id === reviewerId)) throw new Error('Vui lòng chọn người nghiệm thu phù hợp.');
        if (sourceId && (!selectedSource.data || !selectedSource.data.canAssign)) throw new Error('Văn bản chưa sẵn sàng hoặc bạn không có quyền giao việc từ văn bản này.');
        const data: TaskInput = {
          title: title.trim(), description: description.trim(), requirements: requirements.trim(), assigneeId,
          reviewerId: parent?.assigneeId || reviewerId, dueDate: deadline, priority,
          documents: selectedSource.data ? [{ id: sourceId, kind: selectedSource.data.document.kind, version: selectedSource.data.document.version }] : [],
          coordinationTasks: parts.map(part => {
            const dueDate = vietnamDateTimeToUtc(part.date, part.time);
            if (!dueDate) throw new Error('Mỗi phần phối hợp cần có hạn hợp lệ.');
            if (!part.assigneeId || part.assigneeId === assigneeId) throw new Error('Người phối hợp phải khác người chủ trì.');
            return { title: part.title.trim(), requirements: part.requirements.trim(), assigneeId: part.assigneeId, dueDate };
          }),
          parentTaskId: parent?.id, parentVersion: parent?.version,
        };
        payload = { ...data, requestId: requestKey(data) };
        frozen.current = payload;
      }
      setBusy(true);
      const created = await workflowMutation<WorkflowTask>('/api/v1/Tasks', payload);
      if (!created) throw new WorkflowApiError('Chưa nhận được chi tiết công việc. Hãy thử lại để kiểm tra yêu cầu đã gửi.', 0);
      setDirty(false); frozen.current = null; onCreated(created);
    } catch (problem) {
      const issue = problem instanceof Error ? problem : new Error('Không thể giao việc.');
      setError(issue);
      setUncertain(issue instanceof WorkflowApiError && issue.status === 0);
    } finally { setBusy(false); }
  };

  return <WorkflowDialog title={parent ? 'Giao phần việc phối hợp' : 'Giao công việc'} onClose={onClose} dirty={dirty || uncertain} busy={busy}>
    <form className={styles.form} onSubmit={submit} onChange={() => setDirty(true)}>
      <WorkflowError error={error || permissions.error || people.error || reviewers.error || selectedSource.error} />
      {permissions.loading && <WorkflowLoading />}
      {uncertain && <div className={styles.notice}>Chưa xác nhận được kết quả lưu. Các thông tin đã gửi được giữ nguyên; bấm “Kiểm tra và gửi lại” để tránh tạo trùng.</div>}
      {parent && <div className={styles.notice}>Công việc tổng: <strong>{parent.title}</strong><br />Người nhận kết quả phối hợp: {parent.assigneeName}</div>}
      <fieldset disabled={busy || uncertain || !permissions.data?.canAssign}>
        {!parent && <section className={styles.form}>
          {source ? <div className={styles.notice}>Văn bản nguồn: <strong>{source.document.title}</strong></div>
            : <>
              <label className={styles.field}>Tìm văn bản nguồn (không bắt buộc)<input value={documentSearch} onChange={e => setDocumentSearch(e.target.value)} placeholder="Trích yếu hoặc số văn bản" /></label>
              <label className={styles.field}>Văn bản liên quan<select value={sourceKey} onChange={e => setSourceKey(e.target.value)}>
                <option value="">Công việc độc lập</option>
                {availableDocuments.data?.items.map(document => <option key={`${document.kind}:${document.id}`} value={`${document.kind}:${document.id}`}>{document.number || 'Chưa có số'} · {document.title}</option>)}
              </select></label>
              <WorkflowError error={availableDocuments.error} retry={availableDocuments.refresh} />
            </>}
        </section>}
        <label className={styles.field}>Tên công việc<input value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} /></label>
        <label className={styles.field}>Chỉ đạo thực hiện<textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Nội dung cần triển khai, phạm vi và lưu ý" /></label>
        <label className={styles.field}>Yêu cầu kết quả<textarea value={requirements} onChange={e => setRequirements(e.target.value)} required rows={3} placeholder="Cần nộp sản phẩm gì và đáp ứng yêu cầu nào?" /></label>
        <div className={styles.columns}>
          <label className={styles.field}>Người chịu trách nhiệm chính<select value={assigneeId} onChange={e => { setAssigneeId(e.target.value); setReviewerId(user?.userId || ''); }} required>
            <option value="">Chọn cán bộ</option>{people.data?.filter(person => person.id !== parent?.assigneeId).map(person => <option key={person.id} value={person.id}>{person.fullName}{person.departmentName ? ` · ${person.departmentName}` : ''}</option>)}
          </select></label>
          {!parent && <label className={styles.field}>Người nghiệm thu<select value={reviewerId} onChange={e => setReviewerId(e.target.value)} required disabled={!assigneeId || reviewers.loading}>
            <option value="">Chọn người nghiệm thu</option>{reviewers.data?.map(person => <option key={person.id} value={person.id}>{person.fullName}{person.id === user?.userId ? ' (người giao)' : ''}</option>)}
          </select></label>}
        </div>
        <div className={styles.columns}>
          <label className={styles.field}>Ngày hết hạn<input value={date} onChange={e => setDate(e.target.value)} placeholder="DD-MM-YYYY" inputMode="numeric" required pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}" /></label>
          <label className={styles.field}>Giờ hết hạn (Việt Nam)<input type="time" value={time} onChange={e => setTime(e.target.value)} required /><small>Giờ gợi ý 17:00. Kiểm tra lại văn bản trước khi giao.</small></label>
        </div>
        <label className={styles.field}>Mức ưu tiên<select value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="Low">Thấp</option><option value="Medium">Bình thường</option><option value="High">Cao</option><option value="Urgent">Khẩn</option>
        </select></label>
        {!parent && <section className={styles.section}>
          <h3>Phần việc phối hợp</h3><p className={styles.muted}>Thêm khi cần một sản phẩm tổng hợp. Chủ trì sẽ nhận từng phần trước khi nộp kết quả cuối cùng.</p>
          <div className={styles.form}>{parts.map((part, index) => <section key={part.key} className={styles.coordination}>
            <div className={styles.heading}><strong>Phần việc {index + 1}</strong><button type="button" className={styles.secondary} onClick={() => { setParts(current => current.filter(p => p.key !== part.key)); setDirty(true); }}>Bỏ phần này</button></div>
            <label className={styles.field}>Tên phần việc<input required maxLength={200} value={part.title} onChange={e => updatePart(part.key, { title: e.target.value })} /></label>
            <label className={styles.field}>Kết quả cần nộp<textarea required rows={2} value={part.requirements} onChange={e => updatePart(part.key, { requirements: e.target.value })} /></label>
            <label className={styles.field}>Người phối hợp<select required value={part.assigneeId} onChange={e => updatePart(part.key, { assigneeId: e.target.value })}>
              <option value="">Chọn cán bộ</option>{people.data?.filter(p => p.id !== assigneeId).map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select></label>
            <div className={styles.columns}><label className={styles.field}>Ngày hạn<input required value={part.date} placeholder="DD-MM-YYYY" onChange={e => updatePart(part.key, { date: e.target.value })} /></label>
              <label className={styles.field}>Giờ hạn<input required type="time" value={part.time} onChange={e => updatePart(part.key, { time: e.target.value })} /></label></div>
          </section>)}</div>
          <button type="button" className={styles.secondary} onClick={() => { setParts(current => [...current, { key: crypto.randomUUID(), title: '', requirements: '', assigneeId: '', date, time }]); setDirty(true); }}>Thêm phần phối hợp</button>
        </section>}
      </fieldset>
      <div className={styles.actions}>
        {error instanceof WorkflowApiError && error.status === 409 && sourceId && <button type="button" className={styles.secondary} onClick={async () => {
          try { dataOf(await apiFetch<DocumentDetail>(`/api/v1/Documents/${sourceKind}/${sourceId}`)); selectedSource.refresh(); setError(undefined); } catch (e) { setError(e as Error); }
        }}>Cập nhật văn bản nguồn</button>}
        <button className={styles.button} type="submit" disabled={busy || !permissions.data?.canAssign}>{busy ? 'Đang lưu…' : uncertain ? 'Kiểm tra và gửi lại' : 'Xác nhận giao việc'}</button>
      </div>
    </form>
  </WorkflowDialog>;
}
