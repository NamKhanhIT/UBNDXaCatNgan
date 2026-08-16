import { apiFetch } from './api.config';

export type AnnotationSeverity = 'LoiSai' | 'CanChinhSua' | 'GopY' | 1 | 2 | 3;
export type AnnotationStatus = 'Open' | 'Resolved' | 1 | 2;

export interface TaskReviewAnnotationDto {
  id: string;
  taskItemId: string;
  anchorText: string;
  startOffsetHint?: number;
  commentText: string;
  severity: number | string;
  severityName?: string;
  severityText?: string;
  createdByUserId: string;
  createdByUserName: string;
  createdAt: string;
  resolvedStatus: string | number;
  resolvedStatusName?: string;
  resolvedByUserId?: string;
  resolvedByUserName?: string;
  resolvedAt?: string;
}

export interface CreateAnnotationPayload {
  anchorText: string;
  startOffsetHint?: number;
  commentText: string;
  severity: number; // 1: LoiSai, 2: CanChinhSua, 3: GopY
}

export interface SystemScoreBreakdownDto {
  onTimeScore: number;
  checklistScore: number;
  noRejectionScore: number;
  totalSystemScore: number;
  daysLate: number;
  totalSubTasks: number;
  completedSubTasks: number;
  rejectionCount: number;
}

export async function getTaskAnnotationsApi(taskId: string): Promise<TaskReviewAnnotationDto[]> {
  const res = await apiFetch<TaskReviewAnnotationDto[]>(`/api/v1/Tasks/${taskId}/annotations`, {
    method: 'GET'
  });

  if (!res.success || !res.data) {
    return [];
  }

  return res.data;
}

export async function createTaskAnnotationApi(
  taskId: string,
  payload: CreateAnnotationPayload
): Promise<TaskReviewAnnotationDto> {
  const res = await apiFetch<TaskReviewAnnotationDto>(`/api/v1/Tasks/${taskId}/annotations`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!res.success || !res.data) {
    throw new Error(res.error || 'Không thể tạo chú thích nhận xét');
  }

  return res.data;
}

export async function resolveTaskAnnotationApi(
  taskId: string,
  annotationId: string
): Promise<TaskReviewAnnotationDto> {
  const res = await apiFetch<TaskReviewAnnotationDto>(`/api/v1/Tasks/${taskId}/annotations/${annotationId}/resolve`, {
    method: 'POST'
  });

  if (!res.success || !res.data) {
    throw new Error(res.error || 'Không thể đánh dấu giải quyết chú thích');
  }

  return res.data;
}

export async function getTaskSystemScoreApi(taskId: string): Promise<SystemScoreBreakdownDto> {
  const res = await apiFetch<SystemScoreBreakdownDto>(`/api/v1/Tasks/${taskId}/system-score`, {
    method: 'GET'
  });

  if (!res.success || !res.data) {
    throw new Error(res.error || 'Không thể tính điểm hệ thống');
  }

  return res.data;
}
