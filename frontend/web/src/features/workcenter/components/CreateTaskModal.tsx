'use client';
import type { TaskItemDto } from '../../../services/task.service';
import { TaskComposer } from '../../workflow/TaskComposer';
/** Compatibility entry point: every task form uses the canonical composer. */
export function CreateTaskModal({ isOpen, onClose, onTaskCreated }: {
  isOpen: boolean; onClose: () => void; onTaskCreated: (task: TaskItemDto) => void;
}) {
  return isOpen ? <TaskComposer onClose={onClose} onCreated={onTaskCreated} /> : null;
}
