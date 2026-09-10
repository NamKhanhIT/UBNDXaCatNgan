/**
 * Report Service — Quản lý báo cáo tiến độ (2 cấp duyệt)
 * 
 * Luồng: Chuyên viên nộp → Trưởng phòng duyệt → Chủ tịch xem xét
 */

import type { RoleCode } from './role-hierarchy.service';
import { ROLE_HIERARCHY, canApproveReport } from './role-hierarchy.service';
import { apiFetch, getApiBaseUrl, getStoredToken } from './api.config';

export interface OfficerGRADScoreDto {
  userId: string;
  fullName: string;
  roleName: string;
  departmentName: string;
  totalTasksAssigned: number;
  completedTasksCount: number;
  overdueTasksCount: number;
  systemScore?: number;       // 3.0đ max — điểm hệ thống tự động (renamed từ systemAutoScore30)
  leaderScore?: number;       // 7.0đ max — điểm lãnh đạo thẩm định (renamed từ leaderEvaluationScore70)
  finalScore?: number;        // 10.0đ max — tổng điểm thang 10 (renamed từ finalScore100)
  systemAutoScore30?: number; // backward-compat alias
  leaderEvaluationScore70?: number; // backward-compat alias
  finalScore100?: number;     // backward-compat alias (giá trị vẫn là thang 10)
  checklistProgressScore40?: number;
  leaderQualityScore60?: number;
  finalGRADScore: number;
  tierGrade: string;
}

export interface DepartmentGRADSummaryDto {
  departmentId: string;
  departmentName: string;
  memberCount: number;
  totalTasks: number;
  averageGRADScore: number;
  tierGrade: string;
}

export interface GRADReportResultDto {
  officers: OfficerGRADScoreDto[];
  departments: DepartmentGRADSummaryDto[];
  overallCommuneAverageScore: number;
}

export interface OfficerTaskDetailDto {
  taskId: string;
  title: string;
  status: string;
  progressPercentage: number;
  assignedAt: string;
  dueDate?: string;
  completedAt?: string;
  isOverdue: boolean;
}

export interface OfficerDocumentDto {
  documentId: string;
  title: string;
  documentNumber?: string;
  uploadedAt: string;
  uploaderName: string;
  category?: string;
}

export interface OfficerDetailForEvaluationDto {
  officer: OfficerGRADScoreDto;
  tasks: OfficerTaskDetailDto[];
  documents: OfficerDocumentDto[];
}

export interface RatingHistoryEntryDto {
  id: string;
  userId: string;
  oldScore: number;
  newScore: number;
  delta: number;
  reason: string;
  evidenceFileIds: string[];
  evidenceUrls: string[];
  changedByUserId: string;
  changedByName: string;
  changedAt: string;
  periodId?: string;
  validationDetails?: string;
}

export type RatingPeriodType = 'week' | 'month' | 'quarter' | 'halfyear' | 'year';

export async function getGRADReportApi() {
  return await apiFetch<GRADReportResultDto>('/api/v1/Reports/grad', { method: 'GET' });
}

export async function getOfficerEvaluationDetailApi(userId: string) {
  return await apiFetch<OfficerDetailForEvaluationDto>(
    `/api/v1/Reports/grad/officer/${userId}`,
    { method: 'GET' },
  );
}

export async function getRatingHistoryApi(userId: string, from?: string, to?: string) {
  const params = new URLSearchParams({ userId });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return await apiFetch<RatingHistoryEntryDto[]>(
    `/api/v1/RatingHistory?${params.toString()}`,
    { method: 'GET' },
  );
}

export async function exportEvaluationExcelApi(
  period: RatingPeriodType,
  from?: string,
  to?: string,
  format: 'csv' | 'xlsx' = 'csv',
): Promise<Blob> {
  const params = new URLSearchParams({ period, format });
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  // Bypass apiFetch JSON parsing — dùng raw fetch để nhận binary blob
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/v1/Reports/grad/export?${params.toString()}`;
  const storedToken = getStoredToken();
  const headers: Record<string, string> = { 'X-Demo-Mode': 'false' };
  if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
  const res = await fetch(url, { method: 'GET', headers, credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Export failed (${res.status})`);
  }
  return await res.blob();
}

