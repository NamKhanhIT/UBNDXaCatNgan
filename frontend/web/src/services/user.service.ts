import { apiFetch, ApiResponse } from './api.config';

export interface UserDto {
  id: string;
  username: string;
  fullName: string;
  email: string;
  zaloPhoneNumber?: string;
  primaryDepartmentId?: string;
  departmentName?: string;
  activeRoleCode?: string;
  roleName?: string;
  rankLevel: number;
  assignedHours: number;
  maxHours: number;
  utilizationRate: number;
  isOverloaded: boolean;
}

export interface PaginatedUsersResponse {
  items: UserDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  roleCode?: string;
  workloadStatus?: string;
}

export async function getUsersPaginatedApi(params: GetUsersParams = {}): Promise<ApiResponse<PaginatedUsersResponse>> {
  const queryParts: string[] = [];

  if (params.page !== undefined) queryParts.push(`page=${params.page}`);
  if (params.pageSize !== undefined) queryParts.push(`pageSize=${params.pageSize}`);
  if (params.search && params.search.trim()) queryParts.push(`search=${encodeURIComponent(params.search.trim())}`);
  if (params.departmentId && params.departmentId !== 'ALL') queryParts.push(`departmentId=${encodeURIComponent(params.departmentId)}`);
  if (params.roleCode && params.roleCode !== 'ALL') queryParts.push(`roleCode=${encodeURIComponent(params.roleCode)}`);
  if (params.workloadStatus && params.workloadStatus !== 'ALL') queryParts.push(`workloadStatus=${encodeURIComponent(params.workloadStatus)}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  return await apiFetch<PaginatedUsersResponse>(`/api/v1/Users${queryString}`, {
    method: 'GET',
  });
}
