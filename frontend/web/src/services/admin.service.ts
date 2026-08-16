import { apiFetch, ApiResponse } from './api.config';

export interface SeedSummary {
  departments: number;
  roles: number;
  users: number;
  inboxDocuments: number;
  taskItems: number;
  subTasks: number;
  calendarEvents: number;
  outgoingDocuments: number;
}

export interface SeedDemoResponse {
  success: boolean;
  message: string;
  timestamp: string;
  summary: SeedSummary;
}

/**
 * Nạp lại toàn bộ bộ dữ liệu mẫu phong phú (Rich Seed Dataset)
 */
export async function seedDemoDataApi(): Promise<ApiResponse<SeedDemoResponse>> {
  return apiFetch<SeedDemoResponse>('/api/v1/Admin/seed-demo', {
    method: 'POST',
  });
}
