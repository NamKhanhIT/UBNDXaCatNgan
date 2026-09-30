'use client';
import { useEffect, useState } from 'react';
import { getTaskDetailApi, type TaskItemDto } from '../../../services/task.service';
import { WorkflowTaskDetail } from '../../workflow/WorkflowTaskDetail';
import { dataOf } from '../../workflow/workflow.service';
/** Compatibility entry point for links that used the former drawer. */
export function TaskDetailDrawer({ task, onClose, onTaskUpdated }: {
  task: TaskItemDto | null; onClose: () => void; onTaskUpdated: (task: TaskItemDto) => void;
}) {
  const [openedId, setOpenedId] = useState<string>();
  useEffect(() => { setOpenedId(task?.id); }, [task?.id]);
  useEffect(() => {
    if (!task) return;
    let active = true;
    const refresh = () => { void getTaskDetailApi(task.id).then(response => { if (active && response.success) onTaskUpdated(dataOf(response)); }); };
    window.addEventListener('workflow:changed', refresh);
    return () => { active = false; window.removeEventListener('workflow:changed', refresh); };
  }, [task?.id, onTaskUpdated]);
  return task ? <WorkflowTaskDetail key={openedId || task.id} taskId={openedId || task.id} onClose={onClose} onOpenTask={setOpenedId} /> : null;
}
