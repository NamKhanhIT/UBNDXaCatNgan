import { apiFetch, type ApiResponse } from '../../services/api.config';
import type { TaskDetailDto, TaskItemDto } from '../../services/task.service';

export type DocumentKind = 'Inbox' | 'Outgoing';
export interface DocumentRow {
  id: string; kind: DocumentKind; title: string; number: string; sender: string; status: string;
  date: string; dateLabel: string; isUrgent: boolean; handlerId?: string; handlerName?: string;
  taskCount: number; version?: string;
}
export interface Presentation {
  id: string; submittedById: string; recipientId: string; submittedByName?: string; recipientName?: string;
  note: string; status: string; decisionNote?: string; createdAt: string; decidedAt?: string;
}
export interface DocumentDetail {
  document: DocumentRow; summary?: string; requirements?: string; suggestedDeadline?: string; issuedDate?: string;
  tasks: TaskItemDto[]; presentations: Presentation[];
  canAssign: boolean; canPresent: boolean; canDecide: boolean; canArchive: boolean; canUploadFiles: boolean;
  canEditOutgoing: boolean; canSubmitSignature: boolean; canSign: boolean;
  canRevokeOutgoing: boolean; canRecallOutgoing: boolean; canCancelOutgoing: boolean; processingNote?: string;
  history: Array<{ id: string; details: string; createdAt: string }>;
  canCreateCalendar: boolean; suggestedEventStart?: string; suggestedEventEnd?: string;
  calendarEvents: Array<{ id: string; title: string; startDateTime: string }>;
}
export interface WorkflowPermissions {
  canAssign: boolean; canReceiveDocuments: boolean; canManageWorkflowPermissions: boolean;
  canViewDepartment: boolean; canViewOrganization: boolean;
}
export interface Person { id: string; fullName: string; departmentId?: string; departmentName?: string; roleCode?: string }
export interface Submission {
  id: string; submittedById: string; note: string; submittedAt?: string; dueDateAtSubmission?: string;
  isLegacy: boolean; wasLate?: boolean; decision: string; reviewNote?: string; reviewedById?: string; reviewedAt?: string;
  files: Array<{ id: string; name: string; size: number }>;
}
export interface WorkflowTask extends TaskDetailDto {
  version: string; reviewerId?: string; reviewerName?: string; parentTaskId?: string; requiresWorkflowReview: boolean;
  canStart: boolean; canCancel: boolean; canAmend: boolean; canAddCoordination: boolean; submissionBlockedReason?: string;
  submissions: Submission[]; coordinationTasks: TaskItemDto[];
  documents: Array<{ id: string; kind: DocumentKind; title: string; number: string }>;
  changes: Array<{ id: string; userId: string; kind: string; oldValue?: string; newValue?: string; reason?: string; createdAt: string }>;
}
export interface Page<T> { items: T[]; totalCount: number; page: number; pageSize: number; counts?: Record<string, number> }
export interface DocumentReference { id: string; kind: DocumentKind; version?: string }
export interface CoordinationInput { title: string; requirements: string; assigneeId: string; dueDate: string }
export interface TaskInput {
  title: string; description: string; requirements: string; assigneeId: string; reviewerId: string;
  dueDate: string; priority: string; documents: DocumentReference[]; coordinationTasks: CoordinationInput[];
  parentTaskId?: string; parentVersion?: string;
}

export class WorkflowApiError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}
export function dataOf<T>(response: ApiResponse<T>): T {
  if (!response.success || response.data === undefined || response.data === null)
    throw new WorkflowApiError(response.error || response.message || 'Không nhận được dữ liệu từ máy chủ.', response.status);
  return response.data;
}
export function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
  return params.toString();
}
export function workflowChanged() { window.dispatchEvent(new Event('workflow:changed')); }
export async function workflowMutation<T>(path: string, payload: object, method = 'POST') {
  const response = await apiFetch<T>(path, { method, body: JSON.stringify(payload) });
  if (!response.success) throw new WorkflowApiError(response.error || response.message || 'Không thể lưu thay đổi.', response.status);
  workflowChanged();
  return response.data;
}
export const taskLabels: Record<string, string> = {
  Todo: 'Chưa bắt đầu', InProgress: 'Đang thực hiện', InReview: 'Chờ nghiệm thu', Completed: 'Đã nghiệm thu', Cancelled: 'Đã hủy', PendingUBMTTQReview: 'Cần chuyển đổi dữ liệu cũ',
};
export const documentLabels: Record<string, string> = {
  New: 'Mới tiếp nhận', Submitted: 'Chờ xử lý', NeedsSupplement: 'Cần bổ sung', Assigned: 'Đã giao việc', Archived: 'Lưu tra cứu',
  Draft: 'Bản nháp', PendingSignature: 'Chờ ký', Issued: 'Đã phát hành', Sent: 'Đã gửi', Rejected: 'Cần chỉnh sửa',
  Recalled: 'Đã thu hồi', Cancelled: 'Đã hủy',
};
export function taskLabel(task: Pick<TaskItemDto, 'status' | 'rejectionReason'>) {
  return task.status === 'InProgress' && task.rejectionReason ? 'Cần chỉnh sửa' : taskLabels[task.status] || 'Chưa xác định';
}
export function isOverdue(task: Pick<TaskItemDto, 'status' | 'dueDate'>) {
  return ['Todo', 'InProgress'].includes(task.status) && !!task.dueDate && Date.parse(task.dueDate) < Date.now();
}
