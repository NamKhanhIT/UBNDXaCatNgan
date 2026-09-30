'use client';

import { useEffect, useState } from 'react';
import { useWorkflowMutation } from './useWorkflow';
import { WorkflowError } from './WorkflowFeedback';
import styles from './workflow.module.css';

export function TaskCommentForm({ taskId, onSaved, onDirtyChange, onBusyChange }: {
  taskId: string; onSaved: () => void; onDirtyChange: (value: boolean) => void; onBusyChange: (value: boolean) => void;
}) {
  const [content, setContent] = useState('');
  const mutation = useWorkflowMutation(() => { setContent(''); onSaved(); });
  useEffect(() => { onDirtyChange(!!content || mutation.uncertain); }, [content, mutation.uncertain, onDirtyChange]);
  useEffect(() => { onBusyChange(mutation.busy); }, [mutation.busy, onBusyChange]);
  return <section className={styles.section}>
    <h3>Trao đổi về công việc</h3>
    <WorkflowError error={mutation.error} retry={onSaved} />
    {mutation.uncertain && <button className={styles.secondary} disabled={mutation.busy} onClick={mutation.retry}>Kiểm tra nội dung đã gửi</button>}
    <form onSubmit={event => { event.preventDefault(); void mutation.run(`/api/v1/Tasks/${taskId}/comments`, { content }); }}>
      <fieldset disabled={mutation.busy || mutation.uncertain} className={styles.form}>
        <label className={styles.field}>Nội dung<textarea rows={3} value={content} onChange={event => setContent(event.target.value)} required /></label>
        <p className={styles.muted}>Nhắc @tênđăngnhập hoặc @all chỉ thông báo cho người có quyền xem công việc.</p>
        <button type="submit" className={styles.secondary}>Gửi trao đổi</button>
      </fieldset>
    </form>
  </section>;
}
