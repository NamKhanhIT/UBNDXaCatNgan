import { apiFetch, ApiResponse } from './api.config';

export type RatingApprovalStatusEnum = 'Applied' | 'PendingApproval' | 'ApprovedBySuperior' | 'RejectedBySuperior';

export interface RatingHistoryDto {
  id: string;
  taskItemId: string;
  taskItemTitle: string;
  oldScore?: number;
  newScore: number;
  scoreDelta: number;
  changedByUserId: string;
  changedByUserName: string;
  changedByUserRoleName: string;
  changedAt: string;
  reason: string;
  evidenceUrl: string;
  approvalStatus: RatingApprovalStatusEnum;
  approvalStatusName: string;
  approvedByUserId?: string;
  approvedByUserName?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface SubmitRatingRevisionData {
  newScore: number;
  reason: string;
  evidenceUrl: string;
}

export async function submitRatingRevisionApi(taskId: string, data: SubmitRatingRevisionData): Promise<ApiResponse<RatingHistoryDto>> {
  return await apiFetch<RatingHistoryDto>(`/api/v1/Tasks/${taskId}/rating-revision`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getTaskRatingHistoryApi(taskId: string): Promise<ApiResponse<RatingHistoryDto[]>> {
  return await apiFetch<RatingHistoryDto[]>(`/api/v1/Tasks/${taskId}/rating-history`, {
    method: 'GET',
  });
}

export async function getPendingRatingRevisionsApi(): Promise<ApiResponse<RatingHistoryDto[]>> {
  return await apiFetch<RatingHistoryDto[]>(`/api/v1/RatingHistory/pending`, {
    method: 'GET',
  });
}

export async function approveRatingRevisionApi(historyId: string): Promise<ApiResponse<boolean>> {
  return await apiFetch<boolean>(`/api/v1/RatingHistory/${historyId}/approve`, {
    method: 'POST',
  });
}

export async function rejectRatingRevisionApi(historyId: string, rejectionReason: string): Promise<ApiResponse<boolean>> {
  return await apiFetch<boolean>(`/api/v1/RatingHistory/${historyId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejectionReason }),
  });
}
