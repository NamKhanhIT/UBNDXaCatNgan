import { apiFetch } from './api.config';

export interface ActivityLogItemDto {
  id: string;
  userId: string;
  userFullName: string;
  actionType: string;
  targetEntityType: string;
  targetEntityId: string;
  summary: string;
  createdAt: string;
}

export interface ActivityLogResultDto {
  items: ActivityLogItemDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function getActivityLogApi(page = 1, pageSize = 20, userId?: string) {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('pageSize', pageSize.toString());
  if (userId) params.append('userId', userId);

  return await apiFetch<ActivityLogResultDto>(`/api/v1/ActivityLog?${params.toString()}`, {
    method: 'GET',
  });
}
