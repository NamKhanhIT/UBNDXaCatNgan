'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useWorkflowMutation } from './useWorkflow';
import { WorkflowError } from './WorkflowFeedback';
import type { WorkflowTask } from './workflow.service';
import styles from './workflow.module.css';

export function TaskChecklist({ task, onSaved, onDirtyChange, onBusyChange }: {
  task: WorkflowTask; onSaved: () => void; onDirtyChange: (value: boolean) => void; onBusyChange: (value: boolean) => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const adding = useRef(false);
  const mutation = useWorkflowMutation(() => { if (adding.current) setTitle(''); adding.current = false; onSaved(); });
  const writable = task.assigneeId === user?.userId && ['Todo', 'InProgress'].includes(task.status);
  useEffect(() => { onDirtyChange(!!title || mutation.uncertain); }, [title, mutation.uncertain, onDirtyChange]);
  useEffect(() => { onBusyChange(mutation.busy); }, [mutation.busy, onBusyChange]);
  if (!writable && !task.subTasks.length) return null;
  return <section className={styles.section}>
    <h3>Checklist theo dõi</h3>
    <p className={styles.muted}>Đánh dấu checklist để theo dõi tiến độ; kết quả công việc vẫn cần được nộp và nghiệm thu.</p>
    <WorkflowError error={mutation.error} retry={onSaved} />
    {mutation.uncertain && <button className={styles.secondary} disabled={mutation.busy} onClick={mutation.retry}>Kiểm tra thao tác checklist đã gửi</button>}
    <fieldset disabled={!writable || mutation.busy || mutation.uncertain} className={styles.form}>
      {task.subTasks.map(item => <label className={styles.row} key={item.id}>
        <input type="checkbox" checked={item.isCompleted} onChange={event => { adding.current = false; return mutation.run(`/api/v1/Tasks/${task.id}/subtasks/${item.id}/toggle`,
          { version: task.version, isCompleted: event.target.checked }, 'PATCH'); }} />{item.title}
      </label>)}
      {writable && <form className={styles.row} onSubmit={event => { event.preventDefault(); adding.current = true; void mutation.run(`/api/v1/Tasks/${task.id}/subtasks`, { title, version: task.version }); }}>
        <label className={styles.field}>Thêm mục checklist<input value={title} onChange={event => setTitle(event.target.value)} required /></label>
        <button type="submit" className={styles.secondary}>Thêm mục</button>
      </form>}
    </fieldset>
  </section>;
}
