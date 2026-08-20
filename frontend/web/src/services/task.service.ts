/**
 * Task Service — Quản lý giao việc, điều chuyển công việc
 */

import type { RoleCode, DepartmentCode } from './role-hierarchy.service';
import { canAssignToByName, canTransferTask as checkTransferPermission, ROLE_HIERARCHY } from './role-hierarchy.service';
import { apiFetch } from './api.config';

export interface CreateTaskPayload {
  title: string;
  description: string;
  assignerId: string;
  assigneeId: string;
  departmentId?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  type?: 'BAU' | 'AdHoc' | 'Project';
  estimatedEffortHours?: number;
  dueDate?: string;
}

export async function createTaskApi(payload: CreateTaskPayload) {
  return await apiFetch<string>('/api/v1/Tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface UpdateTaskStatusPayload {
  status: string;
  ratingScore?: number;
  systemScore?: number;
  evaluatorScore?: number;
  submissionNote?: string;
  rejectionReason?: string;
  newExtendedDueDate?: string;
}

export interface TaskItemDto {
  id: string;
  title: string;
  description: string;
  assignerId: string;
  assignerName: string;
  assigneeId: string;
  assigneeName: string;
  departmentId?: string;
  departmentName?: string;
  priority: string;
  status: string;
  type: string;
  estimatedEffortHours: number;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  submissionNote?: string;
  systemScore?: number;
  evaluatorScore?: number;
  ratingScore?: number;
  rejectionReason?: string;
  progressPercentage: number;
  isEscalated: boolean;
  openAnnotationCount?: number;
  totalAnnotationCount?: number;
  createdAt: string;
}

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
}

export interface DepartmentDto {
  id: string;
  name: string;
  code: string;
  memberCount: number;
}

export interface PaginatedTasksResponse {
  items: TaskItemDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface GetTasksParams {
  status?: string;
  departmentId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  dueDate?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

export async function getTasksApi(params?: GetTasksParams) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.departmentId) searchParams.append('departmentId', params.departmentId);
  if (params?.q) searchParams.append('q', params.q);
  if (params?.page) searchParams.append('page', String(params.page));
  if (params?.pageSize) searchParams.append('pageSize', String(params.pageSize));
  if (params?.dueDate) searchParams.append('dueDate', params.dueDate);
  if (params?.dueDateFrom) searchParams.append('dueDateFrom', params.dueDateFrom);
  if (params?.dueDateTo) searchParams.append('dueDateTo', params.dueDateTo);

  const qs = searchParams.toString();
  const url = `/api/v1/Tasks${qs ? `?${qs}` : ''}`;
  return await apiFetch<PaginatedTasksResponse>(url, { method: 'GET' });
}

export async function updateTaskStatusApi(
  taskId: string,
  payloadOrStatus: UpdateTaskStatusPayload | string,
  ratingScore?: number,
  rejectionReason?: string,
  newExtendedDueDate?: string
) {
  const payload: UpdateTaskStatusPayload = typeof payloadOrStatus === 'string'
    ? {
        status: payloadOrStatus,
        ratingScore,
        rejectionReason,
        newExtendedDueDate,
      }
    : payloadOrStatus;

  return await apiFetch<{ success: boolean; message: string }>(`/api/v1/Tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export interface PaginatedUsersResult {
  items: UserDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getUsersApi(page: number = 1, pageSize: number = 100) {
  return await apiFetch<PaginatedUsersResult | UserDto[]>(`/api/v1/Users?page=${page}&pageSize=${pageSize}`, { method: 'GET' });
}

export async function transferTaskApi(taskId: string, targetUserId: string, reason: string) {
  return await apiFetch(`/api/v1/Tasks/${taskId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId, reason }),
  });
}

export async function getDepartmentsApi() {
  return await apiFetch<DepartmentDto[]>('/api/v1/Departments', { method: 'GET' });
}

export interface SubTaskDto {
  id: string;
  taskItemId: string;
  title: string;
  isCompleted: boolean;
}

export async function getSubTasksApi(taskId: string) {
  return await apiFetch<SubTaskDto[]>(`/api/v1/Tasks/${taskId}/subtasks`, { method: 'GET' });
}

