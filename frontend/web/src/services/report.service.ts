/**
 * Report Service — Quản lý báo cáo tiến độ (2 cấp duyệt)
 * 
 * Luồng: Chuyên viên nộp → Trưởng phòng duyệt → Chủ tịch xem xét
 */

import type { RoleCode } from './role-hierarchy.service';
import { ROLE_HIERARCHY, canApproveReport } from './role-hierarchy.service';
import { apiFetch } from './api.config';

export interface OfficerGRADScoreDto {
  userId: string;
  fullName: string;
  roleName: string;
  departmentName: string;
  totalTasksAssigned: number;
  completedTasksCount: number;
  overdueTasksCount: number;
  systemAutoScore30?: number;
  leaderEvaluationScore70?: number;
  finalScore100?: number;
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

export async function getGRADReportApi() {
  return await apiFetch<GRADReportResultDto>('/api/v1/Reports/grad', { method: 'GET' });
}

export type ReportStatus = 'submitted' | 'approved_level1' | 'approved_final' | 'rejected' | 'needs_revision';
export type TaskProgressStatus = 'dang_thuc_hien' | 'hoan_thanh' | 'tre_han' | 'xin_gia_han';

export interface ProgressReport {
  id: string;
  taskId: string;
  taskTitle: string;
  submittedBy: string;
  submittedByRole: string;
  submitterScopeLevel: number;
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
    submitterScopeLevel: ROLE_HIERARCHY[currentRole].scopeLevel,
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
  if (!canApproveReport(reviewerRole, report.submitterScopeLevel)) {
    // Nếu report đã được TP duyệt (level1), CT cần xem xét
    if (report.status === 'approved_level1' && reviewerConfig.scopeLevel <= 1) {
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
    if (report.status === 'submitted' && reviewerConfig.scopeLevel === 2) {
      // Trưởng phòng duyệt → chuyển lên cấp 1
      newStatus = 'approved_level1';
    } else if (
      (report.status === 'approved_level1' || report.status === 'submitted') &&
      reviewerConfig.scopeLevel <= 1
    ) {
      // Chủ tịch duyệt → hoàn tất
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
  const currentScopeLevel = ROLE_HIERARCHY[currentRole].scopeLevel;

  return allReports.filter(report => {
    if (currentScopeLevel === 2) {
      // Trưởng phòng duyệt báo cáo submitted của chuyên viên
      return report.status === 'submitted' && report.submitterScopeLevel > currentScopeLevel;
    }
    if (currentScopeLevel <= 1) {
      // Cấp 1 duyệt báo cáo đã qua TP
      return report.status === 'approved_level1';
    }
    return false;
  });
}