export interface SubmitOfficialRatingPayload {
  targetUserId: string;
  targetUserName?: string;
  departmentId?: string;
  departmentName?: string;
  ratingScore10: number;
  evaluatorScore70?: number;
  systemScore30?: number;
  evaluationPeriod?: string;
  evaluationNotes?: string;
  competencyBreakdown?: Record<string, any>;
  reason?: string;
  evidenceFileIds?: string[];
}

export async function submitOfficialRatingApi(payload: SubmitOfficialRatingPayload) {
  return await apiFetch<{ success: boolean; message: string }>('/api/v1/Reports/grad/evaluate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface DeleteOfficerRatingPayload {
  targetUserId: string;
  evaluationPeriod: string;
  reason: string;
  evidenceFileIds: string[];
}

export async function uploadEvaluationEvidenceApi(file: File): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/v1/Reports/grad/evidence/upload`;
  const storedToken = getStoredToken();
  const formData = new FormData();
  formData.append('file', file);
  const headers: Record<string, string> = { 'X-Demo-Mode': 'false' };
  if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
  const res = await fetch(url, { method: 'POST', headers, credentials: 'include', body: formData });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    let msg = text || `Upload failed (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.error || msg;
    } catch {
      // text không phải JSON, giữ nguyên
    }
    throw new Error(msg);
  }
  // Server trả { success, data: attachmentId, message }
  try {
    const parsed = JSON.parse(text);
    return parsed?.data ?? text;
  } catch {
    return text;
  }
}

export async function deleteOfficerRatingApi(payload: DeleteOfficerRatingPayload) {
  // Backend expect DELETE /api/v1/Reports/grad/evaluate với query params + body evidenceFileIds.
  // apiFetch không hỗ trợ DELETE kèm body JSON trực tiếp, dùng raw fetch.
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/v1/Reports/grad/evaluate`
    + `?targetUserId=${encodeURIComponent(payload.targetUserId)}`
    + `&evaluationPeriod=${encodeURIComponent(payload.evaluationPeriod || '')}`
    + `&reason=${encodeURIComponent(payload.reason)}`;
  const storedToken = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Demo-Mode': 'false',
  };
  if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload.evidenceFileIds ?? []),
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    let msg = text || `Delete failed (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.error || msg;
    } catch {
      // text không phải JSON, giữ nguyên
    }
    throw new Error(msg);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { success: res.ok };
  }
}

export type ReportStatus = 'submitted' | 'approved_level1' | 'approved_final' | 'rejected' | 'needs_revision';
export type TaskProgressStatus = 'dang_thuc_hien' | 'hoan_thanh' | 'tre_han' | 'xin_gia_han';

export interface ProgressReport {
  id: string;
  taskId: string;
  taskTitle: string;
  submittedBy: string;
  submittedByRole: string;
  submitterRankLevel: number;
  progressStatus: TaskProgressStatus;
  description: string;
  attachments: string[];
  status: ReportStatus;
  submittedAt: string;
  reviewHistory: ReportReview[];
  extensionDate?: string; // Ngày xin gia hạn (nếu có)
}

export interface ReportReview {
  id: string;
  reviewedBy: string;
  reviewedByRole: string;
  action: 'approve' | 'reject' | 'needs_revision';
  feedback: string;
  reviewedAt: string;
}

export const PROGRESS_STATUS_LABELS: Record<TaskProgressStatus, string> = {
  dang_thuc_hien: 'Đang thực hiện',
  hoan_thanh: 'Hoàn thành',
  tre_han: 'Trễ hạn',
  xin_gia_han: 'Xin gia hạn',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  submitted:        'Đã nộp — Chờ Trưởng phòng/Ban duyệt',
  approved_level1:  'Trưởng phòng/Ban đã duyệt — Chờ lãnh đạo xem xét',
  approved_final:   'Lãnh đạo đã phê duyệt — Hoàn tất',
  rejected:         'Bị từ chối',
  needs_revision:   'Yêu cầu bổ sung thêm thông tin',
};

