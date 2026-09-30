'use client';
import type { ToggleSubTaskResult } from '../services/inbox.service';
import { WorkflowTaskDetail } from '../features/workflow/WorkflowTaskDetail';
export interface AiChecklistModalProps {
  isOpen: boolean; onClose: () => void; taskItemId: string; taskTitle: string;
  subTasks: { id: string; title: string; isCompleted?: boolean }[];
  onSubTaskToggled?: (result: ToggleSubTaskResult) => void;
}
/** Former AI checklist links open the saved task; no browser-only checklist state. */
export function AiChecklistModal({ isOpen, onClose, taskItemId }: AiChecklistModalProps) {
  return isOpen ? <WorkflowTaskDetail taskId={taskItemId} onClose={onClose} /> : null;
}