export async function createSubTaskApi(taskId: string, title: string) {
  return await apiFetch<string>(`/api/v1/Tasks/${taskId}/subtasks`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function toggleSubTaskApi(taskId: string, subTaskId: string) {
  return await apiFetch(`/api/v1/Tasks/${taskId}/subtasks/${subTaskId}/toggle`, {
    method: 'PATCH',
  });
}

export async function submitUBMTTQReviewApi(taskId: string, reviewContent: string, isApproved: boolean) {
  return await apiFetch<{ success: boolean; message?: string }>(`/api/v1/Tasks/${taskId}/ubmttq-review`, {
    method: 'POST',
    body: JSON.stringify({ reviewContent, isApproved }),
  });
}

export interface TransferRecord {
  id: string;
  taskId: string;
  fromStaff: string;
  toStaff: string;
  transferredBy: string;
  transferredByRole: string;
  reason: string;
  timestamp: string;
}

export interface TaskCreateValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate việc giao công việc mới.
 * Chặn ở tầng logic: không tin tưởng dữ liệu từ client.
 */
export function validateTaskAssignment(
  assignerRole: RoleCode,
  assigneeName: string,
  title: string,
  dueDate: string,
): TaskCreateValidation {
  if (!title || !title.trim()) {
    return { valid: false, error: 'Vui lòng nhập tiêu đề công việc.' };
  }

  if (!assigneeName || !assigneeName.trim()) {
    return { valid: false, error: 'Vui lòng chọn người thực hiện.' };
  }

  if (!dueDate) {
    return { valid: false, error: 'Vui lòng chọn hạn chót.' };
  }

  // Kiểm tra phân quyền
  if (!canAssignToByName(assignerRole, assigneeName)) {
    return {
      valid: false,
      error: `Bạn không có quyền giao việc cho ${assigneeName}. Chỉ được giao việc cho cấp dưới.`,
    };
  }

  return { valid: true };
}

/**
 * Validate điều chuyển công việc.
 */
export function validateTaskTransfer(
  currentRole: RoleCode,
  fromStaffDept: DepartmentCode,
  toStaffDept: DepartmentCode,
  toStaffName: string,
  reason: string,
  fromStaffName?: string,
): TaskCreateValidation {
  if (!toStaffName || !toStaffName.trim()) {
    return { valid: false, error: 'Vui lòng chọn người nhận việc mới.' };
  }

  if (!reason || !reason.trim()) {
    return { valid: false, error: 'Vui lòng nhập lý do điều chuyển.' };
  }

  if (!checkTransferPermission(currentRole, fromStaffDept, toStaffDept, fromStaffName)) {
    const roleConfig = ROLE_HIERARCHY[currentRole];
    if (roleConfig.scopeLevel >= 2.5) {
      return {
        valid: false,
        error: 'Bạn không thể điều chuyển công việc của cấp bằng hoặc cao hơn mình, hoặc điều chuyển ngoài phạm vi quản lý. (Quy tắc: cấp trên vẫn hơn cấp dưới).',
      };
    }
    if (roleConfig.scopeLevel === 2.0) {
      return {
        valid: false,
        error: 'Phó Chủ tịch chỉ được điều chuyển trong phạm vi được phân công phụ trách. Liên hệ Chủ tịch UBND để điều chuyển ngoài phạm vi.',
      };
    }
    return {
      valid: false,
      error: 'Bạn không có quyền điều chuyển công việc.',
    };
  }

  return { valid: true };
}

/**
 * Tạo bản ghi lịch sử điều chuyển.
 */
export function createTransferRecord(
  taskId: string,
  fromStaff: string,
  toStaff: string,
  transferredBy: string,
  transferredByRole: string,
  reason: string,
): TransferRecord {
  return {
    id: `TR-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    taskId,
    fromStaff,
    toStaff,
    transferredBy,
    transferredByRole,
    reason,
    timestamp: new Date().toLocaleString('vi-VN'),
  };
}

/**
 * Gợi ý người nhận việc tốt nhất dựa trên tải công việc.
 * Ưu tiên: tải thấp nhất + cùng phòng ban.
 */
export function suggestTransferTarget<T extends { name: string; departmentCode: DepartmentCode; assignedHours: number; maxHours: number }>(
  candidates: T[],
  preferredDeptCode?: DepartmentCode,
  excludeName?: string,
): T | null {
  let filtered = candidates.filter(s => s.name !== excludeName);

  // Ưu tiên cùng phòng ban
  if (preferredDeptCode) {
    const sameDept = filtered.filter(s => s.departmentCode === preferredDeptCode);
    if (sameDept.length > 0) {
      filtered = sameDept;
    }
  }

  // Sắp xếp theo tải công việc (thấp nhất trước)
  filtered.sort((a, b) => {
    const rateA = a.assignedHours / a.maxHours;
    const rateB = b.assignedHours / b.maxHours;
    return rateA - rateB;
  });

  return filtered[0] || null;
}