/**
 * Tạo báo cáo tiến độ mới
 */
export function createReport(
  taskId: string,
  taskTitle: string,
  submittedBy: string,
  submittedByRole: string,
  currentRole: RoleCode,
  progressStatus: TaskProgressStatus,
  description: string,
  attachments: string[],
  extensionDate?: string,
): ProgressReport {
  return {
    id: `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    taskId,
    taskTitle,
    submittedBy,
    submittedByRole,
    submitterRankLevel: ROLE_HIERARCHY[currentRole].rankLevel,
    progressStatus,
    description,
    attachments,
    status: 'submitted',
    submittedAt: new Date().toLocaleString('vi-VN'),
    reviewHistory: [],
    extensionDate,
  };
}

/**
 * Duyệt hoặc từ chối báo cáo.
 * 
 * Luồng 2 cấp:
 * 1. Chuyên viên nộp (submitted) → Trưởng phòng duyệt → approved_level1
 * 2. approved_level1 → Chủ tịch duyệt → approved_final
 */
export function reviewReport(
  report: ProgressReport,
  reviewerRole: RoleCode,
  reviewerName: string,
  action: 'approve' | 'reject' | 'needs_revision',
  feedback: string,
): { updatedReport: ProgressReport; error?: string } {
  const reviewerConfig = ROLE_HIERARCHY[reviewerRole];

  // Validate quyền duyệt
  if (!canApproveReport(reviewerRole, report.submitterRankLevel)) {
    // Nếu report đã được TP duyệt (level1), CT cần xem xét
    if (report.status === 'approved_level1' && reviewerConfig.rankLevel <= 1) {
      // OK - CT duyệt báo cáo đã qua TP
    } else {
      return {
        updatedReport: report,
        error: 'Bạn không có quyền duyệt báo cáo này.',
      };
    }
  }

  const review: ReportReview = {
    id: `RV-${Date.now()}`,
    reviewedBy: reviewerName,
    reviewedByRole: reviewerConfig.label,
    action,
    feedback,
    reviewedAt: new Date().toLocaleString('vi-VN'),
  };

  let newStatus: ReportStatus = report.status;

  if (action === 'approve') {
    if (report.status === 'submitted' && reviewerConfig.rankLevel === 3) {
      // Trưởng phòng (Rank 3) duyệt → chuyển lên cấp 1
      newStatus = 'approved_level1';
    } else if (
      (report.status === 'approved_level1' || report.status === 'submitted') &&
      reviewerConfig.rankLevel <= 1
    ) {
      // Chủ tịch (Rank 1) duyệt → hoàn tất
      newStatus = 'approved_final';
    }
  } else if (action === 'reject') {
    newStatus = 'rejected';
  } else if (action === 'needs_revision') {
    newStatus = 'needs_revision';
  }

  return {
    updatedReport: {
      ...report,
      status: newStatus,
      reviewHistory: [...report.reviewHistory, review],
    },
  };
}

/**
 * Lọc báo cáo chờ duyệt theo vai trò hiện tại.
 * - Trưởng phòng: thấy báo cáo status='submitted' của chuyên viên
 * - Cấp 1: thấy báo cáo status='approved_level1' (TP đã duyệt)
 */
export function getPendingReports(
  allReports: ProgressReport[],
  currentRole: RoleCode,
): ProgressReport[] {
  const currentRankLevel = ROLE_HIERARCHY[currentRole].rankLevel;

  return allReports.filter(report => {
    if (currentRankLevel === 3) {
      // Trưởng phòng (Rank 3) duyệt báo cáo submitted của chuyên viên
      return report.status === 'submitted' && report.submitterRankLevel > currentRankLevel;
    }
    if (currentRankLevel <= 1) {
      // Cấp 1 (CT/Bí thư) duyệt báo cáo đã qua TP
      return report.status === 'approved_level1';
    }
    return false;
  });
}
