import { apiFetch } from './api.config';

export interface AuditLogItemDto {
  id: string;
  userId: string;
  username: string;
  actingRole: string;
  action: string;
  entityName: string;
  entityId: string;
  details: string;
  ipAddress: string;
  isDelegatedAction: boolean;
  createdAt: string;
}

export interface AuditLogResultDto {
  items: AuditLogItemDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function getAuditLogApi(page = 1, pageSize = 20, userId?: string, action?: string) {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('pageSize', pageSize.toString());
  if (userId) params.append('userId', userId);
  if (action) params.append('action', action);

  return await apiFetch<AuditLogResultDto>(`/api/v1/AuditLog?${params.toString()}`, {
    method: 'GET',
  });
}
