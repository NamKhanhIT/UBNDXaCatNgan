'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SignInPage, Testimonial } from '../components/ui/sign-in';
import { canAssignToByName, getAssignableStaff, canCreateTask, canTransferTask, ROLE_HIERARCHY, STAFF_ROLE_MAP } from '../services/role-hierarchy.service';
import { validateTaskAssignment, validateTaskTransfer, createTransferRecord, suggestTransferTarget, createTaskApi, getTasksApi, updateTaskStatusApi, getUsersApi, getDepartmentsApi, transferTaskApi, submitUBMTTQReviewApi } from '../services/task.service';
import type { TransferRecord, TaskItemDto, UserDto, DepartmentDto } from '../services/task.service';
import { getInboxDocumentsApi, scheduleInboxDocumentApi } from '../services/inbox.service';
import type { InboxDocumentDto } from '../services/inbox.service';
import { createReport, reviewReport, getPendingReports, getGRADReportApi, PROGRESS_STATUS_LABELS, REPORT_STATUS_LABELS } from '../services/report.service';
import type { ProgressReport, TaskProgressStatus, ReportStatus, OfficerGRADScoreDto, DepartmentGRADSummaryDto } from '../services/report.service';
import { createReminder, formatReminderLabel } from '../services/schedule.service';
import type { Reminder } from '../services/schedule.service';
import { getNotifications, markNotificationRead, markAllNotificationsRead, initSignalRConnection, stopSignalRConnection } from '../services/notification.service';
import type { NotificationItem } from '../services/notification.service';
import { getCommentsApi, createCommentApi, TaskCommentDto } from '../services/comment.service';
import { getActivityLogApi, ActivityLogItemDto } from '../services/activity-log.service';
import { getAuditLogApi, AuditLogItemDto } from '../services/audit-log.service';
import { markReadReceiptApi, getReadReceiptsApi } from '../services/read-receipt.service';
import { getUsersPaginatedApi } from '../services/user.service';
import type { UserDto as PaginatedUserDto } from '../services/user.service';
import {
  getOutgoingDocumentsApi,
  getOutgoingDocumentByIdApi,
  createOutgoingDocumentApi,
  updateOutgoingDocumentApi,
  submitOutgoingDocumentForSignatureApi,
  signAndIssueOutgoingDocumentApi,
  rejectOutgoingDocumentApi,
  revokeOutgoingDocumentApi,
  revokeIssuedOutgoingDocumentApi,
  cancelOutgoingDocumentApi,
} from '../services/outgoing-document.service';
import type {
  OutgoingDocumentDto,
  DocumentTypeEnum,
  OutgoingDocumentStatusEnum,
} from '../services/outgoing-document.service';
import {
  submitRatingRevisionApi,
  getTaskRatingHistoryApi,
  getPendingRatingRevisionsApi,
  approveRatingRevisionApi,
  rejectRatingRevisionApi,
} from '../services/rating-history.service';
import type {
  RatingHistoryDto,
  RatingApprovalStatusEnum,
} from '../services/rating-history.service';
import {
  getTaskAnnotationsApi,
  createTaskAnnotationApi,
  resolveTaskAnnotationApi,
  getTaskSystemScoreApi,
} from '../services/task-annotation.service';
import type {
  TaskReviewAnnotationDto,
  SystemScoreBreakdownDto,
} from '../services/task-annotation.service';
import {
  isPushNotificationSupported,
  isIosDevice,
  isIosStandalonePwa,
  registerServiceWorker,
  getExistingPushSubscription,
  subscribeCurrentDevice,
  unsubscribeCurrentDevice,
  getMyPushSubscriptionsApi,
  sendTestPushApi,
  unsubscribePushApi,
  getAutoDeviceLabel,
} from '../services/push-notification.service';
import type { PushSubscriptionDto } from '../services/push-notification.service';
import { DocumentViewerModal } from '../components/DocumentViewerModal';
import { RevokeDocumentModal } from '../components/RevokeDocumentModal';
import { DocumentHistoryModal } from '../components/DocumentHistoryModal';
import { GoogleCalendarView } from '../components/GoogleCalendarView';
import { AiUploadModal } from '../components/AiUploadModal';
import { AiReviewModal } from '../components/AiReviewModal';
import { AiAssignmentModal } from '../components/AiAssignmentModal';
import { AiChecklistModal } from '../components/AiChecklistModal';
import { getFileViewUrl, uploadAndAnalyzeApi } from '../services/files.service';

/* ═══════════════════════════════════════════════════════════════
   FONTAWESOME 6 HELPER COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const Icon = ({ name, size = 16, className = '', style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) => (
  <i className={`fa-solid fa-${name} ${className}`} style={{ fontSize: size, ...style }} aria-hidden="true" />
);

/* ═══════════════════════════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════════════════════════ */

type RoleCode =
  | 'BiThu'
  | 'BiThuDU'
  | 'ChuTichUBND'
  | 'ChuTichHDND'
  | 'PhoChuTichUBND'
  | 'PhoChuTichUBND_ChanhVP'
  | 'PhoChuTichUBND_TTPHCC'
  | 'PhoChuTichHDND'
  | 'TruongPhong'
  | 'PhoPhong'
  | 'ChuyenVien';
type ModuleKey = 'overview' | 'workcenter' | 'departments' | 'create-task' | 'reports' | 'activity-log';
type WorkcenterTab = 'incoming' | 'scheduled' | 'today' | 'week' | 'outgoing';
type DeptSubTab = 'phongban' | 'canbo' | 'taiviec';
type TaskStatus = 'Chua_Lam' | 'Dang_Xu_Ly' | 'Cho_Duyet' | 'Hoan_Thanh' | 'Tu_Choi';
type TaskPriority = 'Khan' | 'Cao' | 'Trung_Binh' | 'Thuong';
type TaskCategory = 'BAU' | 'Dot_Xuat' | 'Du_An';
type ShiftType = 'Sang' | 'Chieu';
type DepartmentCode = 'VAN_PHONG' | 'KINH_TE' | 'VAN_HOA_XA_HOI' | 'HANH_CHINH_CONG' | 'KHOI_DANG_DOAN_THE';

interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'danger' | 'info' | 'warning';
}

interface DepartmentInfo {
  code: DepartmentCode;
  name: string;
  shortName: string;
  headName: string;
  headTitle: string;
  icon: string;
  description: string;
  color: string;
  badgeBg: string;
}

const DEPARTMENTS: Record<DepartmentCode, DepartmentInfo> = {
  VAN_PHONG: {
    code: 'VAN_PHONG',
    name: 'Văn phòng HĐND & UBND',
    shortName: 'Văn phòng HĐND-UBND',
    headName: 'Nguyễn Đình Hùng',
    headTitle: 'Chánh Văn phòng xã',
    icon: 'landmark',
    description: 'Tham mưu tổng hợp, chỉ đạo công vụ, văn thư, tiếp công dân, thi đua khen thưởng.',
    color: '#2563eb',
    badgeBg: '#eff6ff',
  },
  KINH_TE: {
    code: 'KINH_TE',
    name: 'Phòng Kinh tế - Hạ tầng & Đô thị',
    shortName: 'Phòng Kinh tế',
    headName: 'Trần Thị Mai',
    headTitle: 'Trưởng phòng Địa chính - Xây dựng',
    icon: 'building',
    description: 'Quy hoạch, tài nguyên đất đai, trật tự xây dựng, nông nghiệp, tài chính - ngân sách.',
    color: '#d97706',
    badgeBg: '#fffbeb',
  },
  VAN_HOA_XA_HOI: {
    code: 'VAN_HOA_XA_HOI',
    name: 'Phòng Văn hóa - Xã hội',
    shortName: 'Phòng VH-XH',
    headName: 'Hoàng Văn Thái',
    headTitle: 'Trưởng phòng Văn hóa - Xã hội',
    icon: 'users',
    description: 'Văn hóa, y tế dự phòng, giáo dục mầm non/THCS, an sinh xã hội, chính sách người có công.',
    color: '#059669',
    badgeBg: '#ecfdf5',
  },
  HANH_CHINH_CONG: {
    code: 'HANH_CHINH_CONG',
    name: 'Trung tâm Phục vụ Hành chính công',
    shortName: 'TT Hành chính công',
    headName: 'Nguyễn Văn Nam',
    headTitle: 'Giám đốc Trung tâm 1 cửa',
    icon: 'file-signature',
    description: 'Đầu mối tiếp nhận, hỗ trợ số hóa và giải quyết 100% thủ tục hành chính cho người dân.',
    color: '#7c3aed',
    badgeBg: '#f5f3ff',
  },
  KHOI_DANG_DOAN_THE: {
    code: 'KHOI_DANG_DOAN_THE',
    name: 'Khối Đảng - HĐND - UBMTTQ',
    shortName: 'Khối Đảng & Mặt trận',
    headName: 'Lê Hoàng Anh',
    headTitle: 'Chánh Văn phòng Đảng ủy - HĐND - UBMTTQ',
    icon: 'award',
    description: 'Công tác cấp ủy, 02 Ban chuyên trách HĐND (Pháp chế, KT-XH) & Giám sát phản biện xã hội.',
    color: '#dc2626',
    badgeBg: '#fef2f2',
  },
};

interface Comment {
  id: string;
  author: string;
  authorInitials: string;
  text: string;
  time: string;
}

interface StatusChange {
  from: string;
  to: string;
  by: string;
  at: string;
  asRole: string;
}

interface TaskFile {
  name: string;
  size: string;
  type: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  assignedBy: string;
  assignedByRole: string;
  assignee: string;
  assigneeRole: string;
  collaborators: string[];
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  dueDate: string;
  shift: ShiftType;
  startTime: string;
  createdDate: string;
  progress: number;
  effortHours: number;
  attachments: string[];
  comments: Comment[];
  statusHistory: StatusChange[];
  submissionNote?: string;
  systemScore?: number;
  evaluatorScore?: number;
  rating?: number;
  ratingScore?: number;
  rejectionReason?: string;
  context: RoleCode;
  sourceInboxId?: string;
}

interface Staff {
  id: string;
  name: string;
  initials: string;
  role: string;
  departmentCode: DepartmentCode;
  departmentName: string;
  specialization: string;
  rankLabel: string;
  phone: string;
  email: string;
  assignedHours: number;
  maxHours: number;
  tasksCount: number;
  completedOnTime: number;
  totalCompleted: number;
  score: number;
  avatarBg: string;
}

interface ActivityItem {
  id: string;
  text: string;
  time: string;
  type: 'task' | 'approve' | 'comment' | 'overdue' | 'system';
}

/* ═══════════════════════════════════════════════════════════════
   ROLE CONFIG
   ═══════════════════════════════════════════════════════════════ */

const ROLE_CONFIG: Record<RoleCode, { label: string; shortLabel: string; org: string; scopeLevel: number }> = {
  // ── CẤP 1.0: BÍ THƯ ĐẢNG ỦY ──
  BiThu: { label: 'Bí thư Đảng ủy xã', shortLabel: 'BT ĐU', org: 'Đảng ủy Xã Cát Ngạn', scopeLevel: 1.0 },
  BiThuDU: { label: 'Bí thư Đảng ủy xã', shortLabel: 'BT ĐU', org: 'Đảng ủy Xã Cát Ngạn', scopeLevel: 1.0 },
  // ── CẤP 1.5: CHỦ TỊCH ──
  ChuTichUBND: { label: 'Chủ tịch UBND xã', shortLabel: 'CT UBND', org: 'UBND Xã Cát Ngạn', scopeLevel: 1.5 },
  ChuTichHDND: { label: 'Chủ tịch HĐND xã', shortLabel: 'CT HĐND', org: 'HĐND Xã Cát Ngạn', scopeLevel: 1.5 },
  // ── CẤP 2.0: PHÓ CHỦ TỊCH ──
  PhoChuTichUBND: { label: 'Phó Chủ tịch UBND xã', shortLabel: 'PCT UBND', org: 'UBND Xã Cát Ngạn', scopeLevel: 2.0 },
  PhoChuTichUBND_ChanhVP: { label: 'Phó CT UBND (kiêm Chánh VP HĐND&UBND)', shortLabel: 'PCT UBND-CVP', org: 'UBND Xã Cát Ngạn', scopeLevel: 2.0 },
  PhoChuTichUBND_TTPHCC: { label: 'Phó CT UBND (kiêm GĐ TT PHCC)', shortLabel: 'PCT UBND-HCC', org: 'UBND Xã Cát Ngạn', scopeLevel: 2.0 },
  PhoChuTichHDND: { label: 'Phó CT HĐND xã (chuyên trách)', shortLabel: 'PCT HĐND', org: 'HĐND Xã Cát Ngạn', scopeLevel: 2.0 },
  // ── CẤP 2.5: TRƯỞNG PHÒNG/BAN ──
  TruongPhong: { label: 'Trưởng phòng', shortLabel: 'TP', org: 'Phòng/Ban trực thuộc', scopeLevel: 2.5 },
  // ── CẤP 3.0: PHÓ TRƯỞNG PHÒNG/BAN ──
  PhoPhong: { label: 'Phó Trưởng phòng', shortLabel: 'PTP', org: 'Phòng/Ban trực thuộc', scopeLevel: 3.0 },
  // ── CẤP 4.0: CHUYÊN VIÊN ──
  ChuyenVien: { label: 'Chuyên viên', shortLabel: 'CV', org: 'Văn phòng HĐND & UBND', scopeLevel: 4.0 },
};

/* ═══════════════════════════════════════════════════════════════
   SAMPLE DATA (HIGH DENSITY TEST: SUNDAY CA SÁNG & CA CHIỀU CO NHIỀU VIỆC)
   ═══════════════════════════════════════════════════════════════ */

const SAMPLE_TASKS: Task[] = [
  {
    id: 'CV-2026-101',
    title: 'Tổ chức hội nghị đối thoại nhân dân xã Cát Ngạn quý III/2026',
    description: 'Tổ chức hội nghị đối thoại trực tiếp giữa Chủ tịch UBND xã với nhân dân theo Quy chế dân chủ ở cơ sở.',
    assignedBy: 'Nguyễn Đình Hùng',
    assignedByRole: 'Chủ tịch UBND xã',
    assignee: 'Nguyễn Văn Nam',
    assigneeRole: 'Chuyên viên Văn phòng',
    collaborators: ['Trần Thị Mai', 'Lê Hoàng Anh'],
    priority: 'Khan',
    status: 'Dang_Xu_Ly',
    category: 'Dot_Xuat',
    dueDate: '2026-07-28',
    shift: 'Sang',
    startTime: '08:00',
    createdDate: '2026-07-20',
    progress: 65,
    effortHours: 16,
    attachments: ['Ke_hoach_doi_thoai_Q3.docx'],
    comments: [],
    statusHistory: [],
    context: 'ChuTichUBND',
  },
  {
    id: 'CV-2026-102',
    title: 'Rà soát hiện trạng sử dụng đất khu vực cầu Cát Ngạn',
    description: 'Kiểm tra, xác minh ranh giới, hiện trạng lấn chiếm hành lang bảo vệ cầu Cát Ngạn theo phản ánh của cử tri.',
    assignedBy: 'Nguyễn Đình Hùng',
    assignedByRole: 'Chủ tịch UBND xã',
    assignee: 'Trần Thị Mai',
    assigneeRole: 'Trưởng phòng Địa chính',
    collaborators: ['Phạm Đức Minh'],
    priority: 'Cao',
    status: 'Dang_Xu_Ly',
    category: 'Du_An',
    dueDate: '2026-07-29',
    shift: 'Chieu',
    startTime: '14:00',
    createdDate: '2026-07-22',
    progress: 40,
    effortHours: 12,
    attachments: ['Trich_do_do_dac_CauCatNgan.pdf'],
    comments: [],
    statusHistory: [],
    context: 'ChuTichUBND',
  },
  /* ── SUNDAY (26/07) CA SÁNG - HIGH DENSITY 4 TASKS ── */
  {
    id: 'CV-2026-103',
    title: 'Tổng hợp báo cáo tiến độ giải ngân vốn đầu tư công tháng 7/2026',
    description: 'Tổng hợp số liệu giải ngân 04 công trình xây dựng nông thôn mới nâng cao trên địa bàn xã.',
    assignedBy: 'Trần Thị Mai',
    assignedByRole: 'Trưởng phòng Địa chính',
    assignee: 'Vũ Thị Hương',
    assigneeRole: 'Chuyên viên Kế toán',
    collaborators: [],
    priority: 'Khan',
    status: 'Cho_Duyet',
    category: 'BAU',
    dueDate: '2026-07-26',
    shift: 'Sang',
    startTime: '08:00',
    createdDate: '2026-07-24',
    progress: 90,
    effortHours: 8,
    attachments: ['Bao_cao_giai_ngan_T7.xlsx'],
    comments: [],
    statusHistory: [],
    context: 'TruongPhong',
  },
  {
    id: 'CV-2026-106',
    title: 'Chỉ đạo phân luồng giao thông chợ phiên xã Cát Ngạn',
    description: 'Phối hợp với Công an xã phân luồng giao thông và sắp xếp các gian hàng kinh doanh khu vực chợ phiên.',
    assignedBy: 'Nguyễn Đình Hùng',
    assignedByRole: 'Chủ tịch UBND xã',
    assignee: 'Phạm Đức Minh',
    assigneeRole: 'Chuyên viên Tư pháp',
    collaborators: [],
    priority: 'Cao',
    status: 'Dang_Xu_Ly',
    category: 'Dot_Xuat',
    dueDate: '2026-07-26',
    shift: 'Sang',
    startTime: '08:30',
    createdDate: '2026-07-25',
    progress: 50,
    effortHours: 4,
    attachments: [],
    comments: [],
    statusHistory: [],
    context: 'ChuTichUBND',
  },
  {
    id: 'CV-2026-107',
    title: 'Tiếp công dân định kỳ tuần 4 tháng 7/2026 tại Bộ phận 1 Cửa',
    description: 'Chủ trì buổi tiếp công dân định kỳ, lắng nghe và tiếp nhận 08 đơn thư khiếu nại đất đai.',
    assignedBy: 'Nguyễn Đình Hùng',
    assignedByRole: 'Chủ tịch UBND xã',
    assignee: 'Nguyễn Văn Nam',
    assigneeRole: 'Giám đốc TT / CV Văn phòng',
    collaborators: ['Trần Thị Mai'],
    priority: 'Khan',
    status: 'Dang_Xu_Ly',
    category: 'BAU',
    dueDate: '2026-07-26',
    shift: 'Sang',
    startTime: '09:15',
    createdDate: '2026-07-25',
    progress: 70,
    effortHours: 6,
    attachments: ['So_tiep_cong_dan_T7.pdf'],
    comments: [],
    statusHistory: [],
    context: 'ChuTichUBND',
  },
  {
    id: 'CV-2026-108',
    title: 'Kiểm tra công tác phòng chống dịch bệnh gia súc gia cầm thôn Ngạn Sơn',
    description: 'Kiểm tra công tác phun khử trùng tiêu độc tại 4 trang trại chăn nuôi tập trung.',
    assignedBy: 'Hoàng Văn Thái',
    assignedByRole: 'Trưởng phòng VH-XH',
    assignee: 'Hoàng Văn Thái',
    assigneeRole: 'Trưởng phòng VH-XH',
    collaborators: [],
    priority: 'Trung_Binh',
    status: 'Dang_Xu_Ly',
    category: 'BAU',
    dueDate: '2026-07-26',
    shift: 'Sang',
    startTime: '10:30',
    createdDate: '2026-07-25',
    progress: 30,
    effortHours: 4,
    attachments: [],
    comments: [],
    statusHistory: [],
    context: 'ChuTichUBND',
  },

  /* ── SUNDAY (26/07) CA CHIỀU - HIGH DENSITY 3 TASKS ── */
  {
    id: 'CV-2026-104',
    title: 'Thẩm định hồ sơ trợ cấp xã hội tháng 8/2026 cho 15 đối tượng chính sách',
    description: 'Thẩm định hồ sơ đề nghị hưởng trợ cấp xã hội hằng tháng đối với người cao tuổi.',
    assignedBy: 'Hoàng Văn Thái',
    assignedByRole: 'Trưởng phòng VH-XH',
    assignee: 'Hoàng Văn Thái',
    assigneeRole: 'Trưởng phòng VH-XH',
    collaborators: [],
    priority: 'Thuong',
    status: 'Hoan_Thanh',
    category: 'BAU',
    dueDate: '2026-07-26',
    shift: 'Chieu',
    startTime: '13:30',
    createdDate: '2026-07-21',
    progress: 100,
    effortHours: 6,
    attachments: ['Danh_sach_tro_cap_T8.docx'],
    comments: [],
    statusHistory: [],
    context: 'ChuTichUBND',
  },
  {
    id: 'CV-2026-105',
    title: 'Tổng kết công tác giám sát phản biện xã hội Quý II của UBMTTQ xã',
    description: 'Xây dựng báo cáo kết quả giám sát việc thực hiện chính sách hỗ trợ sản xuất nông nghiệp.',
    assignedBy: 'Lê Hoàng Anh',
    assignedByRole: 'CV Văn phòng Đảng ủy',
    assignee: 'Lê Hoàng Anh',
    assigneeRole: 'CV Văn phòng Đảng ủy',
    collaborators: [],
    priority: 'Cao',
    status: 'Hoan_Thanh',
    category: 'BAU',
    dueDate: '2026-07-26',
    shift: 'Chieu',
    startTime: '14:45',
    createdDate: '2026-07-20',
    progress: 100,
    effortHours: 10,
    attachments: ['Bao_cao_giam_sat_MTTQ.pdf'],
    comments: [],
    statusHistory: [],
    context: 'ChuTichUBND',
  },
  {
    id: 'CV-2026-109',
    title: 'Họp Giao ban Thường trực HĐND - UBND xã mở rộng',
    description: 'Đánh giá công tác lãnh đạo điều hành tháng 7 và triển khai nhiệm vụ trọng tâm tháng 8/2026.',
    assignedBy: 'Nguyễn Đình Hùng',
    assignedByRole: 'Chủ tịch UBND xã',
    assignee: 'Trần Thị Mai',
    assigneeRole: 'Trưởng phòng Địa chính',
    collaborators: ['Lê Hoàng Anh', 'Nguyễn Văn Nam'],
    priority: 'Cao',
    status: 'Dang_Xu_Ly',
    category: 'BAU',
    dueDate: '2026-07-26',
    shift: 'Chieu',
    startTime: '16:00',
    createdDate: '2026-07-25',
    progress: 80,
    effortHours: 3,
    attachments: ['Nghi_quyet_giao_ban_T7.pdf'],
    comments: [],
    statusHistory: [],
    context: 'ChuTichUBND',
  },
];

const SAMPLE_STAFF: Staff[] = [
  {
    id: 'CB-1',
    name: 'Nguyễn Văn Nam',
    initials: 'NN',
    role: 'Giám đốc TT / CV Văn phòng',
    departmentCode: 'HANH_CHINH_CONG',
    departmentName: 'Trung tâm Phục vụ Hành chính công',
    specialization: 'Thủ tục Hành chính & Số hóa hồ sơ',
    rankLabel: 'Chuyên viên chính',
    phone: '0912 345 678',
    email: 'nam.nv@catngan.gov.vn',
    assignedHours: 44,
    maxHours: 40,
    tasksCount: 3,
    completedOnTime: 14,
    totalCompleted: 15,
    score: 9.2,
    avatarBg: '#eff6ff',
  },
  {
    id: 'CB-2',
    name: 'Trần Thị Mai',
    initials: 'TM',
    role: 'Trưởng phòng Kinh tế & Địa chính',
    departmentCode: 'KINH_TE',
    departmentName: 'Phòng Kinh tế - Hạ tầng & Đô thị',
    specialization: 'Đất đai, Quy hoạch & GPMB',
    rankLabel: 'Chuyên viên chính',
    phone: '0987 654 321',
    email: 'mai.tt@catngan.gov.vn',
    assignedHours: 24,
    maxHours: 40,
    tasksCount: 1,
    completedOnTime: 10,
    totalCompleted: 10,
    score: 9.8,
    avatarBg: '#fffbeb',
  },
  {
    id: 'CB-3',
    name: 'Lê Hoàng Anh',
    initials: 'LA',
    role: 'CV Văn phòng Đảng ủy',
    departmentCode: 'KHOI_DANG_DOAN_THE',
    departmentName: 'Khối Đảng - HĐND - UBMTTQ',
    specialization: 'Công tác Đảng & Giám sát MTTQ',
    rankLabel: 'Chuyên viên',
    phone: '0976 543 210',
    email: 'anh.lh@catngan.gov.vn',
    assignedHours: 12,
    maxHours: 40,
    tasksCount: 1,
    completedOnTime: 8,
    totalCompleted: 9,
    score: 8.5,
    avatarBg: '#fef2f2',
  },
  {
    id: 'CB-4',
    name: 'Phạm Đức Minh',
    initials: 'PM',
    role: 'Chuyên viên Tư pháp - Hộ tịch',
    departmentCode: 'VAN_PHONG',
    departmentName: 'Văn phòng HĐND & UBND',
    specialization: 'Tư pháp, Chứng thực & Hòa giải',
    rankLabel: 'Chuyên viên',
    phone: '0965 432 109',
    email: 'minh.pd@catngan.gov.vn',
    assignedHours: 10,
    maxHours: 40,
    tasksCount: 1,
    completedOnTime: 5,
    totalCompleted: 8,
    score: 6.0,
    avatarBg: '#f5f3ff',
  },
  {
    id: 'CB-5',
    name: 'Hoàng Văn Thái',
    initials: 'HT',
    role: 'Trưởng phòng Văn hóa - Xã hội',
    departmentCode: 'VAN_HOA_XA_HOI',
    departmentName: 'Phòng Văn hóa - Xã hội',
    specialization: 'Giáo dục, Y tế & An sinh xã hội',
    rankLabel: 'Chuyên viên chính',
    phone: '0954 321 098',
    email: 'thai.hv@catngan.gov.vn',
    assignedHours: 28,
    maxHours: 40,
    tasksCount: 2,
    completedOnTime: 12,
    totalCompleted: 13,
    score: 9.1,
    avatarBg: '#ecfdf5',
  },
  {
    id: 'CB-6',
    name: 'Vũ Thị Hương',
    initials: 'VH',
    role: 'Chuyên viên Kế toán - Dự toán',
    departmentCode: 'KINH_TE',
    departmentName: 'Phòng Kinh tế - Hạ tầng & Đô thị',
    specialization: 'Tài chính công, Ngân sách & Đầu tư',
    rankLabel: 'Chuyên viên',
    phone: '0943 210 987',
    email: 'huong.vt@catngan.gov.vn',
    assignedHours: 18,
    maxHours: 40,
    tasksCount: 1,
    completedOnTime: 15,
    totalCompleted: 15,
    score: 9.5,
    avatarBg: '#fffbeb',
  },
  {
    id: 'CB-7',
    name: 'Đặng Văn Lộc',
    initials: 'ĐL',
    role: 'Phó Trưởng phòng Địa chính - Xây dựng',
    departmentCode: 'KINH_TE',
    departmentName: 'Phòng Kinh tế - Hạ tầng & Đô thị',
    specialization: 'Xây dựng, Quy hoạch & Trật tự đô thị',
    rankLabel: 'Phó Trưởng phòng',
    phone: '0932 109 876',
    email: 'loc.dv@catngan.gov.vn',
    assignedHours: 22,
    maxHours: 40,
    tasksCount: 2,
    completedOnTime: 9,
    totalCompleted: 10,
    score: 8.8,
    avatarBg: '#ecfdf5',
  },
  {
    id: 'CB-8',
    name: 'Lê Văn Bình',
    initials: 'LB',
    role: 'Phó Chủ tịch UBND (Chánh VP HĐND&UBND)',
    departmentCode: 'VAN_PHONG',
    departmentName: 'UBND Xã Cát Ngạn',
    specialization: 'Điều hành nội vụ, Văn phòng & Hành chính',
    rankLabel: 'Phó Chủ tịch UBND',
    phone: '0921 098 765',
    email: 'binh.lv@catngan.gov.vn',
    assignedHours: 32,
    maxHours: 40,
    tasksCount: 3,
    completedOnTime: 16,
    totalCompleted: 17,
    score: 9.3,
    avatarBg: '#eff6ff',
  },
  {
    id: 'CB-9',
    name: 'Nguyễn Thị Lan',
    initials: 'NL',
    role: 'Phó Chủ tịch UBND (GĐ Trung tâm PHCC)',
    departmentCode: 'HANH_CHINH_CONG',
    departmentName: 'Trung tâm Phục vụ Hành chính công',
    specialization: 'Cải cách hành chính & Phục vụ công dân',
    rankLabel: 'Phó Chủ tịch UBND',
    phone: '0910 987 654',
    email: 'lan.nt@catngan.gov.vn',
    assignedHours: 30,
    maxHours: 40,
    tasksCount: 2,
    completedOnTime: 11,
    totalCompleted: 12,
    score: 9.0,
    avatarBg: '#f0fdfa',
  },
  {
    id: 'CB-10',
    name: 'Phạm Văn Đức',
    initials: 'PĐ',
    role: 'Phó Chủ tịch HĐND xã (chuyên trách)',
    departmentCode: 'KHOI_DANG_DOAN_THE',
    departmentName: 'HĐND Xã Cát Ngạn',
    specialization: 'Giám sát HĐND, Kiến nghị cử tri & Pháp chế',
    rankLabel: 'Phó Chủ tịch HĐND',
    phone: '0909 876 543',
    email: 'duc.pv@catngan.gov.vn',
    assignedHours: 20,
    maxHours: 40,
    tasksCount: 1,
    completedOnTime: 8,
    totalCompleted: 9,
    score: 8.7,
    avatarBg: '#fefce8',
  },
];

const SAMPLE_ACTIVITIES: ActivityItem[] = [
  { id: 'a1', text: 'Lê Hoàng Anh nộp báo cáo "Tổng kết công tác Đảng bộ T7" — chờ Bí thư duyệt', time: '25/07 - 16:00', type: 'task' },
  { id: 'a2', text: 'Chủ tịch UBND nghiệm thu công việc "Tổng hợp thu ngân sách T7" — Đạt yêu cầu', time: '25/07 - 08:30', type: 'approve' },
  { id: 'a3', text: 'Phạm Đức Minh bình luận trên "Danh sách cử tri thôn Ngạn Sơn"', time: '25/07 - 10:45', type: 'comment' },
  { id: 'a4', text: '⚠️ Ca Sáng (26/07) hiện có 4 công việc phát sinh trùng ca!', time: '26/07 - 07:00', type: 'overdue' },
  { id: 'a5', text: 'Hệ thống nhắc nhở tự động: 3 công việc cần xử lý trong tuần này', time: '26/07 - 06:00', type: 'system' },
];

/* ═══════════════════════════════════════════════════════════════
   HELPER FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

const STATUS_LABELS: Record<TaskStatus, string> = {
  Chua_Lam: 'Chờ làm', Dang_Xu_Ly: 'Đang xử lý', Cho_Duyet: 'Chờ duyệt',
  Hoan_Thanh: 'Hoàn thành', Tu_Choi: 'Từ chối — Yêu cầu làm lại',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  Khan: 'KHẨN CẤP', Cao: 'ƯU TIÊN CAO', Trung_Binh: 'TRUNG BÌNH', Thuong: 'THƯỜNG',
};

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  BAU: 'Thường ngày', Dot_Xuat: 'Đột xuất', Du_An: 'Dự án trọng điểm',
};

const SHIFT_CONFIG: Record<ShiftType, { label: string; timeHint: string; icon: string; class: string }> = {
  Sang: { label: 'SÁNG', timeHint: '07:00 — 11:30', icon: 'sun', class: 'shift-label-morning' },
  Chieu: { label: 'CHIỀU', timeHint: '13:00 — 17:00', icon: 'cloud-sun', class: 'shift-label-afternoon' },
};

const getPriorityBadge = (p: TaskPriority) => {
  switch (p) {
    case 'Khan': return 'badge-urgent';
    case 'Cao': return 'badge-high';
    case 'Trung_Binh': return 'badge-medium';
    default: return 'badge-low';
  }
};

const getStatusBadge = (s: TaskStatus) => {
  switch (s) {
    case 'Chua_Lam': return 'badge-low';
    case 'Dang_Xu_Ly': return 'badge-medium';
    case 'Cho_Duyet': return 'badge-purple';
    case 'Hoan_Thanh': return 'badge-success';
    case 'Tu_Choi': return 'badge-urgent';
  }
};

const getCategoryBadge = (c: TaskCategory) => {
  switch (c) {
    case 'BAU': return 'badge-low';
    case 'Dot_Xuat': return 'badge-high';
    case 'Du_An': return 'badge-medium';
  }
};

const getDaysUntilDue = (dueDate: string) => {
  const [y1, m1, d1] = '2026-07-26'.split('-').map(Number);
  const [y2, m2, d2] = dueDate.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.ceil((t2 - t1) / (1000 * 60 * 60 * 24));
};

/**
 * Định dạng ngày theo chuẩn Việt Nam (DD/MM/YYYY) sử dụng múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 */
const formatDateDisplay = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  try {
    const dt = new Date(dateStr);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  } catch (e) { }
  return dateStr;
};

/**
 * Định dạng ngày giờ theo chuẩn Việt Nam (HH:mm DD/MM/YYYY) sử dụng múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 */
const formatDateTimeDisplay = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  try {
    const dt = new Date(dateStr);
    if (!isNaN(dt.getTime())) {
      const timePart = dt.toLocaleTimeString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const datePart = dt.toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      return `${timePart} ${datePart}`;
    }
  } catch (e) { }
  return dateStr;
};

interface EvaluationTier {
  level: number;
  code: string;
  label: string;
  subText: string;
  badgeClass: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const EVALUATION_TIERS: EvaluationTier[] = [
  {
    level: 1,
    code: 'XUAT_SAC',
    label: 'XUẤT SẮC',
    subText: 'Hoàn thành xuất sắc (9.0 – 10.0 điểm) — Vượt tiến độ & chất lượng xuất sắc',
    badgeClass: 'badge-success',
    icon: 'award',
    color: '#047857',
    bgColor: '#ecfdf5',
    borderColor: '1px solid #a7f3d0',
  },
  {
    level: 2,
    code: 'TOT',
    label: 'TỐT',
    subText: 'Hoàn thành tốt (7.5 – 8.9 điểm) — Đảm bảo đúng tiến độ & chất lượng',
    badgeClass: 'badge-blue',
    icon: 'star',
    color: '#1d4ed8',
    bgColor: '#eff6ff',
    borderColor: '1px solid #bfdbfe',
  },
  {
    level: 3,
    code: 'DAT',
    label: 'ĐẠT YÊU CẦU',
    subText: 'Hoàn thành nhiệm vụ (6.0 – 7.4 điểm) — Đạt mức yêu cầu cơ bản',
    badgeClass: 'badge-medium',
    icon: 'thumbs-up',
    color: '#b45309',
    bgColor: '#fffbeb',
    borderColor: '1px solid #fde68a',
  },
  {
    level: 4,
    code: 'CAN_CAI_THIEN',
    label: 'CẦN CẢI THIỆN',
    subText: 'Cần cải thiện (4.0 – 5.9 điểm) — Chậm tiến độ hoặc cần sửa đổi',
    badgeClass: 'badge-warning',
    icon: 'triangle-exclamation',
    color: '#c2410c',
    bgColor: '#fff7ed',
    borderColor: '1px solid #fed7aa',
  },
  {
    level: 5,
    code: 'CHUA_DAT',
    label: 'CHƯA ĐẠT',
    subText: 'Không hoàn thành (< 4.0 điểm) — Không đạt yêu cầu nhiệm vụ',
    badgeClass: 'badge-urgent',
    icon: 'circle-xmark',
    color: '#b91c1c',
    bgColor: '#fef2f2',
    borderColor: '1px solid #fecaca',
  },
];

function getEvaluationTier(score: number): EvaluationTier {
  const normalized = score > 10.0 ? score / 10.0 : score;
  if (normalized >= 9.0) return EVALUATION_TIERS[0];
  if (normalized >= 7.5) return EVALUATION_TIERS[1];
  if (normalized >= 6.0) return EVALUATION_TIERS[2];
  if (normalized >= 4.0) return EVALUATION_TIERS[3];
  return EVALUATION_TIERS[4];
}

const getGradLabel = (score: number) => {
  const tier = getEvaluationTier(score);
  return { label: `Mức ${tier.level}: ${tier.label}`, badge: tier.badgeClass, tier };
};

const getWeekDays = (mondayStr: string) => {
  const [y, m, d] = mondayStr.split('-').map(Number);
  const days = [];
  const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const iso = dt.toISOString().split('T')[0];
    const displayNum = String(dt.getUTCDate()).padStart(2, '0');
    const displayMonth = String(dt.getUTCMonth() + 1).padStart(2, '0');
    days.push({
      dateStr: iso,
      dayName: dayNames[i],
      dayNumber: `${displayNum}/${displayMonth}`,
      fullDateDisplay: `${dayNames[i]} (${displayNum}/${displayMonth})`,
      isToday: iso === '2026-07-26',
      isPast: iso < '2026-07-26',
    });
  }
  return days;
};

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ═══════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════
   MOCK DATA: HỘP THƯ VĂN BẢN & YÊU CẦU (INBOX)
   ═══════════════════════════════════════════════════════════════ */
export type InboxStatus = 'unread' | 'read' | 'scheduled' | 'assigned';
export type InboxFolder = 'inbox' | 'scheduled' | 'assigned' | 'starred';

export interface InboxItem {
  id: string;
  senderName: string;
  senderOrg: string;
  date: string;
  subject: string;
  content: string;
  status: InboxStatus;
  folder: InboxFolder;
  isStarred: boolean;
  isUrgent: boolean;
  attachments: { name: string; size: string; type: string; url?: string }[];
  deadline?: string;
  documentNumber?: string;
  documentSymbol?: string;
  issuingAgency?: string;
  signerName?: string;
  issuedDate?: string;
  category?: string;
}

const SAMPLE_INBOX: InboxItem[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    senderName: 'Vũ Đức Đam',
    senderOrg: 'UBND Huyện Đức Thọ',
    documentNumber: '125',
    documentSymbol: 'UBND-VP',
    issuingAgency: 'UBND Huyện Đức Thọ',
    signerName: 'Nguyễn Văn A',
    issuedDate: '2026-08-05',
    category: 'Công văn',
    date: '05/08/2026 08:30',
    subject: 'Yêu cầu phối hợp kiểm tra hiện trạng sử dụng đất khu vực cầu Cát Ngạn',
    content: 'Yêu cầu UBND Xã Cát Ngạn khẩn trương rà soát hiện trạng sử dụng đất tại khu vực cầu Cát Ngạn, lập danh sách các trường hợp vi phạm và báo cáo về UBND Huyện trước ngày 25/08/2026.',
    status: 'scheduled',
    folder: 'scheduled',
    isStarred: true,
    isUrgent: true,
    deadline: '2026-08-21',
    attachments: [{ name: 'CongVan_125_UBND_VP.pdf', size: '2.4 MB', type: 'pdf' }]
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    senderName: 'Vũ Đức Đam',
    senderOrg: 'UBND Tỉnh',
    documentNumber: '03',
    documentSymbol: 'CĐ-UBND',
    issuingAgency: 'UBND Tỉnh Hà Tĩnh',
    signerName: 'Vũ Đức Đam',
    issuedDate: '2026-08-05',
    category: 'Công điện',
    date: '05/08/2026 08:30',
    subject: 'Công điện khẩn về việc phòng chống bão số 3',
    content: 'Yêu cầu các địa phương khẩn trương rà soát các hộ dân vùng trũng, lên phương án sơ tán an toàn trước 17h chiều nay. Đảm bảo lực lượng túc trực 24/24 tại trụ sở.',
    status: 'unread',
    folder: 'inbox',
    isStarred: true,
    isUrgent: true,
    deadline: '2026-08-05',
    attachments: [{ name: 'CongDien_BaoSo3.pdf', size: '2.4 MB', type: 'pdf' }]
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    senderName: 'Nguyễn Văn A',
    senderOrg: 'Sở Tài Nguyên & Môi Trường',
    documentNumber: '48',
    documentSymbol: 'STNMT-QLĐĐ',
    issuingAgency: 'Sở Tài Nguyên & Môi Trường',
    signerName: 'Nguyễn Văn A',
    issuedDate: '2026-08-04',
    category: 'Thông báo',
    date: '04/08/2026 14:15',
    subject: 'Hướng dẫn mới về phân loại rác thải tại nguồn',
    content: 'Gửi UBND Xã tài liệu hướng dẫn phân loại rác thải tại nguồn áp dụng từ quý 4/2026. Đề nghị chủ tịch phân công cán bộ chuyên môn nghiên cứu và triển khai đến từng thôn bản.',
    status: 'read',
    folder: 'inbox',
    isStarred: false,
    isUrgent: false,
    deadline: '2026-08-15',
    attachments: [{ name: 'HD_PhanLoaiRac.docx', size: '1.1 MB', type: 'doc' }, { name: 'Poster_TuyenTruyen.png', size: '4.5 MB', type: 'image' }]
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    senderName: 'Trần Thị B',
    senderOrg: 'Phòng Tài Chính - Kế Hoạch Huyện',
    documentNumber: '89',
    documentSymbol: 'STC-HCSN',
    issuingAgency: 'Phòng Tài Chính - Kế Hoạch Huyện',
    signerName: 'Trần Thị B',
    issuedDate: '2026-08-03',
    category: 'Báo cáo',
    date: '03/08/2026 09:00',
    subject: 'Báo cáo giải ngân vốn đầu tư công tháng 7',
    content: 'Yêu cầu UBND Xã khẩn trương tổng hợp số liệu giải ngân vốn đầu tư công các công trình trên địa bàn trong tháng 7/2026. Nộp báo cáo trước ngày mùng 5.',
    status: 'assigned',
    folder: 'assigned',
    isStarred: false,
    isUrgent: true,
    deadline: '2026-08-05',
    attachments: [{ name: 'MauBaoCao_GiaiNgan.xlsx', size: '120 KB', type: 'excel' }]
  }
];

export default function DashboardPage() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // --- States ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeRole, setActiveRole] = useState<RoleCode>('BiThuDU');
  const [activeModule, setActiveModule] = useState<ModuleKey>('overview');
  const [workcenterTab, setWorkcenterTab] = useState<WorkcenterTab>('incoming');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Workcenter / Inbox Pagination States
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxTotalCount, setInboxTotalCount] = useState(0);
  const [inboxHasMore, setInboxHasMore] = useState(true);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(SAMPLE_TASKS);

  // ── Flag Ẩn/Hiện Nhật Ký Hoạt Động trên Tổng Quan (Giao diện đơn giản & gọn gàng) ──
  const SHOW_ACTIVITY_LOG = false;

  // ── Single Source of Truth for Staff Workloads (Derived dynamically from tasks state) ──
  const staffWorkload = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach(t => {
      if (t.status !== 'Hoan_Thanh' && t.status !== 'Tu_Choi') {
        map.set(t.assignee, (map.get(t.assignee) || 0) + (t.effortHours || 8));
      }
    });
    return map;
  }, [tasks]);

  const activeStaffList = useMemo(() => {
    return SAMPLE_STAFF.map(s => ({
      ...s,
      assignedHours: staffWorkload.get(s.name) ?? 0,
    }));
  }, [staffWorkload]);

  const [myDaySearchQuery, setMyDaySearchQuery] = useState('');
  const [myDayStatusFilter, setMyDayStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [myDayPriorityFilter, setMyDayPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [myDayShiftFilter, setMyDayShiftFilter] = useState<ShiftType | 'all'>('all');
  const [myDayCurrentPage, setMyDayCurrentPage] = useState(1);
  const [myDayPageSize, setMyDayPageSize] = useState(10);

  const myDayFilteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (myDaySearchQuery.trim()) {
        const q = myDaySearchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchId = t.id.toLowerCase().includes(q);
        const matchAssigner = t.assignedBy.toLowerCase().includes(q);
        const matchDesc = t.description ? t.description.toLowerCase().includes(q) : false;
        if (!matchTitle && !matchId && !matchAssigner && !matchDesc) return false;
      }
      if (myDayStatusFilter !== 'all' && t.status !== myDayStatusFilter) return false;
      if (myDayPriorityFilter !== 'all' && t.priority !== myDayPriorityFilter) return false;
      if (myDayShiftFilter !== 'all' && t.shift !== myDayShiftFilter) return false;
      return true;
    });
  }, [tasks, myDaySearchQuery, myDayStatusFilter, myDayPriorityFilter, myDayShiftFilter]);

  const myDayTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(myDayFilteredTasks.length / myDayPageSize));
  }, [myDayFilteredTasks.length, myDayPageSize]);

  const myDayPaginatedTasks = useMemo(() => {
    const start = (myDayCurrentPage - 1) * myDayPageSize;
    return myDayFilteredTasks.slice(start, start + myDayPageSize);
  }, [myDayFilteredTasks, myDayCurrentPage, myDayPageSize]);

  const handleMyDaySearchChange = (val: string) => {
    setMyDaySearchQuery(val);
    setMyDayCurrentPage(1);
  };
  const handleMyDayStatusChange = (val: TaskStatus | 'all') => {
    setMyDayStatusFilter(val);
    setMyDayCurrentPage(1);
  };
  const handleMyDayPriorityChange = (val: TaskPriority | 'all') => {
    setMyDayPriorityFilter(val);
    setMyDayCurrentPage(1);
  };
  const handleMyDayShiftChange = (val: ShiftType | 'all') => {
    setMyDayShiftFilter(val);
    setMyDayCurrentPage(1);
  };
  const handleMyDayResetFilters = () => {
    setMyDaySearchQuery('');
    setMyDayStatusFilter('all');
    setMyDayPriorityFilter('all');
    setMyDayShiftFilter('all');
    setMyDayCurrentPage(1);
  };
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [shiftFilter, setShiftFilter] = useState<ShiftType | 'all'>('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<DepartmentCode | 'ALL'>('ALL');
  const [deptSubTab, setDeptSubTab] = useState<DeptSubTab>('phongban');

  // ── Staff Module Paginated & Filter States ──
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [roleCodeFilter, setRoleCodeFilter] = useState('ALL');
  const [workloadFilter, setWorkloadFilter] = useState('ALL');
  const [userPage, setUserPage] = useState(1);
  const [paginatedUsersList, setPaginatedUsersList] = useState<PaginatedUserDto[]>([]);
  const [userTotalCount, setUserTotalCount] = useState(0);
  const [userHasMore, setUserHasMore] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [overloadedCountBadge, setOverloadedCountBadge] = useState(0);

  // ── Outgoing Documents (Văn Bản Đi) States ──
  const [outgoingDocsList, setOutgoingDocsList] = useState<OutgoingDocumentDto[]>([]);
  const [outgoingSearch, setOutgoingSearch] = useState('');
  const [debouncedOutgoingSearch, setDebouncedOutgoingSearch] = useState('');
  const [outgoingStatusFilter, setOutgoingStatusFilter] = useState<string>('ALL');
  const [outgoingTypeFilter, setOutgoingTypeFilter] = useState<string>('ALL');
  const [outgoingPage, setOutgoingPage] = useState(1);
  const [outgoingTotalCount, setOutgoingTotalCount] = useState(0);
  const [outgoingHasMore, setOutgoingHasMore] = useState(false);
  const [outgoingLoading, setOutgoingLoading] = useState(false);

  // Outgoing Modals State
  const [showCreateOutgoingModal, setShowCreateOutgoingModal] = useState(false);
  const [editingOutgoingDoc, setEditingOutgoingDoc] = useState<OutgoingDocumentDto | null>(null);
  const [formDocType, setFormDocType] = useState<DocumentTypeEnum>('CongVan');
  const [formDocTitle, setFormDocTitle] = useState('');
  const [formDocContent, setFormDocContent] = useState('');
  const [formDocRecipient, setFormDocRecipient] = useState('');
  const [formDocIsUrgent, setFormDocIsUrgent] = useState(false);
  const [formDocRelatedTaskId, setFormDocRelatedTaskId] = useState('');
  const [formDocIsCorrection, setFormDocIsCorrection] = useState(false);
  const [formDocOriginalId, setFormDocOriginalId] = useState('');
  const [formDestinationLevel, setFormDestinationLevel] = useState<'Superior' | 'Subordinate'>('Superior');
  const [formAutoCreateTask, setFormAutoCreateTask] = useState<boolean>(true);
  const [formSecurityLevel, setFormSecurityLevel] = useState<string>('Normal');
  const [formUrgencyLevel, setFormUrgencyLevel] = useState<string>('Normal');
  const [formResponseDeadline, setFormResponseDeadline] = useState<string>('');
  const [formDocumentSymbol, setFormDocumentSymbol] = useState<string>('UBND-VP');

  // Detail & Sign Modal State
  const [showDetailOutgoingModal, setShowDetailOutgoingModal] = useState(false);
  const [selectedOutgoingDoc, setSelectedOutgoingDoc] = useState<OutgoingDocumentDto | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // ── Rating Revision (Sửa Đánh Giá Chống Thiên Vị) States ──
  const [showRatingRevisionModal, setShowRatingRevisionModal] = useState(false);
  const [ratingRevisionNewScore, setRatingRevisionNewScore] = useState(8.0);
  const [ratingRevisionReason, setRatingRevisionReason] = useState('');
  const [ratingRevisionEvidenceUrl, setRatingRevisionEvidenceUrl] = useState('');
  const [ratingRevisionFileName, setRatingRevisionFileName] = useState('');
  const [ratingRevisionFileSize, setRatingRevisionFileSize] = useState('');
  const [ratingRevisionFileType, setRatingRevisionFileType] = useState('');
  const [taskRatingHistory, setTaskRatingHistory] = useState<RatingHistoryDto[]>([]);
  const [pendingRatingRevisions, setPendingRatingRevisions] = useState<RatingHistoryDto[]>([]);
  const [showPendingRatingRevisionsModal, setShowPendingRatingRevisionsModal] = useState(false);
  const [rejectingRevisionHistoryId, setRejectingRevisionHistoryId] = useState<string | null>(null);
  const [rejectingRevisionReasonInput, setRejectingRevisionReasonInput] = useState('');
  const [inboxChannelTab, setInboxChannelTab] = useState<'Internal' | 'PublicService'>('Internal');
  const [actSubTab, setActSubTab] = useState<'timeline' | 'audit'>('timeline');
  const [activityLogs, setActivityLogs] = useState<ActivityLogItemDto[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItemDto[]>([]);
  const [ubmttqContent, setUbmttqContent] = useState('');
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Demo Mode State for Localhost
  const [isLocalDemoMode, setIsLocalDemoMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('isLocalDemoMode') === 'true';
    }
    return false;
  });

  const toggleLocalDemoMode = () => {
    const nextVal = !isLocalDemoMode;
    setIsLocalDemoMode(nextVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('isLocalDemoMode', nextVal ? 'true' : 'false');
    }
    addToast(
      nextVal ? 'Đã bật Chế độ Demo' : 'Đã tắt Chế độ Demo (Ghi DB thật)',
      nextVal
        ? 'Mọi thao tác Thêm/Sửa/Xóa trên Localhost sẽ bị chặn để thử nghiệm an toàn.'
        : 'Đã kết nối trực tiếp với PostgreSQL. Dữ liệu sẽ được ghi thực sự vào Database.',
      nextVal ? 'warning' : 'success'
    );
  };

  // Mobile drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Toast Notification State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = (title: string, message: string, type: 'success' | 'danger' | 'info' | 'warning' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Welcome Pop Up & Print Modal state
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Calendar week navigation state
  const [weekStart, setWeekStart] = useState('2026-07-20');

  // Create Task form state
  const [checklistItems, setChecklistItems] = useState<{ id: string, text: string, done: boolean }[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [createTaskSource, setCreateTaskSource] = useState<InboxItem | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('Trung_Binh');
  const [newCategory, setNewCategory] = useState<TaskCategory>('BAU');
  const [newDueDate, setNewDueDate] = useState('2026-07-29');
  const [newShift, setNewShift] = useState<ShiftType>('Sang');
  const [newStartTime, setNewStartTime] = useState('08:30');
  const [newEffort, setNewEffort] = useState('8');
  const [attachedFiles, setAttachedFiles] = useState<TaskFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Voice / AI state
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [ocrText, setOcrText] = useState('');

  // ── PROMPT F: AI Document Analysis & Task Assignment States ──
  const [showAiUploadModal, setShowAiUploadModal] = useState(false);
  const [aiUploadTargetDocId, setAiUploadTargetDocId] = useState<string>('');
  const [aiUploadTargetDocSymbol, setAiUploadTargetDocSymbol] = useState<string>('');

  const [showAiReviewModal, setShowAiReviewModal] = useState(false);
  const [aiReviewDocId, setAiReviewDocId] = useState<string>('');
  const [aiReviewAnalysisData, setAiReviewAnalysisData] = useState<any>(null);

  const [showAiAssignmentModal, setShowAiAssignmentModal] = useState(false);
  const [aiAssignDocId, setAiAssignDocId] = useState<string>('');
  const [aiAssignAnalysisData, setAiAssignAnalysisData] = useState<any>(null);

  const [showAiChecklistModal, setShowAiChecklistModal] = useState(false);
  const [aiChecklistTaskId, setAiChecklistTaskId] = useState<string>('');
  const [aiChecklistTaskTitle, setAiChecklistTaskTitle] = useState<string>('');
  const [aiChecklistSubTasks, setAiChecklistSubTasks] = useState<{ id: string; title: string; isCompleted?: boolean }[]>([]);
  const [isAiAnalyzingFile, setIsAiAnalyzingFile] = useState(false);
  // Document Viewer state
  const [showViewerModal, setShowViewerModal] = useState<boolean>(false);
  const [viewerMail, setViewerMail] = useState<InboxItem | null>(null);
  // Revoke Document state
  const [showRevokeModal, setShowRevokeModal] = useState<boolean>(false);
  const [revokeDocItem, setRevokeDocItem] = useState<any>(null);
  // Document History state
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyDocItem, setHistoryDocItem] = useState<any>(null);

  // New comment state
  const [newComment, setNewComment] = useState('');

  // Approval & Rejection Modals State (Thang điểm 100: 30đ Hệ Thống + 70đ Người Chấm)
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const [systemScoreBreakdown, setSystemScoreBreakdown] = useState<SystemScoreBreakdownDto | null>(null);
  const [evaluatorScore, setEvaluatorScore] = useState<number>(60.0);
  const [ratingScore, setRatingScore] = useState<number>(90.0);
  const [isLoadingSystemScore, setIsLoadingSystemScore] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState('');
  const [newExtendedDate, setNewExtendedDate] = useState('');
  const [submitNote, setSubmitNote] = useState('');

  // ── Chú Thích Khoanh Vùng (Task Review Annotations) State ──
  const [taskAnnotations, setTaskAnnotations] = useState<TaskReviewAnnotationDto[]>([]);
  const [selectedAnchorText, setSelectedAnchorText] = useState<string>('');
  const [selectedAnchorOffset, setSelectedAnchorOffset] = useState<number | null>(null);
  const [selectionTooltipPos, setSelectionTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const [showAnnotationModal, setShowAnnotationModal] = useState<boolean>(false);
  const [annotationComment, setAnnotationComment] = useState<string>('');
  const [annotationSeverity, setAnnotationSeverity] = useState<number>(2); // 1: LoiSai, 2: CanChinhSua, 3: GopY
  const [activeAnnotationPopover, setActiveAnnotationPopover] = useState<TaskReviewAnnotationDto | null>(null);
  const [activePopoverPos, setActivePopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [highlightedAnnotationId, setHighlightedAnnotationId] = useState<string | null>(null);


  // Inbox State
  const [inboxItems, setInboxItems] = useState<InboxItem[]>(SAMPLE_INBOX);
  const unprocessedCount = useMemo(() => inboxItems.filter(m => !m.deadline || m.status !== 'scheduled').length, [inboxItems]);
  const [activeFolder, setActiveFolder] = useState<InboxFolder>('inbox');
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const selectedMail = useMemo(() => inboxItems.find(m => m.id === selectedMailId) || null, [inboxItems, selectedMailId]);

  const INBOX_FOLDERS = useMemo(() => [
    { id: 'inbox', label: 'Hộp thư đến', icon: 'inbox', color: '#3b82f6' },
    { id: 'starred', label: 'Quan trọng', icon: 'star', color: '#eab308' },
    { id: 'scheduled', label: 'Đã xếp lịch', icon: 'calendar-check', color: '#10b981' },
    { id: 'assigned', label: 'Đã giao việc', icon: 'paper-plane', color: '#8b5cf6' },
  ], []);

  // AI Sorting toggle for employee
  const [useAISorting, setUseAISorting] = useState(true);

  // ── Transfer Modal & PostgreSQL Users State ──
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromStaff, setTransferFromStaff] = useState('');
  const [transferToStaff, setTransferToStaff] = useState('');
  const [transferToStaffId, setTransferToStaffId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferTaskId, setTransferTaskId] = useState('');
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [dbUsers, setDbUsers] = useState<UserDto[]>([]);

  // ── Progress Reports & GRAD Evaluation State ──
  const [progressReports, setProgressReports] = useState<ProgressReport[]>([]);
  const [reportSubTab, setReportSubTab] = useState<'submit' | 'review' | 'history' | 'evaluation'>('evaluation');
  const [reportTaskId, setReportTaskId] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportProgressStatus, setReportProgressStatus] = useState<TaskProgressStatus>('dang_thuc_hien');
  const [reportExtensionDate, setReportExtensionDate] = useState('');
  const [gradOfficers, setGradOfficers] = useState<OfficerGRADScoreDto[]>([]);
  const [gradDepartments, setGradDepartments] = useState<DepartmentGRADSummaryDto[]>([]);
  const [communeAvgScore, setCommuneAvgScore] = useState<number>(8.5);

  // ── Schedule & Reminders State ──
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('2026-07-28');
  const [scheduleStartTime, setScheduleStartTime] = useState('08:00');
  const [scheduleShift, setScheduleShift] = useState<'Sang' | 'Chieu'>('Sang');
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDescription, setScheduleDescription] = useState('');
  const [scheduleSourceMail, setScheduleSourceMail] = useState<InboxItem | null>(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTargetId, setReminderTargetId] = useState('');
  const [reminderAmount, setReminderAmount] = useState(30);
  const [reminderUnit, setReminderUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [reminderFrequency, setReminderFrequency] = useState<'once' | 'repeat'>('once');
  const [reminderMessage, setReminderMessage] = useState('');
  // ── Notifications & SignalR Real-Time State ──
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);

  // ── Web Push & Daily Digest State ──
  const [showPushSettingsModal, setShowPushSettingsModal] = useState<boolean>(false);
  const [isPushSupported, setIsPushSupported] = useState<boolean>(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean>(false);
  const [isPushLoading, setIsPushLoading] = useState<boolean>(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [myPushSubscriptions, setMyPushSubscriptions] = useState<PushSubscriptionDto[]>([]);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [isIosPwa, setIsIosPwa] = useState<boolean>(false);
  const [deviceLabelInput, setDeviceLabelInput] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = isPushNotificationSupported();
      setIsPushSupported(supported);
      const ios = isIosDevice();
      setIsIos(ios);
      const iosPwa = isIosStandalonePwa();
      setIsIosPwa(iosPwa);

      if (supported) {
        registerServiceWorker().then(() => {
          getExistingPushSubscription().then(sub => {
            setIsPushSubscribed(!!sub);
          });
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'PUSH_SUBSCRIPTION_CHANGED') {
            getExistingPushSubscription().then(sub => {
              setIsPushSubscribed(!!sub);
              if (isLoggedIn) fetchMyPushSubscriptions();
            });
          }
        });
      }
    }
  }, []);

  const fetchMyPushSubscriptions = async () => {
    try {
      const list = await getMyPushSubscriptionsApi();
      setMyPushSubscriptions(list);
    } catch (e) {
      console.error('Lỗi khi tải danh sách thiết bị push:', e);
    }
  };

  const handleOpenPushSettings = () => {
    setShowPushSettingsModal(true);
    setPushStatusMessage(null);
    setDeviceLabelInput(getAutoDeviceLabel());
    fetchMyPushSubscriptions();
  };

  const handleSubscribePush = async () => {
    setIsPushLoading(true);
    setPushStatusMessage(null);
    try {
      await subscribeCurrentDevice(deviceLabelInput.trim() || undefined);
      setIsPushSubscribed(true);
      setPushStatusMessage({ type: 'success', text: 'Đã kích hoạt nhận thông báo đẩy thành công trên thiết bị này!' });
      await fetchMyPushSubscriptions();
    } catch (e: any) {
      setPushStatusMessage({ type: 'error', text: e.message || 'Không thể kích hoạt thông báo đẩy.' });
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleUnsubscribePush = async () => {
    setIsPushLoading(true);
    setPushStatusMessage(null);
    try {
      await unsubscribeCurrentDevice();
      setIsPushSubscribed(false);
      setPushStatusMessage({ type: 'info', text: 'Đã hủy nhận thông báo trên thiết bị này.' });
      await fetchMyPushSubscriptions();
    } catch (e: any) {
      setPushStatusMessage({ type: 'error', text: e.message || 'Không thể hủy nhận thông báo.' });
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleSendTestPush = async (endpoint?: string) => {
    setIsPushLoading(true);
    setPushStatusMessage(null);
    try {
      const res = await sendTestPushApi(endpoint);
      setPushStatusMessage({ type: 'success', text: res.message || 'Đã gửi thông báo thử nghiệm! Vui lòng kiểm tra màn hình thiết bị.' });
    } catch (e: any) {
      setPushStatusMessage({ type: 'error', text: e.message || 'Lỗi khi gửi thông báo thử nghiệm.' });
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleDeletePushSubscription = async (id: string) => {
    try {
      await unsubscribePushApi(undefined, id);
      await fetchMyPushSubscriptions();
      const currentSub = await getExistingPushSubscription();
      setIsPushSubscribed(!!currentSub);
    } catch (e) {
      console.error('Lỗi xóa subscription:', e);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      // 1. Fetch real tasks from PostgreSQL API
      getTasksApi().then(res => {
        if (res.success && res.data && res.data.items && res.data.items.length > 0) {
          const mapped: Task[] = res.data.items.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            assignedBy: t.assignerName || 'Lãnh đạo xã',
            assignedByRole: 'Lãnh đạo xã',
            assignee: t.assigneeName || 'Cán bộ xã',
            assigneeRole: 'Cán bộ xã',
            collaborators: [],
            priority: (t.priority === 'Urgent' ? 'Khan' : t.priority === 'High' ? 'Cao' : t.priority === 'Low' ? 'Thuong' : 'Trung_Binh') as TaskPriority,
            status: (t.status === 'Completed' ? 'Hoan_Thanh' : t.status === 'InReview' ? 'Cho_Duyet' : t.status === 'Cancelled' ? 'Tu_Choi' : t.status === 'InProgress' ? 'Dang_Xu_Ly' : 'Chua_Lam') as TaskStatus,
            category: (t.type === 'AdHoc' ? 'Dot_Xuat' : 'BAU') as TaskCategory,
            dueDate: t.dueDate ? t.dueDate.split('T')[0] : '2026-08-10',
            shift: 'Sang' as const,
            startTime: '08:00',
            createdDate: t.createdAt ? t.createdAt.split('T')[0] : '2026-08-01',
            progress: t.status === 'Completed' ? 100 : t.status === 'InReview' ? 90 : t.status === 'InProgress' ? 50 : 0,
            effortHours: t.estimatedEffortHours || 8,
            attachments: [],
            comments: [],
            statusHistory: [],
            submissionNote: t.submissionNote,
            systemScore: t.systemScore,
            evaluatorScore: t.evaluatorScore,
            rating: t.ratingScore,
            ratingScore: t.ratingScore,
            rejectionReason: t.rejectionReason,
            context: 'ChuTichUBND' as const
          }));
          setTasks(mapped);
        }
      });

      // 2. Fetch Inbox Documents from PostgreSQL
      getInboxDocumentsApi().then(res => {
        if (res.success && res.data && res.data.items && res.data.items.length > 0) {
          const mappedDocs: InboxItem[] = res.data.items.map(d => ({
            id: d.id,
            senderName: d.sender,
            senderOrg: d.issuingAgency || d.sender,
            documentNumber: d.documentNumber,
            documentSymbol: d.documentSymbol || 'UBND-VP',
            issuingAgency: d.issuingAgency || d.sender,
            signerName: d.signerName,
            issuedDate: d.issuedDate ? d.issuedDate.split('T')[0] : d.receivedDate ? d.receivedDate.split('T')[0] : undefined,
            category: d.category,
            date: d.receivedDate ? d.receivedDate.split('T')[0] : '2026-08-07',
            subject: d.subject,
            content: `Văn bản số ${d.documentNumber}${d.documentSymbol ? '/' + d.documentSymbol : ''} gửi từ ${d.issuingAgency || d.sender}. Thể loại: ${d.category}. Trích yếu: ${d.subject}`,
            status: d.isScheduled ? 'scheduled' : 'read',
            folder: d.isScheduled ? 'scheduled' : 'inbox',
            isStarred: d.isUrgent,
            isUrgent: d.isUrgent,
            deadline: d.scheduledDate ? d.scheduledDate.split('T')[0] : undefined,
            attachments: d.attachmentUrl ? [{ name: `CongVan_${d.documentNumber.replace(/[\/\s]/g, '_')}.pdf`, size: '1.8 MB', type: 'pdf', url: d.attachmentUrl }] : [{ name: `CongVan_${d.documentNumber.replace(/[\/\s]/g, '_')}.pdf`, size: '1.8 MB', type: 'pdf' }]
          }));
          setInboxItems(mappedDocs);
        }
      });

      // 3. Fetch notifications
      getNotifications().then((res) => {
        if (res.success && res.data) {
          setNotificationsList(res.data.items);
          setUnreadNotifCount(res.data.unreadCount);
        }
      });

      // 4. Fetch GRAD Evaluation Report from PostgreSQL
      getGRADReportApi().then(res => {
        if (res.success && res.data) {
          setGradOfficers(res.data.officers);
          setGradDepartments(res.data.departments);
          setCommuneAvgScore(res.data.overallCommuneAverageScore);
        }
      });

      // 5. Fetch Real Users from PostgreSQL
      getUsersApi().then(res => {
        if (res.success && res.data) {
          setDbUsers(res.data);
        }
      });

      // 6. Fetch Activity Log & Audit Log from PostgreSQL
      getActivityLogApi().then(res => {
        if (res.success && res.data && res.data.items) {
          setActivityLogs(res.data.items);
        }
      });

      getAuditLogApi().then(res => {
        if (res.success && res.data && res.data.items) {
          setAuditLogs(res.data.items);
        }
      });

      // 3. Connect SignalR
      initSignalRConnection((newNotif) => {
        setNotificationsList((prev) => [newNotif, ...prev]);
        setUnreadNotifCount((prev) => prev + 1);
        addToast(newNotif.title, newNotif.message, newNotif.type === 'Escalation' ? 'danger' : 'info');
      });

      return () => {
        stopSignalRConnection();
      };
    }
  }, [isLoggedIn]);

  // ── Debounce 300ms cho ô Tìm kiếm Cán Bộ ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearch(userSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  // Reset userPage về 1 khi người dùng thay đổi từ khóa hoặc bộ lọc
  useEffect(() => {
    setUserPage(1);
  }, [debouncedUserSearch, selectedDeptFilter, roleCodeFilter, workloadFilter]);

  // ── Fetch Cán Bộ Server-side Paginated ──
  useEffect(() => {
    let isMounted = true;
    const fetchPaginatedUsers = async () => {
      setUserLoading(true);
      const res = await getUsersPaginatedApi({
        page: userPage,
        pageSize: 20,
        search: debouncedUserSearch,
        departmentId: selectedDeptFilter !== 'ALL' ? selectedDeptFilter : undefined,
        roleCode: roleCodeFilter !== 'ALL' ? roleCodeFilter : undefined,
        workloadStatus: workloadFilter !== 'ALL' ? workloadFilter : undefined,
      });

      if (isMounted && res.success && res.data) {
        if (userPage === 1) {
          setPaginatedUsersList(res.data?.items || []);
        } else {
          setPaginatedUsersList(prev => [...prev, ...(res.data?.items || [])]);
        }
        setUserTotalCount(res.data.totalCount || 0);
        setUserHasMore((userPage * 20) < (res.data.totalCount || 0));
      }
      if (isMounted) setUserLoading(false);
    };

    fetchPaginatedUsers();
    return () => { isMounted = false; };
  }, [userPage, debouncedUserSearch, selectedDeptFilter, roleCodeFilter, workloadFilter]);

  // ── Fetch Badge Quá tải (Đọc 1 lần khi vào / khi tasks thay đổi) ──
  useEffect(() => {
    getUsersPaginatedApi({ page: 1, pageSize: 1, workloadStatus: 'Overloaded' }).then(res => {
      if (res.success && res.data) {
        setOverloadedCountBadge(res.data.totalCount || 0);
      }
    });
  }, [tasks]);

  // ── Outgoing Documents (Văn Bản Đi) Debounce 300ms ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOutgoingSearch(outgoingSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [outgoingSearch]);

  // ── Fetch Annotations when Task Detail Drawer opens ──
  useEffect(() => {
    if (selectedTaskId) {
      fetchTaskAnnotations(selectedTaskId);
    } else {
      setTaskAnnotations([]);
      setSelectionTooltipPos(null);
      setActiveAnnotationPopover(null);
    }
  }, [selectedTaskId]);

  // Reset page về 1 khi người dùng đổi bộ lọc văn bản đi
  useEffect(() => {
    setOutgoingPage(1);
  }, [debouncedOutgoingSearch, outgoingStatusFilter, outgoingTypeFilter]);

  // Fetch Văn Bản Đi từ server API
  const fetchOutgoingDocs = async () => {
    setOutgoingLoading(true);
    const res = await getOutgoingDocumentsApi({
      page: outgoingPage,
      pageSize: 15,
      search: debouncedOutgoingSearch,
      status: outgoingStatusFilter !== 'ALL' ? (outgoingStatusFilter as OutgoingDocumentStatusEnum) : undefined,
      documentType: outgoingTypeFilter !== 'ALL' ? (outgoingTypeFilter as DocumentTypeEnum) : undefined,
    });

    if (res.success && res.data) {
      if (outgoingPage === 1) {
        setOutgoingDocsList(res.data?.items || []);
      } else {
        setOutgoingDocsList(prev => [...prev, ...(res.data?.items || [])]);
      }
      setOutgoingTotalCount(res.data?.totalCount || 0);
      setOutgoingHasMore(outgoingPage * 15 < (res.data?.totalCount || 0));
    }
    setOutgoingLoading(false);
  };

  useEffect(() => {
    if (activeModule === 'workcenter' && workcenterTab === 'outgoing') {
      fetchOutgoingDocs();
    }
  }, [activeModule, workcenterTab, outgoingPage, debouncedOutgoingSearch, outgoingStatusFilter, outgoingTypeFilter]);

  // ── Fetch Lịch Sử Đánh Giá khi chọn Task Detail ──
  const fetchTaskRatingHistory = async (taskId: string) => {
    const res = await getTaskRatingHistoryApi(taskId);
    if (res.success && res.data) {
      setTaskRatingHistory(res.data);
    } else {
      setTaskRatingHistory([]);
    }
  };

  useEffect(() => {
    if (selectedTaskId) {
      fetchTaskRatingHistory(selectedTaskId);
    }
  }, [selectedTaskId]);

  // ── Fetch Danh Sách Chờ Cấp Trên Phê Duyệt ──
  const fetchPendingRatingRevisions = async () => {
    const res = await getPendingRatingRevisionsApi();
    if (res.success && res.data) {
      setPendingRatingRevisions(res.data);
    }
  };

  useEffect(() => {
    fetchPendingRatingRevisions();
  }, [activeRole]);

  const handleMarkNotificationRead = async (id: string) => {
    setNotificationsList(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadNotifCount(prev => Math.max(0, prev - 1));
    await markNotificationRead(id);
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotificationsList(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadNotifCount(0);
    await markAllNotificationsRead();
    addToast('Đã đọc tất cả', 'Đã đánh dấu tất cả thông báo là đã đọc.', 'info');
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    await handleMarkNotificationRead(n.id);
    setShowNotifDropdown(false);

    if (n.taskItemId) {
      setActiveModule('workcenter');
      setWorkcenterTab('today');
      setSelectedTaskId(n.taskItemId);
    } else if (n.type === 'Escalation' || n.type === 'Inbox') {
      setActiveModule('workcenter');
      setWorkcenterTab('incoming');
    } else {
      setActiveModule('workcenter');
    }
  };

  // --- Data filtering based on Role Context & Filters ---
  const visibleTasks = useMemo(() => {
    let filtered = tasks;
    const scopeLevel = ROLE_CONFIG[activeRole]?.scopeLevel ?? 4.0;

    if (scopeLevel >= 4.0) {
      // Chuyên viên: chỉ thấy công việc được giao cho mình
      const currentUser = activeRole === 'ChuyenVien' ? 'Nguyễn Văn Nam' : activeRole;
      filtered = filtered.filter(t => t.assignee === currentUser);
    } else if (scopeLevel <= 1.0) {
      // Bí thư Đảng ủy: thấy toàn bộ
      // No filter needed
    } else if (scopeLevel <= 1.5) {
      // Chủ tịch UBND/HĐND: thấy công việc theo cơ quan
      if (activeRole === 'ChuTichHDND') {
        filtered = filtered.filter(t => t.context === 'ChuTichHDND' || t.context === 'ChuTichUBND');
      }
      // ChuTichUBND: thấy toàn bộ UBND — no additional filter
    } else if (scopeLevel <= 2.0) {
      // Phó Chủ tịch: thấy công việc trong phạm vi phân công
      if (activeRole === 'PhoChuTichHDND') {
        filtered = filtered.filter(t => t.context === 'ChuTichHDND' || t.context === 'ChuTichUBND');
      }
      // PhoChuTichUBND_* : thấy toàn bộ UBND — no additional filter
    } else if (scopeLevel <= 2.5) {
      // Trưởng phòng: thấy công việc trong phòng/ban mình
      filtered = filtered.filter(t =>
        t.assigneeRole?.includes('Địa chính') || t.assigneeRole?.includes('Kinh tế') || t.assignee === 'Trần Thị Mai'
      );
    } else if (scopeLevel <= 3.0) {
      // Phó phòng: thấy công việc trong phòng mình
      filtered = filtered.filter(t =>
        t.assigneeRole?.includes('Địa chính') || t.assigneeRole?.includes('Kinh tế')
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    if (shiftFilter !== 'all') {
      filtered = filtered.filter(t => t.shift === shiftFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    }

    if (activeRole === 'ChuyenVien' && useAISorting) {
      filtered = [...filtered].sort((a, b) => {
        const pOrder: Record<TaskPriority, number> = { Khan: 1, Cao: 2, Trung_Binh: 3, Thuong: 4 };
        if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
        return getDaysUntilDue(a.dueDate) - getDaysUntilDue(b.dueDate);
      });
    }

    return filtered;
  }, [tasks, activeRole, statusFilter, shiftFilter, searchQuery, useAISorting]);

  // Selected task detail
  const selectedTask = useMemo(() => {
    return tasks.find(t => t.id === selectedTaskId) || null;
  }, [tasks, selectedTaskId]);

  // KPI Metrics calculation
  const kpiData = useMemo(() => {
    const active = visibleTasks.filter(t => t.status === 'Dang_Xu_Ly' || t.status === 'Chua_Lam');
    const nearDeadline = visibleTasks.filter(t => t.status !== 'Hoan_Thanh' && getDaysUntilDue(t.dueDate) <= 2 && getDaysUntilDue(t.dueDate) >= 0);
    const overdue = visibleTasks.filter(t => t.status !== 'Hoan_Thanh' && getDaysUntilDue(t.dueDate) < 0);
    const completed = visibleTasks.filter(t => t.status === 'Hoan_Thanh');
    const pendingApproval = visibleTasks.filter(t => t.status === 'Cho_Duyet');
    return {
      active: active.length,
      nearDeadline: nearDeadline.length,
      overdue: overdue.length,
      completed: completed.length,
      pendingApproval: pendingApproval.length,
    };
  }, [visibleTasks]);

  // Sidebar badge notifications count
  const sidebarBadges = useMemo(() => {
    const overloadedStaffCount = activeStaffList.filter(s => s.assignedHours > s.maxHours).length;
    const taskBadge = kpiData.overdue + kpiData.nearDeadline;
    return {
      overview: kpiData.pendingApproval > 0 ? kpiData.pendingApproval : 0,
      tasks: taskBadge > 0 ? taskBadge : 0,
      departments: overloadedStaffCount > 0 ? overloadedStaffCount : 0,
      'create-task': 0,
      reports: 0,
    };
  }, [kpiData, activeStaffList]);

  if (!hasMounted) {
    return null;
  }

  if (!isLoggedIn) {
    const sampleTestimonials: Testimonial[] = [
      {
        avatarSrc: "/images/avatar-1.png",
        name: "Bùi Văn Hùng",
        handle: "Chủ tịch UBND xã Cát Ngạn",
        text: "Hệ thống đôn đốc tự động giúp Thường trực UBND xã xử lý 98% công việc đúng tiến độ."
      },
      {
        avatarSrc: "/images/avatar-2.png",
        name: "Trần Thị Mai",
        handle: "Trưởng phòng Địa chính - Xây dựng",
        text: "Bảng phân ca Sáng - Chiều - Tối minh bạch, tránh trùng lặp lịch công tác của cán bộ."
      },
      {
        avatarSrc: "/images/avatar-3.png",
        name: "Nguyễn Văn Nam",
        handle: "Chuyên viên Văn phòng HĐND & UBND",
        text: "Hệ thống điều hành trực quan, hỗ trợ số hóa và tiếp nhận văn bản chỉ đạo nhanh chóng, chính xác."
      },
    ];

    return (
      <SignInPage
        heroImageSrc="/images/hero-signin.png"
        testimonials={sampleTestimonials}
        onSignIn={(e, role) => {
          const targetRole = role || 'BiThuDU';
          setActiveRole(targetRole);
          setIsLoggedIn(true);
          const roleLabel = ROLE_CONFIG[targetRole]?.label || 'Cán bộ';
          addToast('Đăng nhập thành công', `Chào mừng ${roleLabel} đến với Hệ thống Điều hành & Số hóa UBND Xã Cát Ngạn`, 'success');
        }}
        onQuickRoleSelect={(role) => {
          setActiveRole(role);
          setIsLoggedIn(true);
          const roleLabel = ROLE_CONFIG[role]?.label || 'Cán bộ';
          addToast('Đăng nhập thành công', `Chào mừng ${roleLabel} đến với Hệ thống Điều hành & Số hóa UBND Xã Cát Ngạn`, 'success');
        }}
      />
    );
  }

  // --- Handlers ---
  const handleSwapShift = (e: React.MouseEvent, taskId: string, currentShift: ShiftType) => {
    e.stopPropagation();
    const nextShift: ShiftType = currentShift === 'Sang' ? 'Chieu' : 'Sang';
    const defaultTime = nextShift === 'Sang' ? '07:00' : '13:00';

    const targetTask = tasks.find(t => t.id === taskId);
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, shift: nextShift, startTime: defaultTime } : t
    ));

    addToast('Đã đổi ca làm việc', `Công việc "${targetTask?.title || taskId}" đã chuyển sang ca ${SHIFT_CONFIG[nextShift].label}`, 'info');
  };

  const fetchTaskAnnotations = async (taskId: string) => {
    try {
      const list = await getTaskAnnotationsApi(taskId);
      setTaskAnnotations(list || []);
    } catch (e) {
      console.warn('Could not fetch annotations:', e);
      setTaskAnnotations([]);
    }
  };

  const handleApproveTask = async (taskId: string) => {
    setSelectedTaskId(taskId);
    setIsLoadingSystemScore(true);
    setEvaluatorScore(60.0); // Mặc định 60/70 (Mức Tốt)
    setShowApproveModal(true);

    try {
      const breakdown = await getTaskSystemScoreApi(taskId);
      setSystemScoreBreakdown(breakdown);
      const totalSys = breakdown?.totalSystemScore ?? 30.0;
      setRatingScore(Math.min(100.0, totalSys + 60.0));
    } catch (e) {
      console.warn('Could not calculate system score from API, using default 30.0:', e);
      setSystemScoreBreakdown({
        onTimeScore: 15.0,
        checklistScore: 10.0,
        noRejectionScore: 5.0,
        totalSystemScore: 30.0,
        daysLate: 0,
        totalSubTasks: 0,
        completedSubTasks: 0,
        rejectionCount: 0
      });
      setRatingScore(90.0);
    } finally {
      setIsLoadingSystemScore(false);
    }
  };

  const confirmApproveTask = async () => {
    if (!selectedTaskId) return;
    const targetTask = tasks.find(t => t.id === selectedTaskId);
    const totalSys = systemScoreBreakdown?.totalSystemScore ?? 30.0;
    const finalTotal = Math.min(100.0, totalSys + evaluatorScore);
    const tier = getEvaluationTier(finalTotal);

    // Call PostgreSQL API with 100-point rating and breakdown
    try {
      await updateTaskStatusApi(selectedTaskId, {
        status: 'Completed',
        systemScore: totalSys,
        evaluatorScore: evaluatorScore,
        ratingScore: finalTotal
      });
    } catch (e) {
      console.warn('API error during status update:', e);
    }

    setTasks(prev => prev.map(t =>
      t.id === selectedTaskId ? {
        ...t,
        status: 'Hoan_Thanh' as TaskStatus,
        progress: 100,
        systemScore: totalSys,
        evaluatorScore: evaluatorScore,
        rating: finalTotal,
        ratingScore: finalTotal,
        statusHistory: [...t.statusHistory, {
          from: 'Chờ duyệt', to: `Hoàn thành (Đánh giá: ${finalTotal.toFixed(1)}/100 — Mức ${tier.level}: ${tier.label})`,
          by: ROLE_CONFIG[activeRole].label, at: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          asRole: ROLE_CONFIG[activeRole].label,
        }],
      } : t
    ));
    addToast('Nghiệm thu thành công', `Đã phê duyệt "${targetTask?.title || selectedTaskId}" — Đánh giá: ${finalTotal.toFixed(1)}/100 điểm (Mức ${tier.level}: ${tier.label}).`, 'success');
    setShowApproveModal(false);
    setSelectedTaskId(null);
  };

  // ── Handlers cho Chú Thích Khoanh Vùng (Annotations) ──
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionTooltipPos(null);
      return;
    }
    const text = selection.toString().trim();
    if (!text || text.length < 2) {
      setSelectionTooltipPos(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectedAnchorText(text);
    setSelectedAnchorOffset(range.startOffset);
    setSelectionTooltipPos({
      top: rect.top - 42,
      left: rect.left + rect.width / 2 - 50
    });
  };

  const handleOpenAnnotationModal = () => {
    setAnnotationComment('');
    setAnnotationSeverity(2); // Cần chỉnh sửa
    setShowAnnotationModal(true);
    setSelectionTooltipPos(null);
  };

  const handleCreateAnnotation = async (taskId: string) => {
    if (!selectedAnchorText.trim()) return;
    if (!annotationComment.trim()) {
      addToast('Cảnh báo', 'Vui lòng nhập nội dung góp ý / nhận xét!', 'warning');
      return;
    }

    try {
      const created = await createTaskAnnotationApi(taskId, {
        anchorText: selectedAnchorText,
        startOffsetHint: selectedAnchorOffset ?? undefined,
        commentText: annotationComment.trim(),
        severity: annotationSeverity
      });
      setTaskAnnotations(prev => [...prev, created]);
      addToast('Thêm chú thích thành công', `Đã khoanh vùng và thêm chú thích nhận xét.`, 'success');
      setShowAnnotationModal(false);
      setSelectedAnchorText('');
      window.getSelection()?.removeAllRanges();
    } catch (e: any) {
      addToast('Lỗi tạo chú thích', e.message || 'Không thể tạo chú thích', 'danger');
    }
  };

  const handleResolveAnnotation = async (taskId: string, annotationId: string) => {
    try {
      const updated = await resolveTaskAnnotationApi(taskId, annotationId);
      setTaskAnnotations(prev => prev.map(a => a.id === annotationId ? updated : a));
      addToast('Đã sửa xong', 'Đã đánh dấu hoàn thành xử lý góp ý này.', 'success');
      if (activeAnnotationPopover?.id === annotationId) {
        setActiveAnnotationPopover(null);
      }
    } catch (e: any) {
      addToast('Lỗi giải quyết', e.message || 'Không thể đánh dấu đã sửa', 'danger');
    }
  };

  const handleRejectTask = (taskId: string) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;
    setSelectedTaskId(taskId);
    setRejectReason('');
    setNewExtendedDate(targetTask.dueDate); // Default to current deadline
    setShowRejectModal(true);
  };

  const confirmRejectTask = async () => {
    if (!selectedTaskId || !rejectReason.trim()) {
      addToast('Thiếu thông tin', 'Vui lòng nhập lý do từ chối và hướng dẫn sửa đổi!', 'warning');
      return;
    }
    const targetTask = tasks.find(t => t.id === selectedTaskId);

    // Call PostgreSQL API
    await updateTaskStatusApi(selectedTaskId, 'Cancelled', undefined, rejectReason, newExtendedDate);

    setTasks(prev => prev.map(t =>
      t.id === selectedTaskId ? {
        ...t,
        status: 'Tu_Choi' as TaskStatus,
        dueDate: newExtendedDate,
        rejectionReason: rejectReason,
        statusHistory: [...t.statusHistory, {
          from: 'Chờ duyệt', to: 'Từ chối — Yêu cầu hoàn thiện',
          by: ROLE_CONFIG[activeRole].label, at: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          asRole: ROLE_CONFIG[activeRole].label,
        }],
      } : t
    ));
    addToast('Yêu cầu làm lại', `Đã từ chối nghiệm thu. Hạn chót mới: ${newExtendedDate}.`, 'danger');
    setShowRejectModal(false);
    setSelectedTaskId(null);
  };

  // ── Rating Revision Handlers (Sửa Đánh Giá Chống Thiên Vị) ──
  const handleOpenRatingRevisionModal = (task: any) => {
    const rawScore = task.rating !== undefined && task.rating !== null ? task.rating : (task.ratingScore ?? 8.0);
    const currentScore = rawScore > 10.0 ? rawScore / 10.0 : rawScore;
    setRatingRevisionNewScore(currentScore);
    setRatingRevisionReason('');
    setRatingRevisionEvidenceUrl('');
    setRatingRevisionFileName('');
    setRatingRevisionFileSize('');
    setRatingRevisionFileType('');
    setShowRatingRevisionModal(true);
  };

  const handleSubmitRatingRevision = async () => {
    if (!selectedTaskId) return;
    if (ratingRevisionReason.trim().length < 30) {
      addToast('Chưa đủ độ dài lý do', 'Lý do thay đổi đánh giá phải chứa ít nhất 30 ký tự!', 'warning');
      return;
    }
    if (!ratingRevisionEvidenceUrl.trim()) {
      addToast('Thiếu tệp minh chứng', 'Vui lòng chọn tệp văn bản hoặc hình ảnh minh chứng từ máy tính!', 'warning');
      return;
    }

    const res = await submitRatingRevisionApi(selectedTaskId, {
      newScore: ratingRevisionNewScore,
      reason: ratingRevisionReason.trim(),
      evidenceUrl: ratingRevisionEvidenceUrl.trim(),
    });

    if (res.success && res.data) {
      if (res.data.approvalStatus === 'Applied') {
        addToast('Đã áp dụng điểm mới', `Đã điều chỉnh điểm đánh giá thành ${ratingRevisionNewScore.toFixed(1)}/10 điểm (Áp dụng ngay).`, 'success');
        setTasks(prev => prev.map(t => t.id === selectedTaskId ? { ...t, rating: ratingRevisionNewScore, ratingScore: ratingRevisionNewScore } : t));
      } else {
        addToast('Đã gửi đề xuất', `Đề xuất điều chỉnh điểm (${ratingRevisionNewScore.toFixed(1)} điểm) đã chuyển sang trạng thái CHỜ CẤP TRÊN DUYỆT do chênh lệch > 1.0 điểm.`, 'info');
      }
      setShowRatingRevisionModal(false);
      fetchTaskRatingHistory(selectedTaskId);
      fetchPendingRatingRevisions();
    } else {
      addToast('Lỗi gửi đề xuất', res.error || 'Có lỗi xảy ra khi gửi đề xuất điều chỉnh điểm.', 'danger');
    }
  };

  const handleApprovePendingRevision = async (historyId: string) => {
    const res = await approveRatingRevisionApi(historyId);
    if (res.success) {
      addToast('Phê duyệt thành công', 'Đã phê duyệt đề xuất điều chỉnh điểm. Điểm số mới đã chính thức được áp dụng.', 'success');
      fetchPendingRatingRevisions();
      if (selectedTaskId) {
        fetchTaskRatingHistory(selectedTaskId);
      }
    } else {
      addToast('Thất bại', res.error || 'Không thể phê duyệt đề xuất này.', 'danger');
    }
  };

  const handleRejectPendingRevision = async () => {
    if (!rejectingRevisionHistoryId) return;
    if (rejectingRevisionReasonInput.trim().length < 10) {
      addToast('Cảnh báo', 'Lý do từ chối phải chứa ít nhất 10 ký tự!', 'warning');
      return;
    }
    const res = await rejectRatingRevisionApi(rejectingRevisionHistoryId, rejectingRevisionReasonInput.trim());
    if (res.success) {
      addToast('Đã từ chối', 'Đã từ chối đề xuất điều chỉnh điểm. Điểm cũ được giữ nguyên.', 'info');
      setRejectingRevisionHistoryId(null);
      setRejectingRevisionReasonInput('');
      fetchPendingRatingRevisions();
      if (selectedTaskId) {
        fetchTaskRatingHistory(selectedTaskId);
      }
    } else {
      addToast('Thất bại', res.error || 'Không thể từ chối đề xuất này.', 'danger');
    }
  };

  const handleSubmitTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setSubmitNote('');
    setShowSubmitModal(true);
  };

  const confirmSubmitTask = () => {
    if (!selectedTaskId) return;
    const targetTask = tasks.find(t => t.id === selectedTaskId);
    setTasks(prev => prev.map(t =>
      t.id === selectedTaskId ? {
        ...t,
        status: 'Cho_Duyet' as TaskStatus,
        statusHistory: [...t.statusHistory, {
          from: t.status, to: 'Chờ duyệt',
          by: ROLE_CONFIG[activeRole].label, at: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          asRole: ROLE_CONFIG[activeRole].label,
        }],
        comments: submitNote.trim() ? [...t.comments, {
          id: `c_${Date.now()}`,
          author: ROLE_CONFIG[activeRole].label,
          authorInitials: 'NV',
          text: `[NỘP KẾT QUẢ]: ${submitNote}`,
          time: 'Vừa xong'
        }] : t.comments
      } : t
    ));
    addToast('Nộp bài thành công', `Đã gửi kết quả công việc "${targetTask?.title || selectedTaskId}" chờ Trưởng phòng duyệt.`, 'success');
    setShowSubmitModal(false);
    setSelectedTaskId(null);
  };


  const handleAddComment = async (taskId: string) => {
    if (!newComment.trim()) return;
    const commentText = newComment.trim();
    setNewComment('');

    const newC: Comment = {
      id: `c_${Date.now()}`,
      author: ROLE_CONFIG[activeRole].label,
      authorInitials: 'NV',
      text: commentText,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, comments: [...t.comments, newC] } : t
    ));

    const res = await createCommentApi(taskId, commentText);
    if (res && res.success) {
      if (res.data?.mentionedUsers && res.data.mentionedUsers.length > 0) {
        addToast('Đã gửi ý kiến chỉ đạo', `Đã chuyển thông báo trực tiếp đến: ${res.data.mentionedUsers.join(', ')}`, 'success');
      } else {
        addToast('Đã gửi ý kiến', 'Ý kiến xử lý đã được lưu vào hồ sơ công việc.', 'info');
      }
      getActivityLogApi().then(r => { if (r.success && r.data) setActivityLogs(r.data.items); });
    }
  };

  const handleUBMTTQReview = async (taskId: string, isApproved: boolean) => {
    if (!ubmttqContent.trim()) {
      addToast('Thiếu thông tin', 'Vui lòng nhập nội dung ý kiến phản biện UBMTTQ!', 'warning');
      return;
    }

    const res = await submitUBMTTQReviewApi(taskId, ubmttqContent, isApproved);
    if (res && res.success) {
      addToast('Phản biện UBMTTQ', res.message || 'Đã lưu ý kiến phản biện UBMTTQ thành công.', 'success');
      setUbmttqContent('');
      const tasksRes = await getTasksApi();
      if (tasksRes.success && tasksRes.data && tasksRes.data.items) {
        const mapped: Task[] = tasksRes.data.items.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          assignedBy: t.assignerName || 'Lãnh đạo xã',
          assignedByRole: 'Lãnh đạo xã',
          assignee: t.assigneeName || 'Cán bộ xã',
          assigneeRole: 'Cán bộ xã',
          collaborators: [],
          priority: (t.priority as any) || 'Trung_Binh',
          status: (t.status as any) || 'Chua_Lam',
          category: (t.type as any) || 'BAU',
          dueDate: t.dueDate ? t.dueDate.split('T')[0] : '2026-07-29',
          shift: 'Sang' as const,
          startTime: '08:00',
          createdDate: t.createdAt ? t.createdAt.split('T')[0] : '2026-07-26',
          progress: t.progressPercentage || 0,
          effortHours: t.estimatedEffortHours || 8,
          attachments: [],
          comments: [],
          statusHistory: [],
          rating: t.ratingScore,
          rejectionReason: t.rejectionReason,
          context: 'ChuTichUBND' as const
        }));
        setTasks(mapped);
      }
      getActivityLogApi().then(r => { if (r.success && r.data) setActivityLogs(r.data.items); });
    }
  };

  // File upload simulation
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const added: TaskFile[] = Array.from(files).map(f => ({
      name: f.name,
      size: (f.size / 1024).toFixed(1) + ' KB',
      type: f.name.split('.').pop() || 'doc',
    }));
    setAttachedFiles(prev => [...prev, ...added]);
    addToast('Đã đính kèm tệp', `Đã thêm ${added.length} tài liệu vào hồ sơ công việc`, 'info');
  };

  const handleCreateTask = async () => {
    // Validate phân quyền bằng service layer
    const validation = validateTaskAssignment(activeRole, newAssignee, newTitle, newDueDate);
    if (!validation.valid) {
      addToast('Không thể giao việc', validation.error || 'Lỗi phân quyền.', 'danger');
      return;
    }

    // Gửi API thật tới backend /api/v1/Tasks
    try {
      const apiRes = await createTaskApi({
        title: newTitle,
        description: newDesc,
        assignerId: 'a0000000-0000-0000-0000-000000000001', // Admin/Chủ tịch ID
        assigneeId: 'a0000000-0000-0000-0000-000000000001',
        priority: newPriority === 'Khan' ? 'Urgent' : newPriority === 'Cao' ? 'High' : newPriority === 'Trung_Binh' ? 'Medium' : 'Low',
        type: newCategory === 'Dot_Xuat' ? 'AdHoc' : newCategory === 'Du_An' ? 'Project' : 'BAU',
        estimatedEffortHours: parseInt(newEffort) || 8,
        dueDate: newDueDate ? new Date(newDueDate).toISOString() : undefined,
      });

      if (!apiRes.success) {
        addToast('Lỗi backend', apiRes.error || 'Không thể tạo task trên server', 'warning');
      }
    } catch (e) {
      console.warn('API call skipped or failed, persisting local state:', e);
    }

    const fileNames = attachedFiles.map(f => f.name);
    const newTask: Task = {
      id: `CV-2026-${106 + tasks.length}`,
      title: newTitle,
      description: newDesc,
      assignedBy: ROLE_CONFIG[activeRole].label === 'Chủ tịch UBND xã' ? 'Nguyễn Đình Hùng' : ROLE_CONFIG[activeRole].label,
      assignedByRole: ROLE_CONFIG[activeRole].label,
      assignee: newAssignee,
      assigneeRole: SAMPLE_STAFF.find(s => s.name === newAssignee)?.role || '',
      collaborators: [],
      priority: newPriority,
      status: 'Chua_Lam',
      category: newCategory,
      dueDate: newDueDate,
      shift: newShift,
      startTime: newStartTime,
      createdDate: '2026-07-26',
      progress: 0,
      effortHours: parseInt(newEffort) || 8,
      attachments: fileNames,
      comments: [],
      statusHistory: [{
        from: '-', to: 'Chờ làm',
        by: ROLE_CONFIG[activeRole].label, at: '26/07 - ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        asRole: ROLE_CONFIG[activeRole].label,
      }],
      context: activeRole,
    };
    setTasks(prev => [newTask, ...prev]);
    setNewTitle(''); setNewDesc(''); setNewAssignee(''); setNewDueDate('2026-07-29'); setNewEffort('8'); setAttachedFiles([]);
    addToast('Giao việc thành công', `Đã giao nhiệm vụ "${newTask.title}" cho đồng chí ${newAssignee}`, 'success');
    setActiveModule('workcenter');
    setWorkcenterTab('today');
  };

  // Voice simulation
  const handleVoiceToggle = () => {
    if (!isRecording) {
      setIsRecording(true);
      setVoiceText('Đang thu âm...');
      setTimeout(() => {
        setVoiceText('Giao đồng chí Nam rà soát tiến độ thu ngân sách xã tháng 7 và nộp báo cáo trước 17h ngày 29/07.');
        setIsRecording(false);
        addToast('Tiếp nhận thành công', 'Đã nhận dạng giọng nói và tự động điền phiếu giao việc!', 'success');
      }, 2500);
    }
  };

  // OCR AI simulation
  const handleOCR = () => {
    setAiExtracting(true);
    setOcrText('VĂN BẢN CHỈ ĐẠO SỐ 88/UBND-VP: Yêu cầu Phòng Địa chính phối hợp với Công an xã kiểm tra hiện trạng sử dụng đất khu vực cầu Cát Ngạn. Thời hạn hoàn thành báo cáo trình Chủ tịch UBND trước ngày 29/07/2026.');
    setTimeout(() => {
      setAiExtracting(false);
      setAiResult({
        title: 'Kiểm tra hiện trạng sử dụng đất khu vực cầu Cát Ngạn',
        assignee: 'Trần Thị Mai',
        deadline: '2026-07-29',
        priority: 'Khẩn',
        citation: 'Văn bản chỉ đạo số 88/UBND-VP',
        status: 'BẢN NHÁP — Chờ Lãnh đạo duyệt phát hành',
      });
      addToast('Bóc tách văn bản thành công', 'Đã quét và trích xuất nội dung văn bản chỉ đạo!', 'info');
    }, 2000);
  };

  // ── PROMPT F: Direct Document File Upload & AI Analysis Handler ──
  const handleAnalyzeUploadedDocument = async (file: File) => {
    setIsAiAnalyzingFile(true);
    try {
      const res = await uploadAndAnalyzeApi(file);
      if (res.success && res.analysisResult) {
        const ar = res.analysisResult;
        if (ar.title) setNewTitle(ar.title);
        if (ar.summary) {
          const desc = ar.summary + (ar.objectives ? `\n\n🎯 Mục tiêu / Yêu cầu cụ thể:\n${ar.objectives}` : '');
          setNewDesc(desc);
        }
        if (ar.deadlineDate) {
          setNewDueDate(ar.deadlineDate.split('T')[0]);
        }
        if (ar.subjects && Array.isArray(ar.subjects) && ar.subjects.length > 0) {
          const newItems = ar.subjects.map((sub: string, idx: number) => ({
            id: (Date.now() + idx).toString(),
            text: sub,
            done: false
          }));
          setChecklistItems(newItems);
        }
        if (ar.category) {
          const catStr = String(ar.category);
          if (catStr.includes('Du_An') || catStr.includes('Project')) setNewCategory('Du_An');
          else if (catStr.includes('Dot_Xuat') || catStr.includes('AdHoc')) setNewCategory('Dot_Xuat');
          else setNewCategory('BAU');
        }
        if (ar.suggestedDepartmentName) {
          const candidate = activeStaffList.find(s => s.departmentName === ar.suggestedDepartmentName || s.role.includes(ar.suggestedDepartmentName));
          if (candidate) {
            setNewAssignee(candidate.name);
          }
        }
        addToast('Bóc tách văn bản thành công', 'Đã tự động trích xuất tiêu đề, nội dung chỉ đạo, hạn chót và danh mục đầu việc!', 'success');
      } else if (res.aiError) {
        addToast('Thông báo', res.aiError, 'warning');
      } else {
        addToast('Lỗi phân tích', res.error || 'Không thể phân tích tệp văn bản.', 'danger');
      }
    } catch (err: any) {
      addToast('Lỗi', err.message || 'Lỗi khi gửi tệp phân tích.', 'danger');
    } finally {
      setIsAiAnalyzingFile(false);
    }
  };

  // Calendar week navigation
  const handlePrevWeek = () => {
    const [y, m, d] = weekStart.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 7));
    setWeekStart(prev.toISOString().split('T')[0]);
  };
  const handleNextWeek = () => {
    const [y, m, d] = weekStart.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 7));
    setWeekStart(next.toISOString().split('T')[0]);
  };
  const handleTodayWeek = () => {
    setWeekStart('2026-07-20');
  };

  const roleInfo = ROLE_CONFIG[activeRole];
  const weekDays = getWeekDays(weekStart);

  /* ═══════════════════════════════════════════════════════════════
     SIDEBAR MENU ITEMS
     ═══════════════════════════════════════════════════════════════ */
  const sidebarMenuItems: { key: ModuleKey; icon: string; label: string; badge?: number }[] = [
    { key: 'overview', icon: 'table-columns', label: 'Tổng Quan', badge: sidebarBadges.overview },
    { key: 'workcenter', icon: 'briefcase', label: 'Trung Tâm Điều Hành', badge: unprocessedCount > 0 ? unprocessedCount : undefined },
    { key: 'departments', icon: 'sitemap', label: 'Nhân Sự & Phòng Ban', badge: sidebarBadges.departments },
    // Chuyên viên (scopeLevel=3) KHÔNG có quyền giao việc → ẩn module
    ...(canCreateTask(activeRole) ? [{ key: 'create-task' as ModuleKey, icon: 'circle-plus', label: 'Giao Việc Mới', badge: sidebarBadges['create-task'] }] : []),
    { key: 'reports', icon: 'chart-column', label: 'Báo Cáo & Đánh Giá', badge: sidebarBadges.reports },
    ...(SHOW_ACTIVITY_LOG ? [{ key: 'activity-log' as ModuleKey, icon: 'newspaper', label: 'Nhật Ký Hoạt Động' }] : []),
  ];

  const moduleTitles: Record<ModuleKey, string> = {
    'overview': 'Tổng Quan Hệ Thống',
    'workcenter': 'Trung Tâm Điều Hành Công Việc',
    'departments': 'Nhân Sự & Phòng Ban',
    'create-task': 'Giao Việc Mới',
    'reports': 'Báo Cáo & Đánh Giá Năng Lực',
    'activity-log': 'Nhật Ký Hoạt Động',
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="app-layout" suppressHydrationWarning>

      {/* ── SIDEBAR OVERLAY FOR MOBILE ── */}
      {isMobileSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar ${isMobileSidebarOpen ? 'mobile-open' : ''}`} aria-label="Thanh điều hướng ứng dụng" suppressHydrationWarning>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="landmark" size={20} style={{ color: '#dc2626' }} />
            </div>
            <div>
              <div className="org-name">UBND Xã Cát Ngạn</div>
              <div className="system-name">Quản Lý Công Việc & Đánh Giá</div>
              {typeof window !== 'undefined' && window.location.hostname.includes('trycloudflare.com') ? (
                <div style={{
                  marginTop: 6,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: '#fffbe6',
                  border: '1px solid #ffe58f',
                  color: '#d46b08',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }} title="Truy cập từ xa qua Cloudflare luôn ở chế độ Demo để bảo vệ Database thật">
                  <Icon name="shield-halved" size={12} />
                  <span>Sản phẩm thử nghiệm</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={toggleLocalDemoMode}
                  style={{
                    marginTop: 6,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: isLocalDemoMode ? '#fffbe6' : '#f0fdf4',
                    border: `1px solid ${isLocalDemoMode ? '#ffe58f' : '#bbf7d0'}`,
                    color: isLocalDemoMode ? '#d46b08' : '#166534',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                  title="Bấm để bật/tắt chế độ thử nghiệm"
                >
                  <Icon name={isLocalDemoMode ? "shield-halved" : "database"} size={12} />
                  <span>{isLocalDemoMode ? 'Demo' : 'Thực tế'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Menu chức năng chính">
          {sidebarMenuItems.map(item => (
            <button
              key={item.key}
              type="button"
              className={`sidebar-item ${activeModule === item.key ? 'active' : ''}`}
              onClick={() => {
                setActiveModule(item.key);
                setIsMobileSidebarOpen(false);
              }}
            >
              <Icon name={item.icon} size={16} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="sidebar-badge">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User profile inside sidebar */}
        <div className="sidebar-user">
          <div className="user-avatar">HÚNG</div>
          <div className="user-info">
            <div className="user-name">Nguyễn Đình Hùng</div>
            <div className="user-role">{roleInfo.label}</div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="main-wrapper">

        {/* TOP NAVBAR */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="mobile-toggle-btn"
              onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
              title="Mở menu"
            >
              <Icon name="bars" size={18} />
            </button>
            <h1 className="page-title">{moduleTitles[activeModule]}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Search input */}
            <div style={{ position: 'relative', width: 220 }}>
              <input
                className="form-input"
                style={{ paddingLeft: 30, fontSize: '0.82rem', height: 34 }}
                placeholder="Tìm công việc, cán bộ…"
                aria-label="Tìm kiếm công việc hoặc cán bộ"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Icon name="magnifying-glass" size={13} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            </div>

            {/* Pending Rating Revisions Button for Superior Leaders */}
            {pendingRatingRevisions.length > 0 && (
              <button
                type="button"
                className="btn btn-warning btn-sm"
                style={{
                  position: 'relative',
                  padding: '6px 12px',
                  background: '#fffbeb',
                  borderColor: '#fef3c7',
                  color: '#b45309',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                onClick={() => setShowPendingRatingRevisionsModal(true)}
                title="Các đề xuất sửa điểm đánh giá chờ Cấp trên duyệt"
              >
                <Icon name="clock" size={13} style={{ color: '#d97706' }} />
                <span>Chờ duyệt sửa điểm</span>
                <span className="badge" style={{ background: '#d97706', color: '#fff', fontSize: '0.7rem', padding: '1px 5px', borderRadius: 10 }}>
                  {pendingRatingRevisions.length}
                </span>
              </button>
            )}

            {/* Notification Bell Icon & Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ position: 'relative', padding: '6px 12px', background: showNotifDropdown ? '#eff6ff' : '#fff' }}
                onClick={() => setShowNotifDropdown(prev => !prev)}
                title="Thông báo nhắc việc"
              >
                <Icon name="bell" size={15} style={{ color: unreadNotifCount > 0 ? '#dc2626' : '#64748b' }} />
                {unreadNotifCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    background: '#dc2626',
                    color: '#fff',
                    borderRadius: '50%',
                    fontSize: '0.68rem',
                    fontWeight: 'bold',
                    width: 18,
                    height: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #fff'
                  }}>
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {showNotifDropdown && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 42,
                  width: 360,
                  maxHeight: 420,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  zIndex: 9999,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>🔔 Thông Báo ({unreadNotifCount} chưa đọc)</span>
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                        onClick={handleMarkAllNotificationsRead}
                      >
                        Đánh dấu tất cả đã đọc
                      </button>
                    )}
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
                    {notificationsList.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                        Không có thông báo nào.
                      </div>
                    ) : (
                      notificationsList.map(n => (
                        <div
                          key={n.id}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #f1f5f9',
                            background: n.isRead ? '#ffffff' : '#f0f9ff',
                            cursor: 'pointer',
                            transition: 'background 0.15s'
                          }}
                          onClick={() => handleNotificationClick(n)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: n.type === 'Escalation' ? '#dc2626' : n.type === 'Overdue' ? '#d97706' : '#1e293b' }}>
                              {n.title}
                            </span>
                            {!n.isRead && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />}
                          </div>
                          <p style={{ fontSize: '0.78rem', color: '#475569', margin: '2px 0 4px 0', lineHeight: 1.35 }}>
                            {n.message}
                          </p>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {formatDateTimeDisplay(n.createdAt)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ padding: '8px 12px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}
                      onClick={() => {
                        setShowNotifDropdown(false);
                        handleOpenPushSettings();
                      }}
                    >
                      <Icon name="mobile-screen-button" size={12} />
                      <span>Cài đặt thông báo trên thiết bị</span>
                    </button>
                    <span style={{ fontSize: '0.7rem', color: isPushSubscribed ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                      {isPushSubscribed ? '● Đã bật' : '○ Chưa bật'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Web Push Notification Quick Access Button */}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{
                position: 'relative',
                padding: '6px 12px',
                background: isPushSubscribed ? '#f0fdf4' : '#fff',
                borderColor: isPushSubscribed ? '#bbf7d0' : '#e2e8f0',
                color: isPushSubscribed ? '#166534' : '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              onClick={handleOpenPushSettings}
              title={isPushSubscribed ? 'Thông báo tức thời: Đang hoạt động trên thiết bị này' : 'Bật nhận thông báo trực tiếp trên điện thoại / máy tính'}
            >
              <Icon name="mobile-screen-button" size={13} style={{ color: isPushSubscribed ? '#16a34a' : '#64748b' }} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Nhận thông báo</span>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: isPushSubscribed ? '#22c55e' : '#94a3b8',
                boxShadow: isPushSubscribed ? '0 0 6px #22c55e' : 'none'
              }} />
            </button>

            {/* Leader Pending Rating Revision Approvals Badge */}
            {ROLE_CONFIG[activeRole].scopeLevel <= 2.0 && pendingRatingRevisions.length > 0 && (
              <button
                type="button"
                className="btn btn-warning btn-sm"
                onClick={() => setShowPendingRatingRevisionsModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                <Icon name="clock-rotate-left" size={13} />
                <span>Duyệt sửa điểm</span>
                <span className="badge" style={{ background: '#ffffff', color: '#d97706', fontSize: '0.7rem', padding: '1px 6px' }}>
                  {pendingRatingRevisions.length}
                </span>
              </button>
            )}

            {/* Print button */}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowPrintModal(true)}>
              <Icon name="print" size={13} /> In Lịch Tuần
            </button>

            {/* Switch Role dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '4px 10px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <Icon name="user-gear" size={14} style={{ color: '#2563eb' }} />
              <label htmlFor="topbar-role-select" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', margin: 0, cursor: 'pointer' }}>Vai trò:</label>
              <select
                id="topbar-role-select"
                aria-label="Chọn vai trò điều hành công vụ"
                className="form-select"
                style={{ padding: '2px 8px', fontSize: '0.8rem', height: 28, width: 'auto', border: 'none', background: 'transparent', fontWeight: 800, color: '#1e293b' }}
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value as RoleCode)}
              >
                <optgroup label="── Đảng ủy ──">
                  <option value="BiThuDU">⭐ Bí thư Đảng ủy xã</option>
                </optgroup>
                <optgroup label="── UBND ──">
                  <option value="ChuTichUBND">🏛️ Chủ tịch UBND xã</option>
                  <option value="PhoChuTichUBND_ChanhVP">📋 Phó CT UBND (Chánh VP)</option>
                  <option value="PhoChuTichUBND_TTPHCC">🏢 Phó CT UBND (GĐ TTPHCC)</option>
                </optgroup>
                <optgroup label="── HĐND ──">
                  <option value="ChuTichHDND">📜 Chủ tịch HĐND xã</option>
                  <option value="PhoChuTichHDND">⚖️ Phó CT HĐND (chuyên trách)</option>
                </optgroup>
                <optgroup label="── Phòng/Ban ──">
                  <option value="TruongPhong">🏗️ Trưởng phòng</option>
                  <option value="PhoPhong">👔 Phó Trưởng phòng</option>
                  <option value="ChuyenVien">👤 Chuyên viên</option>
                </optgroup>
              </select>
            </div>

            {/* Logout button */}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              onClick={() => {
                setIsLoggedIn(false);
                addToast('Đã đăng xuất', 'Bạn đã đăng xuất khỏi hệ thống thành công', 'info');
              }}
              title="Đăng xuất khỏi hệ thống"
            >
              <Icon name="right-from-bracket" size={13} style={{ color: '#dc2626' }} /> Đăng Xuất
            </button>
          </div>
        </header>

        {/* MAIN BODY CONTAINER */}
        <main className="content-area">

          {/* ═════════════════════════════════════════
             MODULE 1: TỔNG QUAN HỆ THỐNG
             ═════════════════════════════════════════ */}
          {activeModule === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Daily Notification bar */}
              <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="bell" size={18} style={{ color: '#2563eb' }} />
                <div>
                  <strong>Thông báo nhiệm vụ hôm nay ({formatDateDisplay(new Date().toISOString())}):</strong> Hệ thống ghi nhận <strong>{kpiData.active}</strong> công việc đang xử lý, <strong>{kpiData.pendingApproval}</strong> việc chờ duyệt, và <strong>{unreadNotifCount}</strong> thông báo mới trong ngày!
                </div>
              </div>

              {/* KPI Cards Grid */}
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-label">Công Việc Đang Xử Lý</div>
                  <div className="kpi-value" style={{ color: '#2563eb' }}>{kpiData.active}</div>
                  <div className="kpi-hint">Đang giao & làm trong ca</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Sắp Đến Hạn (≤2 Ngày)</div>
                  <div className="kpi-value" style={{ color: '#d97706' }}>{kpiData.nearDeadline}</div>
                  <div className="kpi-hint">Cần đôn đốc khẩn trương</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Quá Hạn Đang Tồn</div>
                  <div className="kpi-value" style={{ color: '#dc2626' }}>{kpiData.overdue}</div>
                  <div className="kpi-hint">Cảnh báo vi phạm tiến độ</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Chờ Duyệt Nghiệm Thu</div>
                  <div className="kpi-value" style={{ color: '#7c3aed' }}>{kpiData.pendingApproval}</div>
                  <div className="kpi-hint">Lãnh đạo cần phê duyệt</div>
                </div>
              </div>

              {/* Quick Actions & Recent Activities */}
              <div style={{ display: 'grid', gridTemplateColumns: SHOW_ACTIVITY_LOG ? '2fr 1fr' : '1fr', gap: 20 }}>
                {/* Left: Latest Notifications */}
                <div className="card">
                  <div className="card-header">
                    <h2><Icon name="bell" size={18} style={{ color: '#2563eb' }} /> Thông Báo Mới Nhất</h2>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveModule('workcenter')}>Trung Tâm Điều Hành</button>
                  </div>
                  <div className="card-body" style={{ padding: '8px 16px' }}>
                    {notificationsList.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
                        Không có thông báo mới nào.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {notificationsList.slice(0, 5).map(n => (
                          <div
                            key={n.id}
                            style={{
                              padding: '12px 14px',
                              borderRadius: 8,
                              border: '1px solid #e2e8f0',
                              background: n.isRead ? '#ffffff' : '#f0f9ff',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'all 0.15s ease'
                            }}
                            onClick={() => handleNotificationClick(n)}
                          >
                            <div style={{ flex: 1, paddingRight: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: n.type === 'Escalation' ? '#dc2626' : n.type === 'Overdue' ? '#d97706' : '#1e293b' }}>
                                  {n.title}
                                </span>
                                {!n.isRead && (
                                  <span className="badge badge-urgent" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>Mới</span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.4 }}>{n.message}</div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {formatDateTimeDisplay(n.createdAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Activity Log (Ẩn/Hiện bằng SHOW_ACTIVITY_LOG flag) */}
                {/* {SHOW_ACTIVITY_LOG && (
                  <div className="card">
                    <div className="card-header">
                      <h2><Icon name="clock-rotate-left" size={18} style={{ color: '#2563eb' }} /> Nhật Ký Hoạt Động</h2>
                    </div>
                    <div className="card-body">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {SAMPLE_ACTIVITIES.map(act => (
                          <div key={act.id} style={{ fontSize: '0.82rem', paddingBottom: 10, borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <Icon name={act.type === 'approve' ? 'circle-check' : act.type === 'overdue' ? 'triangle-exclamation' : 'comment'} size={14} style={{ color: act.type === 'approve' ? '#16a34a' : act.type === 'overdue' ? '#dc2626' : '#2563eb', marginTop: 2, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div>{act.text}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{act.time}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )} */}
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
             UNIFIED MODULE: TRUNG TÂM ĐIỀU HÀNH CÔNG VIỆC (WORKCENTER)
             ═══════════════════════════════════════════════════════════════ */}
          {activeModule === 'workcenter' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Work Center Tab Navigation Bar */}
              <div className="dept-sub-tabs" role="tablist" aria-label="Các trạng thái vòng đời công việc" style={{ marginBottom: 4 }}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={workcenterTab === 'incoming'}
                  className={`dept-sub-tab ${workcenterTab === 'incoming' ? 'active' : ''}`}
                  onClick={() => { setWorkcenterTab('incoming'); setSelectedMailId(null); }}
                >
                  <Icon name="envelope-open-text" size={14} />
                  <span>Đến — Chưa xử lý</span>
                  <span className="badge badge-urgent" style={{ fontSize: '0.7rem', padding: '1px 6px', marginLeft: 4 }}>
                    {inboxItems.filter(m => m.folder !== 'scheduled' && m.status !== 'scheduled').length}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={workcenterTab === 'scheduled'}
                  className={`dept-sub-tab ${workcenterTab === 'scheduled' ? 'active' : ''}`}
                  onClick={() => { setWorkcenterTab('scheduled'); setSelectedMailId(null); }}
                >
                  <Icon name="calendar-check" size={14} />
                  <span>Đã xếp lịch</span>
                  <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '1px 6px', marginLeft: 4 }}>
                    {inboxItems.filter(m => m.folder === 'scheduled' || m.status === 'scheduled').length}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={workcenterTab === 'today'}
                  className={`dept-sub-tab ${workcenterTab === 'today' ? 'active' : ''}`}
                  onClick={() => setWorkcenterTab('today')}
                >
                  <Icon name="sun" size={14} />
                  <span>Hôm nay</span>
                  <span className="badge badge-blue" style={{ fontSize: '0.7rem', padding: '1px 6px', marginLeft: 4 }}>
                    {myDayFilteredTasks.length}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={workcenterTab === 'week'}
                  className={`dept-sub-tab ${workcenterTab === 'week' ? 'active' : ''}`}
                  onClick={() => setWorkcenterTab('week')}
                >
                  <Icon name="calendar-days" size={14} />
                  <span>Tuần này (Lưới ca)</span>
                  <span className="badge badge-medium" style={{ fontSize: '0.7rem', padding: '1px 6px', marginLeft: 4 }}>
                    {visibleTasks.length}
                  </span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={workcenterTab === 'outgoing'}
                  className={`dept-sub-tab ${workcenterTab === 'outgoing' ? 'active' : ''}`}
                  onClick={() => setWorkcenterTab('outgoing')}
                >
                  <Icon name="paper-plane" size={14} />
                  <span>Văn Bản Đi (Sổ Công Văn Đi)</span>
                  {outgoingTotalCount > 0 && (
                    <span className="badge badge-blue" style={{ fontSize: '0.7rem', padding: '1px 6px', marginLeft: 4 }}>
                      {outgoingTotalCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Shared Search & Filter Bar */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: '#ffffff', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
                  <Icon name="magnifying-glass" size={14} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder={workcenterTab === 'incoming' || workcenterTab === 'scheduled' ? "Tìm theo số, ký hiệu, trích yếu, cơ quan ban hành..." : "Tìm theo tiêu đề, số ký hiệu, người giao..."}
                    value={myDaySearchQuery}
                    onChange={(e) => handleMyDaySearchChange(e.target.value)}
                    style={{ paddingLeft: 34, height: 36, fontSize: '0.85rem' }}
                  />
                </div>

                {workcenterTab === 'today' || workcenterTab === 'week' ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label htmlFor="wc-status-select" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>Trạng thái:</label>
                      <select
                        id="wc-status-select"
                        className="form-select"
                        value={myDayStatusFilter}
                        onChange={(e) => handleMyDayStatusChange(e.target.value as TaskStatus | 'all')}
                        style={{ height: 36, fontSize: '0.82rem', padding: '0 8px' }}
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="Chua_Lam">Chờ làm</option>
                        <option value="Dang_Xu_Ly">Đang xử lý</option>
                        <option value="Cho_Duyet">Chờ duyệt</option>
                        <option value="Hoan_Thanh">Hoàn thành</option>
                        <option value="Tu_Choi">Từ chối</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label htmlFor="wc-priority-select" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>Độ ưu tiên:</label>
                      <select
                        id="wc-priority-select"
                        className="form-select"
                        value={myDayPriorityFilter}
                        onChange={(e) => handleMyDayPriorityChange(e.target.value as TaskPriority | 'all')}
                        style={{ height: 36, fontSize: '0.82rem', padding: '0 8px' }}
                      >
                        <option value="all">Tất cả độ ưu tiên</option>
                        <option value="Khan">Khẩn cấp</option>
                        <option value="Cao">Ưu tiên cao</option>
                        <option value="Trung_Binh">Trung bình</option>
                        <option value="Thuong">Thường</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label htmlFor="wc-shift-select" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>Ca:</label>
                      <select
                        id="wc-shift-select"
                        className="form-select"
                        value={myDayShiftFilter}
                        onChange={(e) => handleMyDayShiftChange(e.target.value as ShiftType | 'all')}
                        style={{ height: 36, fontSize: '0.82rem', padding: '0 8px' }}
                      >
                        <option value="all">Tất cả ca</option>
                        <option value="Sang">Sáng</option>
                        <option value="Chieu">Chiều</option>
                      </select>
                    </div>
                  </>
                ) : null}

                {(myDaySearchQuery || myDayStatusFilter !== 'all' || myDayPriorityFilter !== 'all' || myDayShiftFilter !== 'all') && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleMyDayResetFilters} style={{ height: 36 }}>
                    <Icon name="rotate-left" size={12} /> Đặt lại
                  </button>
                )}
              </div>

              {/* ── TAB 1: ĐẾN — CHƯA XỬ LÝ (INBOX UNPROCESSED) ── */}
              {workcenterTab === 'incoming' && (
                <div className="inbox-container">
                  {/* Left Pane: Document List */}
                  <div className="inbox-sidebar" style={{ width: 380 }}>
                    <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>VĂN BẢN ĐẾN CHƯA XẾP LỊCH ({inboxItems.filter(m => m.folder !== 'scheduled' && m.status !== 'scheduled').length})</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Ưu tiên khẩn lên đầu</span>
                    </div>

                    <div className="inbox-mail-list">
                      {inboxItems
                        .filter(m => m.folder !== 'scheduled' && m.status !== 'scheduled')
                        .filter(m => !myDaySearchQuery.trim() ||
                          m.subject.toLowerCase().includes(myDaySearchQuery.toLowerCase()) ||
                          m.senderName.toLowerCase().includes(myDaySearchQuery.toLowerCase()) ||
                          (m.documentNumber && m.documentNumber.toLowerCase().includes(myDaySearchQuery.toLowerCase())) ||
                          (m.documentSymbol && m.documentSymbol.toLowerCase().includes(myDaySearchQuery.toLowerCase())))
                        .sort((a, b) => (b.isUrgent ? 1 : 0) - (a.isUrgent ? 1 : 0))
                        .map(mail => (
                          <div
                            key={mail.id}
                            className={`inbox-mail-card ${selectedMailId === mail.id ? 'active' : ''}`}
                            onClick={() => {
                              setSelectedMailId(mail.id);
                              if (mail.status === 'unread') {
                                setInboxItems(prev => prev.map(m => m.id === mail.id ? { ...m, status: 'read' } : m));
                              }
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="doc-agency-name">{mail.issuingAgency || mail.senderOrg || mail.senderName}</span>
                              {mail.isUrgent ? (
                                <span className="badge badge-urgent" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>THƯỢNG KHẨN</span>
                              ) : (
                                <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 6px', background: '#e2e8f0', color: '#475569' }}>THƯỜNG</span>
                              )}
                            </div>
                            <div className="doc-number-symbol">
                              Số: {mail.documentNumber || '---'}/{mail.documentSymbol || 'UBND-VP'}
                            </div>
                            <div className="doc-subject-preview">
                              {mail.subject}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                              <span>📅 Ban hành: {formatDateDisplay(mail.issuedDate || mail.date)}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Right Pane: Document Details & Actions */}
                  <div className="inbox-detail">
                    {selectedMail ? (
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span className="doc-number-symbol" style={{ fontSize: '0.85rem' }}>
                                  Số: {selectedMail.documentNumber || '---'}/{selectedMail.documentSymbol || 'UBND-VP'}
                                </span>
                                {selectedMail.isUrgent && <span className="badge badge-urgent">THƯỢNG KHẨN</span>}
                                <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>{selectedMail.category || 'Công văn'}</span>
                              </div>
                              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.35 }}>
                                {selectedMail.subject}
                              </h2>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setScheduleSourceMail(selectedMail);
                                  setScheduleTitle(selectedMail.subject);
                                  setScheduleDescription(`Xếp lịch xử lý văn bản Số: ${selectedMail.documentNumber || '---'}/${selectedMail.documentSymbol || 'UBND-VP'}: ${selectedMail.subject}`);
                                  setShowScheduleModal(true);
                                }}
                              >
                                <Icon name="calendar-plus" size={13} /> Xếp lịch công tác
                              </button>

                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={async () => {
                                  const tomorrow = new Date();
                                  tomorrow.setDate(tomorrow.getDate() + 1);
                                  const dateStr = tomorrow.toISOString().split('T')[0];
                                  const shift = selectedMail.isUrgent ? 'Sang' : 'Chieu';

                                  setInboxItems(prev => prev.map(m => m.id === selectedMail.id ? { ...m, folder: 'scheduled', status: 'scheduled', deadline: dateStr } : m));
                                  addToast('Đã xếp lịch công tác', `Đã bố trí lịch xử lý "${selectedMail.subject}" vào ca ${shift === 'Sang' ? 'SÁNG' : 'CHIỀU'} ngày ${formatDateDisplay(dateStr)}.`, 'success');
                                  await scheduleInboxDocumentApi(selectedMail.id, dateStr, shift);
                                }}
                              >
                                <Icon name="calendar-check" size={13} style={{ color: '#2563eb' }} /> Bố trí lịch tự động
                              </button>

                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                style={{ borderColor: '#3b82f6', color: '#1d4ed8', background: '#eff6ff', fontWeight: 600 }}
                                onClick={() => {
                                  setAiUploadTargetDocId(selectedMail.id);
                                  setAiUploadTargetDocSymbol(selectedMail.documentNumber || selectedMail.documentSymbol || 'Văn bản');
                                  setShowAiUploadModal(true);
                                }}
                              >
                                <Icon name="wand-magic-sparkles" size={13} style={{ color: '#2563eb' }} /> Bóc tách & Phân tích AI
                              </button>

                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => {
                                  setCreateTaskSource(selectedMail);
                                  setNewTitle(selectedMail.subject);
                                  setNewDesc(`Giao việc xử lý công văn Số: ${selectedMail.documentNumber || '---'}/${selectedMail.documentSymbol || 'UBND-VP'}\nTrích yếu: ${selectedMail.subject}\nNội dung chỉ đạo: ${selectedMail.content}`);
                                  setNewPriority(selectedMail.isUrgent ? 'Khan' : 'Trung_Binh');
                                  setActiveModule('create-task');
                                }}
                              >
                                <Icon name="user-plus" size={13} /> Giao việc từ văn bản
                              </button>
                            </div>
                          </div>

                          {/* Metadata Grid per NĐ 30/2020 */}
                          <div className="doc-detail-grid" style={{ marginBottom: 0 }}>
                            <div className="doc-meta-item">
                              <span className="doc-meta-label">Cơ quan ban hành</span>
                              <span className="doc-meta-value">{selectedMail.issuingAgency || selectedMail.senderOrg || selectedMail.senderName}</span>
                            </div>
                            <div className="doc-meta-item">
                              <span className="doc-meta-label">Số / Ký hiệu</span>
                              <span className="doc-meta-value" style={{ color: '#2563eb' }}>{selectedMail.documentNumber || '---'}/{selectedMail.documentSymbol || 'UBND-VP'}</span>
                            </div>
                            <div className="doc-meta-item">
                              <span className="doc-meta-label">Loại văn bản</span>
                              <span className="doc-meta-value">{selectedMail.category || 'Công văn'}</span>
                            </div>
                            <div className="doc-meta-item">
                              <span className="doc-meta-label">Ngày ban hành</span>
                              <span className="doc-meta-value">{formatDateDisplay(selectedMail.issuedDate || selectedMail.date)}</span>
                            </div>
                            <div className="doc-meta-item">
                              <span className="doc-meta-label">Người ký</span>
                              <span className="doc-meta-value">{selectedMail.signerName || 'Lãnh đạo cơ quan'}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>Nội dung trích yếu / Chỉ đạo:</div>
                          <div style={{ fontSize: '0.92rem', color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                            {selectedMail.content}
                          </div>

                          {selectedMail.attachments.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 10 }}>File đính kèm chính ({selectedMail.attachments.length}):</div>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                {selectedMail.attachments.map((att, idx) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                                    <Icon name="file-pdf" size={20} style={{ color: '#dc2626' }} />
                                    <div>
                                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{att.name}</div>
                                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{att.size}</div>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      onClick={() => {
                                        setViewerMail(selectedMail);
                                        setShowViewerModal(true);
                                      }}
                                      style={{ marginLeft: 8, height: 28, fontSize: '0.75rem' }}
                                    >
                                      <Icon name="eye" size={12} /> Xem
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', padding: 40 }}>
                        <Icon name="envelope-open" size={48} style={{ color: '#cbd5e1', marginBottom: 16 }} />
                        <h3 style={{ fontSize: '1.05rem', color: '#475569', margin: 0 }}>Chưa chọn văn bản</h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: 320, textAlign: 'center', marginTop: 6 }}>
                          Vui lòng chọn một văn bản từ danh sách bên trái để xem thông tin chi tiết và thực hiện xếp lịch.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB 2: ĐÃ XẾP LỊCH (SCHEDULED INBOX) ── */}
              {workcenterTab === 'scheduled' && (
                <div className="inbox-container">
                  {/* Left Pane: Scheduled Document List */}
                  <div className="inbox-sidebar" style={{ width: 380 }}>
                    <div style={{ padding: '10px 14px', background: '#ecfdf5', borderBottom: '1px solid #a7f3d0', fontSize: '0.8rem', fontWeight: 700, color: '#047857', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>VĂN BẢN ĐÃ XẾP LỊCH ({inboxItems.filter(m => m.folder === 'scheduled' || m.status === 'scheduled').length})</span>
                      <Icon name="circle-check" size={14} style={{ color: '#10b981' }} />
                    </div>

                    <div className="inbox-mail-list">
                      {inboxItems
                        .filter(m => m.folder === 'scheduled' || m.status === 'scheduled')
                        .filter(m => !myDaySearchQuery.trim() ||
                          m.subject.toLowerCase().includes(myDaySearchQuery.toLowerCase()) ||
                          m.senderName.toLowerCase().includes(myDaySearchQuery.toLowerCase()) ||
                          (m.documentNumber && m.documentNumber.toLowerCase().includes(myDaySearchQuery.toLowerCase())) ||
                          (m.documentSymbol && m.documentSymbol.toLowerCase().includes(myDaySearchQuery.toLowerCase())))
                        .map(mail => (
                          <div
                            key={mail.id}
                            className={`inbox-mail-card ${selectedMailId === mail.id ? 'active' : ''}`}
                            onClick={() => setSelectedMailId(mail.id)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="doc-agency-name">{mail.issuingAgency || mail.senderOrg || mail.senderName}</span>
                              <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>ĐÃ XẾP LỊCH</span>
                            </div>
                            <div className="doc-number-symbol">
                              Số: {mail.documentNumber || '---'}/{mail.documentSymbol || 'UBND-VP'}
                            </div>
                            <div className="doc-subject-preview">
                              {mail.subject}
                            </div>
                            <div className="doc-schedule-date">
                              <Icon name="calendar-day" size={12} />
                              <span>📅 Xử lý: {formatDateDisplay(mail.deadline || mail.date)}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Right Pane: Scheduled Document Details & Timeline */}
                  <div className="inbox-detail">
                    {selectedMail ? (
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                          <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <Icon name="circle-check" size={18} style={{ color: '#10b981' }} />
                            <div>
                              <strong>Văn bản đã được xếp lịch xử lý!</strong> Ngày xử lý dự kiến: <strong>{formatDateDisplay(selectedMail.deadline || selectedMail.date)}</strong>. Công việc đã xuất hiện trong Trung tâm điều hành.
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span className="doc-number-symbol" style={{ fontSize: '0.85rem' }}>
                                  Số: {selectedMail.documentNumber || '---'}/{selectedMail.documentSymbol || 'UBND-VP'}
                                </span>
                                <span className="badge badge-success">ĐÃ XẾP LỊCH XỬ LÝ</span>
                                {selectedMail.isUrgent && <span className="badge badge-urgent">KHẨN</span>}
                              </div>
                              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.35 }}>
                                {selectedMail.subject}
                              </h2>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => {
                                  setViewerMail(selectedMail);
                                  setShowViewerModal(true);
                                }}
                              >
                                <Icon name="eye" size={13} /> Xem file PDF
                              </button>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => {
                                  setHistoryDocItem(selectedMail);
                                  setShowHistoryModal(true);
                                }}
                              >
                                <Icon name="clock-rotate-left" size={13} /> Lịch sử & Audit Log
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setActiveModule('workcenter');
                                  setWorkcenterTab('week');
                                }}
                              >
                                <Icon name="arrow-right" size={13} /> Đến danh sách công việc
                              </button>
                            </div>
                          </div>

                          {/* Metadata Grid per NĐ 30/2020 */}
                          <div className="doc-detail-grid" style={{ marginBottom: 0 }}>
                            <div className="doc-meta-item">
                              <span className="doc-meta-label">Cơ quan ban hành</span>
                              <span className="doc-meta-value">{selectedMail.issuingAgency || selectedMail.senderOrg || selectedMail.senderName}</span>
                            </div>
                            <div className="doc-meta-item">
                              <span className="doc-meta-label">Số / Ký hiệu</span>
                              <span className="doc-meta-value" style={{ color: '#2563eb' }}>Số: {selectedMail.documentNumber || '---'}/{selectedMail.documentSymbol || 'UBND-VP'}</span>
                            </div>
                            <div className="doc-meta-item">
                              <span className="doc-meta-label">Loại văn bản</span>
                              <span className="doc-meta-value">{selectedMail.category || 'Công văn'}</span>
                            </div>
                            <div className="doc-meta-item">
                              <span className="doc-meta-label">Ngày ban hành</span>
                              <span className="doc-meta-value">{formatDateDisplay(selectedMail.issuedDate || selectedMail.date)}</span>
                            </div>
                            <div className="doc-meta-item">
                              <span className="doc-meta-label">Người ký</span>
                              <span className="doc-meta-value">{selectedMail.signerName || 'Lãnh đạo cơ quan'}</span>
                            </div>
                            <div className="doc-meta-item">
                              <span className="doc-meta-label">Lịch xử lý</span>
                              <span className="doc-meta-value" style={{ color: '#047857' }}>{formatDateDisplay(selectedMail.deadline || selectedMail.date)}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 8 }}>Nội dung trích yếu / Chỉ đạo:</div>
                          <div style={{ fontSize: '0.92rem', color: '#1e293b', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                            {selectedMail.content}
                          </div>

                          {/* Attachments Section */}
                          {selectedMail.attachments.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 10 }}>File đính kèm chính ({selectedMail.attachments.length}):</div>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                {selectedMail.attachments.map((att, idx) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                                    <Icon name="file-pdf" size={20} style={{ color: '#dc2626' }} />
                                    <div>
                                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{att.name}</div>
                                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{att.size}</div>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      onClick={() => addToast('Xem văn bản', `Đang mở trình xem file cho ${att.name}...`, 'info')}
                                      style={{ marginLeft: 8, height: 28, fontSize: '0.75rem' }}
                                    >
                                      <Icon name="eye" size={12} /> Xem
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Requirement XIII: Processing Timeline */}
                          <div style={{ background: '#ffffff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Icon name="clock-rotate-left" size={14} style={{ color: '#2563eb' }} />
                              <span>LỊCH SỬ TIẾN TRÌNH XỬ LÝ VĂN BẢN</span>
                            </div>
                            <div className="doc-timeline">
                              <div className="doc-timeline-item completed">
                                <div className="doc-timeline-title">1. Tiếp nhận văn bản đến</div>
                                <div className="doc-timeline-date">{formatDateDisplay(selectedMail.date)} — Nhận từ {selectedMail.issuingAgency || selectedMail.senderOrg || selectedMail.senderName}</div>
                              </div>
                              <div className="doc-timeline-item completed">
                                <div className="doc-timeline-title">2. Xếp lịch xử lý công tác</div>
                                <div className="doc-timeline-date">{formatDateDisplay(selectedMail.deadline || selectedMail.date)} — Đã thêm vào lịch công tác cán bộ</div>
                              </div>
                              <div className="doc-timeline-item">
                                <div className="doc-timeline-title">3. Đang thực hiện xử lý công việc</div>
                                <div className="doc-timeline-date">Phân công cán bộ chuyên môn phụ trách triển khai</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', padding: 40 }}>
                        <Icon name="calendar-check" size={48} style={{ color: '#a7f3d0', marginBottom: 16 }} />
                        <h3 style={{ fontSize: '1.05rem', color: '#475569', margin: 0 }}>Chọn một văn bản đã xếp lịch</h3>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: 320, textAlign: 'center', marginTop: 6 }}>
                          Xem thông tin xếp lịch chi tiết và theo dõi tiến độ thực hiện.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB 3: HÔM NAY (MY DAY VIEW) ── */}
              {workcenterTab === 'today' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon name="sun" size={20} style={{ color: '#d97706' }} />
                    <div>
                      <strong>Việc Của Tôi Hôm Nay ({formatDateDisplay(new Date().toISOString())}):</strong> Đang làm việc với vai trò <strong>{ROLE_CONFIG[activeRole].label}</strong>. Danh sách tập trung công việc cần xử lý trong ngày.
                    </div>
                  </div>

                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-label">Tổng Công Việc Khớp Lọc</div>
                      <div className="kpi-value" style={{ color: '#2563eb' }}>{myDayFilteredTasks.length}</div>
                      <div className="kpi-hint">Đang hiển thị trên bảng</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">Đang Xử Lý Trong Ca</div>
                      <div className="kpi-value" style={{ color: '#d97706' }}>{myDayFilteredTasks.filter(t => t.status === 'Dang_Xu_Ly').length}</div>
                      <div className="kpi-hint">Cần tập trung hoàn thành</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">Chờ Phê Duyệt</div>
                      <div className="kpi-value" style={{ color: '#7c3aed' }}>{myDayFilteredTasks.filter(t => t.status === 'Cho_Duyet').length}</div>
                      <div className="kpi-hint">Chờ Lãnh đạo nghiệm thu</div>
                    </div>
                    <div className="kpi-card">
                      <div className="kpi-label">Đã Hoàn Thành</div>
                      <div className="kpi-value" style={{ color: '#16a34a' }}>{myDayFilteredTasks.filter(t => t.status === 'Hoan_Thanh').length}</div>
                      <div className="kpi-hint">Đã nghiệm thu đạt chuẩn</div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <h2><Icon name="list-check" size={18} style={{ color: '#2563eb' }} /> Danh Sách Công Việc Trong Ngày</h2>
                      <span className="badge badge-blue">Trang {myDayCurrentPage} / {myDayTotalPages}</span>
                    </div>

                    <div className="card-body" style={{ padding: 0 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th scope="col">Mã CV / Tiêu đề</th>
                            <th scope="col">Người thực hiện</th>
                            <th scope="col">Ca / Giờ</th>
                            <th scope="col">Độ ưu tiên</th>
                            <th scope="col">Hạn chót</th>
                            <th scope="col">Trạng thái</th>
                            <th scope="col" style={{ textAlign: 'center' }}>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myDayPaginatedTasks.length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                Không tìm thấy công việc nào phù hợp với bộ lọc.
                              </td>
                            </tr>
                          ) : (
                            myDayPaginatedTasks.map(task => (
                              <tr key={task.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTaskId(task.id)}>
                                <td>
                                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>{task.title}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Mã: <strong>{task.id}</strong> • Giao bởi: {task.assignedBy} ({task.assignedByRole})
                                  </div>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{task.assignee}</span>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{task.assigneeRole}</div>
                                </td>
                                <td>
                                  <span className="badge badge-blue">
                                    <Icon name={SHIFT_CONFIG[task.shift].icon} size={11} /> {SHIFT_CONFIG[task.shift].label} ({task.startTime})
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${getPriorityBadge(task.priority)}`}>
                                    {PRIORITY_LABELS[task.priority]}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 700, color: getDaysUntilDue(task.dueDate) < 0 ? '#dc2626' : '#d97706' }}>
                                    {formatDateDisplay(task.dueDate)}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${getStatusBadge(task.status)}`}>
                                    {STATUS_LABELS[task.status]}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-xs"
                                      onClick={(e) => handleSwapShift(e, task.id, task.shift)}
                                      title="Đổi ca làm việc"
                                    >
                                      <Icon name="arrow-right-arrow-left" size={10} /> Đổi ca
                                    </button>

                                    {task.status === 'Cho_Duyet' && ROLE_CONFIG[activeRole].scopeLevel <= 2.5 && (
                                      <button
                                        type="button"
                                        className="btn btn-success btn-xs"
                                        onClick={() => handleApproveTask(task.id)}
                                      >
                                        <Icon name="check" size={10} /> Duyệt
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Footer */}
                    {myDayTotalPages > 1 && (
                      <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label htmlFor="my-day-page-size-wc" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Số dòng/trang:</label>
                          <select
                            id="my-day-page-size-wc"
                            className="form-select"
                            value={myDayPageSize}
                            onChange={(e) => { setMyDayPageSize(Number(e.target.value)); setMyDayCurrentPage(1); }}
                            style={{ height: 30, fontSize: '0.78rem', padding: '0 6px' }}
                          >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                          </select>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Hiển thị {((myDayCurrentPage - 1) * myDayPageSize) + 1} - {Math.min(myDayCurrentPage * myDayPageSize, myDayFilteredTasks.length)} / {myDayFilteredTasks.length}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={myDayCurrentPage === 1}
                            onClick={() => setMyDayCurrentPage(prev => Math.max(1, prev - 1))}
                          >
                            <Icon name="chevron-left" size={10} /> Trước
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={myDayCurrentPage === myDayTotalPages}
                            onClick={() => setMyDayCurrentPage(prev => Math.min(myDayTotalPages, prev + 1))}
                          >
                            Sau <Icon name="chevron-right" size={10} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB 4: LỊCH GOOGLE CALENDAR & SỰ KIỆN ── */}
              {workcenterTab === 'week' && (
                <GoogleCalendarView
                  tasks={visibleTasks}
                  users={SAMPLE_STAFF as any}
                  onOpenCreateTaskModal={() => setShowCreateModal(true)}
                  onOpenTaskDetailModal={(taskId) => setSelectedTaskId(taskId)}
                  addToast={addToast}
                />
              )}

              {/* ── TAB 5: VĂN BẢN ĐI (SỔ CÔNG VĂN ĐI) ── */}
              {workcenterTab === 'outgoing' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Banner Info */}
                  <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon name="paper-plane" size={20} style={{ color: '#2563eb' }} />
                      <div>
                        <strong>Sổ Công Văn Đi — UBND Xã Cát Ngạn:</strong> Quản lý quy trình soạn thảo, trình ký, ký duyệt ban hành và lưu trữ văn bản hành chính gửi đi.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        setEditingOutgoingDoc(null);
                        setFormDocType('CongVan');
                        setFormDocTitle('');
                        setFormDocContent('');
                        setFormDocRecipient('');
                        setFormDocIsUrgent(false);
                        setFormDocRelatedTaskId('');
                        setFormDocIsCorrection(false);
                        setFormDocOriginalId('');
                        setFormDestinationLevel('Superior');
                        setFormAutoCreateTask(true);
                        setFormSecurityLevel('Normal');
                        setFormUrgencyLevel('Normal');
                        setFormResponseDeadline('');
                        setFormDocumentSymbol('UBND-VP');
                        setShowCreateOutgoingModal(true);
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontWeight: 600 }}
                    >
                      <Icon name="plus" size={14} /> Soạn Văn Bản Đi Mới
                    </button>
                  </div>

                  {/* Toolbar Filter */}
                  <div style={{ background: '#ffffff', padding: '14px 18px', borderRadius: 10, border: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: '1 1 240px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Icon name="search" size={14} style={{ position: 'absolute', left: 12, color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Tìm kiếm theo số hiệu, trích yếu, nơi nhận..."
                        value={outgoingSearch}
                        onChange={(e) => setOutgoingSearch(e.target.value)}
                        style={{ paddingLeft: 34, paddingRight: outgoingSearch ? 30 : 12, height: 38, fontSize: '0.88rem' }}
                      />
                      {outgoingSearch && (
                        <button type="button" onClick={() => setOutgoingSearch('')} style={{ position: 'absolute', right: 10, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                          <Icon name="xmark" size={14} />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Loại văn bản:</label>
                      <select className="form-select" value={outgoingTypeFilter} onChange={(e) => setOutgoingTypeFilter(e.target.value)} style={{ height: 38, fontSize: '0.85rem', minWidth: 150 }}>
                        <option value="ALL">Tất cả loại VB</option>
                        <option value="QuyetDinh">Quyết định (QĐ)</option>
                        <option value="CongVan">Công văn (CV)</option>
                        <option value="ThongBao">Thông báo (TB)</option>
                        <option value="BaoCao">Báo cáo (BC)</option>
                        <option value="KeHoach">Kế hoạch (KH)</option>
                        <option value="ToTrinh">Tờ trình (TTr)</option>
                        <option value="CongDien">Công điện (CĐ)</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Trạng thái:</label>
                      <select className="form-select" value={outgoingStatusFilter} onChange={(e) => setOutgoingStatusFilter(e.target.value)} style={{ height: 38, fontSize: '0.85rem', minWidth: 160 }}>
                        <option value="ALL">Tất cả trạng thái</option>
                        <option value="Draft">Bản nháp (Đang soạn)</option>
                        <option value="PendingSignature">Chờ ký duyệt</option>
                        <option value="Issued">Đã ban hành</option>
                        <option value="Rejected">Bị từ chối ký</option>
                      </select>
                    </div>

                    {(outgoingSearch || outgoingStatusFilter !== 'ALL' || outgoingTypeFilter !== 'ALL') && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOutgoingSearch(''); setOutgoingStatusFilter('ALL'); setOutgoingTypeFilter('ALL'); }} style={{ color: '#64748b' }}>
                        <Icon name="rotate-left" size={12} /> Đặt lại
                      </button>
                    )}
                  </div>

                  {/* Table of Outgoing Documents */}
                  <div className="card" style={{ overflow: 'hidden' }}>
                    <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
                      <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: '0.82rem', color: '#475569' }}>
                            <th style={{ padding: '12px 16px', width: 140 }}>SỐ HIỆU / MÃ</th>
                            <th style={{ padding: '12px 16px' }}>TRÍCH YẾU NỘI DUNG</th>
                            <th style={{ padding: '12px 16px', width: 130 }}>LOẠI VĂN BẢN</th>
                            <th style={{ padding: '12px 16px', width: 160 }}>NGƯỜI SOẠN</th>
                            <th style={{ padding: '12px 16px', width: 160 }}>NƠI NHẬN</th>
                            <th style={{ padding: '12px 16px', width: 140 }}>TRẠNG THÁI</th>
                            <th style={{ padding: '12px 16px', width: 140, textAlign: 'center' }}>THAO TÁC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {outgoingDocsList.length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                                <Icon name="folder-open" size={36} style={{ marginBottom: 12, opacity: 0.5 }} />
                                <p style={{ margin: 0, fontSize: '0.9rem' }}>{outgoingLoading ? 'Đang tải danh sách văn bản đi...' : 'Không tìm thấy văn bản đi nào phù hợp.'}</p>
                              </td>
                            </tr>
                          ) : (
                            outgoingDocsList.map(doc => {
                              const getStatusBadge = (status: OutgoingDocumentStatusEnum) => {
                                switch (status) {
                                  case 'Draft': return <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>Bản nháp</span>;
                                  case 'PendingSignature': return <span className="badge" style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fef3c7' }}><Icon name="clock" size={10} /> Chờ ký duyệt</span>;
                                  case 'Issued': return <span className="badge" style={{ background: '#ecfdf5', color: '#16a34a', border: '1px solid #a7f3d0' }}><Icon name="check-double" size={10} /> Đã ban hành</span>;
                                  case 'Rejected': return <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}><Icon name="xmark" size={10} /> Từ chối ký</span>;
                                  default: return <span className="badge">{status}</span>;
                                }
                              };

                              return (
                                <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.88rem' }}>
                                  <td style={{ padding: '12px 16px', fontWeight: 700, color: doc.documentNumber ? '#1e293b' : '#94a3b8' }}>
                                    {doc.documentNumber || '— (Chờ cấp)'}
                                  </td>
                                  <td style={{ padding: '12px 16px' }}>
                                    <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>
                                      {doc.title}
                                      {doc.isUrgent && <span className="badge badge-urgent" style={{ marginLeft: 6, fontSize: '0.65rem', padding: '1px 5px' }}>KHẨN</span>}
                                      {doc.isCorrectionDocument && <span className="badge" style={{ marginLeft: 6, fontSize: '0.65rem', padding: '1px 5px', background: '#fef3c7', color: '#92400e' }}>ĐÍNH CHÍNH</span>}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                      Nội dung: {doc.content ? (doc.content.length > 70 ? doc.content.substring(0, 70) + '...' : doc.content) : 'Chưa có chi tiết'}
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 16px' }}>
                                    <span className="badge" style={{ background: '#f0f9ff', color: '#0284c7', fontWeight: 600 }}>
                                      {doc.documentTypeName}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 16px' }}>
                                    <div style={{ fontWeight: 600 }}>{doc.draftedByUserName}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{doc.draftedAt ? new Date(doc.draftedAt).toLocaleDateString('vi-VN') : ''}</div>
                                  </td>
                                  <td style={{ padding: '12px 16px', color: '#475569', fontSize: '0.82rem' }}>
                                    {doc.recipientNote || 'Toàn bộ phòng ban'}
                                  </td>
                                  <td style={{ padding: '12px 16px' }}>
                                    {getStatusBadge(doc.status)}
                                  </td>
                                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-xs"
                                        onClick={() => {
                                          setSelectedOutgoingDoc(doc);
                                          setShowRejectInput(false);
                                          setRejectionReasonInput('');
                                          setShowDetailOutgoingModal(true);
                                        }}
                                        title="Xem chi tiết & phê duyệt"
                                      >
                                        <Icon name="eye" size={11} /> Chi tiết
                                      </button>
                                      {doc.status === 'Draft' && (
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-xs"
                                          onClick={() => {
                                            setEditingOutgoingDoc(doc);
                                            setFormDocType(doc.documentType);
                                            setFormDocTitle(doc.title);
                                            setFormDocContent(doc.content);
                                            setFormDocRecipient(doc.recipientNote || '');
                                            setFormDocIsUrgent(doc.isUrgent);
                                            setFormDocRelatedTaskId(doc.relatedTaskItemId || '');
                                            setFormDocIsCorrection(doc.isCorrectionDocument);
                                            setFormDocOriginalId(doc.originalDocumentId || '');
                                            setFormDestinationLevel(doc.destinationLevel as any || 'Superior');
                                            setFormAutoCreateTask(doc.autoCreateTask ?? true);
                                            setFormSecurityLevel(doc.securityLevel || 'Normal');
                                            setFormUrgencyLevel(doc.urgencyLevel || 'Normal');
                                            setFormResponseDeadline(doc.responseDeadline ? doc.responseDeadline.split('T')[0] : '');
                                            setFormDocumentSymbol(doc.documentSymbol || 'UBND-VP');
                                            setShowCreateOutgoingModal(true);
                                          }}
                                          title="Sửa bản nháp"
                                        >
                                          <Icon name="pen-to-square" size={11} /> Sửa
                                        </button>
                                      )}
                                      {doc.status === 'Draft' ? (
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-xs"
                                          style={{ color: '#dc2626' }}
                                          onClick={async () => {
                                            if (confirm(`Bạn có chắc chắn muốn xóa bản nháp: "${doc.title}"?`)) {
                                              const res = await cancelOutgoingDocumentApi(doc.id, 'Xóa bản nháp');
                                              if (res.success) {
                                                addToast('Đã xóa', 'Bản nháp đã được xóa thành công.', 'success');
                                                fetchOutgoingDocs();
                                              } else {
                                                addToast('Lỗi', res.error || 'Không thể xóa bản nháp.', 'danger');
                                              }
                                            }
                                          }}
                                          title="Xóa bản nháp"
                                        >
                                          <Icon name="trash" size={11} /> Xóa
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-xs"
                                          style={{ color: '#dc2626' }}
                                          onClick={() => {
                                            setRevokeDocItem({
                                              id: doc.id,
                                              subject: doc.title,
                                              title: doc.title,
                                              documentNumber: doc.documentNumber || '---',
                                              documentSymbol: doc.documentSymbol || 'UBND-VP'
                                            });
                                            setShowRevokeModal(true);
                                          }}
                                          title="Gỡ / Thu hồi văn bản"
                                        >
                                          <Icon name="trash-can-arrow-up" size={11} /> Gỡ/Thu hồi
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Load More Button */}
                  {outgoingHasMore && (
                    <div style={{ textAlign: 'center', marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={outgoingLoading}
                        onClick={() => setOutgoingPage(prev => prev + 1)}
                        style={{ width: '100%', maxWidth: 360, margin: '0 auto', justifyContent: 'center', padding: '10px 20px', fontWeight: 600 }}
                      >
                        {outgoingLoading ? (
                          <>
                            <Icon name="spinner" className="fa-spin" size={14} /> Đang tải...
                          </>
                        ) : (
                          <>
                            <Icon name="angles-down" size={14} /> Xem thêm văn bản đi (Còn {outgoingTotalCount - outgoingDocsList.length} VB)
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* ═════════════════════════════════════════
             MODULE: NHẬT KÝ HOẠT ĐỘNG & SỔ KIỂM TOÁN
             ═════════════════════════════════════════ */}
          {/* {activeModule === 'activity-log' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="dept-sub-tabs" role="tablist">
                <button
                  type="button"
                  className={`dept-sub-tab ${actSubTab === 'timeline' ? 'active' : ''}`}
                  onClick={() => setActSubTab('timeline')}
                >
                  <Icon name="newspaper" size={14} /> Nhật Ký Hoạt Động (Timeline Feed)
                </button>
                <button
                  type="button"
                  className={`dept-sub-tab ${actSubTab === 'audit' ? 'active' : ''}`}
                  onClick={() => setActSubTab('audit')}
                >
                  <Icon name="shield-halved" size={14} /> Sổ Kiểm Toán (Append-Only Audit Log)
                </button>
              </div>

              {actSubTab === 'timeline' && (
                <div className="card">
                  <div className="card-header">
                    <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                      <Icon name="clock-rotate-left" size={16} style={{ color: '#2563eb', marginRight: 8 }} />
                      Nhật Ký Điều Hành & Hoạt Động Công Vụ Toàn Xã
                    </h2>
                  </div>
                  <div className="card-body">
                    {activityLogs.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                        Đang tải dữ liệu nhật ký điều hành...
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {activityLogs.map(item => (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, borderLeft: '4px solid #2563eb' }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>
                              {item.userFullName.split(' ').pop()?.[0] || 'NV'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
                                {item.summary}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 3 }}>
                                <Icon name="clock" size={11} /> {new Date(item.createdAt).toLocaleString('vi-VN')} — Loại: <span className="spec-chip" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>{item.actionType}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {actSubTab === 'audit' && (
                <div className="card">
                  <div className="card-header">
                    <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                      <Icon name="file-shield" size={16} style={{ color: '#dc2626', marginRight: 8 }} />
                      Sổ Theo Dõi & Kiểm Toán Công Vụ (Lưu Trữ Bất Biến & Bảo Mật)
                    </h2>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Thời gian</th>
                            <th>Tài khoản</th>
                            <th>Vai trò</th>
                            <th>Hành động</th>
                            <th>Đối tượng</th>
                            <th>Chi tiết tác động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                                Chưa có dữ liệu sổ kiểm toán.
                              </td>
                            </tr>
                          ) : (
                            auditLogs.map(log => (
                              <tr key={log.id}>
                                <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                  {new Date(log.createdAt).toLocaleString('vi-VN')}
                                </td>
                                <td><strong>{log.username}</strong></td>
                                <td><span className="badge badge-low">{log.actingRole}</span></td>
                                <td><span className="badge badge-high">{log.action}</span></td>
                                <td>{log.entityName} [{log.entityId.substring(0, 8)}]</td>
                                <td style={{ fontSize: '0.8rem' }}>{log.details}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )} */}

          {/* ═════════════════════════════════════════
             MODULE 2: LỊCH CÔNG TÁC TUẦN (CHIA SÁNG - CHIỀU - TỐI)
             ═════════════════════════════════════════ */}




          {/* ═════════════════════════════════════════
             MODULE: NHÂN SỰ & PHÒNG BAN (UNIFIED — 3 SUB-TABS)
             ═════════════════════════════════════════ */}
          {activeModule === 'departments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Sub-Tab Navigation */}
              <div className="dept-sub-tabs" role="tablist" aria-label="Chuyển đổi hiển thị nhân sự">
                <button
                  type="button"
                  role="tab"
                  aria-selected={deptSubTab === 'phongban'}
                  className={`dept-sub-tab ${deptSubTab === 'phongban' ? 'active' : ''}`}
                  onClick={() => setDeptSubTab('phongban')}
                >
                  <Icon name="sitemap" size={14} /> Phòng Ban
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={deptSubTab === 'canbo'}
                  className={`dept-sub-tab ${deptSubTab === 'canbo' ? 'active' : ''}`}
                  onClick={() => setDeptSubTab('canbo')}
                >
                  <Icon name="id-card" size={14} /> Hồ Sơ Cán Bộ
                </button>
                {/* ⚠️ CHỈ LÃNH ĐẠO / TRƯỞNG PHÒNG / PHÓ PHÒNG MỚI ĐƯỢC XEM & ĐIỀU CHUYỂN TẢI CÔNG VIỆC (scopeLevel < 4.0) */}
                {canCreateTask(activeRole) && (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={deptSubTab === 'taiviec'}
                    className={`dept-sub-tab ${deptSubTab === 'taiviec' ? 'active' : ''}`}
                    onClick={() => setDeptSubTab('taiviec')}
                  >
                    <Icon name="chart-bar" size={14} /> Tải Công Việc & Điều Chuyển
                    {overloadedCountBadge > 0 && (
                      <span className="tab-badge-count">{overloadedCountBadge}</span>
                    )}
                  </button>
                )}
              </div>

              {/* Department Filter Bar */}
              <div className="dept-filter-bar" aria-label="Bộ lọc phòng ban">
                <button
                  type="button"
                  className={`dept-filter-tab ${selectedDeptFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setSelectedDeptFilter('ALL')}
                >
                  <Icon name="building-columns" size={13} /> Tất cả ({activeStaffList.length})
                </button>
                {(Object.keys(DEPARTMENTS) as DepartmentCode[]).map(deptKey => {
                  const dept = DEPARTMENTS[deptKey];
                  const count = activeStaffList.filter(s => s.departmentCode === deptKey).length;
                  return (
                    <button
                      key={deptKey}
                      type="button"
                      className={`dept-filter-tab ${selectedDeptFilter === deptKey ? 'active' : ''}`}
                      onClick={() => setSelectedDeptFilter(deptKey)}
                    >
                      <Icon name={dept.icon} size={13} style={{ color: dept.color }} /> {dept.shortName} ({count})
                    </button>
                  );
                })}
              </div>

              {/* ── SUB-TAB 1: PHÒNG BAN ── */}
              {deptSubTab === 'phongban' && (
                <div className="dept-grid">
                  {(Object.keys(DEPARTMENTS) as DepartmentCode[])
                    .filter(k => selectedDeptFilter === 'ALL' || selectedDeptFilter === k)
                    .map(deptKey => {
                      const dept = DEPARTMENTS[deptKey];
                      const deptStaff = activeStaffList.filter(s => s.departmentCode === deptKey);
                      const totalHours = deptStaff.reduce((sum, s) => sum + s.assignedHours, 0);
                      const maxHours = deptStaff.reduce((sum, s) => sum + s.maxHours, 0) || 40;
                      const loadRate = Math.round((totalHours / maxHours) * 100);
                      const isOver = loadRate > 100;
                      const overloadCount = deptStaff.filter(s => s.assignedHours > s.maxHours).length;

                      return (
                        <div
                          key={deptKey}
                          className="dept-card"
                          style={{ borderColor: selectedDeptFilter === deptKey ? dept.color : undefined, cursor: 'pointer' }}
                          onClick={() => { setSelectedDeptFilter(deptKey); setDeptSubTab('canbo'); }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Xem cán bộ ${dept.name}`}
                        >
                          <div className="dept-card-header">
                            <div className="dept-card-icon" style={{ background: dept.badgeBg, color: dept.color }}>
                              <Icon name={dept.icon} size={20} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="dept-card-title">{dept.name}</div>
                              <div className="dept-card-head">
                                <Icon name="user-tie" size={11} style={{ color: 'var(--text-muted)' }} /> {dept.headTitle}: <strong>{dept.headName}</strong>
                              </div>
                            </div>
                          </div>

                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: '8px 0' }}>{dept.description}</p>

                          <div className="dept-metrics">
                            <div className="dept-metric-item">
                              <span className="dept-metric-val">{deptStaff.length}</span>
                              <span className="dept-metric-lbl">Biên chế</span>
                            </div>
                            <div className="dept-metric-item">
                              <span className="dept-metric-val" style={{ color: isOver ? '#dc2626' : '#16a34a' }}>{loadRate}%</span>
                              <span className="dept-metric-lbl">Tải việc</span>
                            </div>
                            <div className="dept-metric-item">
                              <span className="dept-metric-val" style={{ color: overloadCount > 0 ? '#dc2626' : 'var(--text-primary)' }}>{overloadCount}</span>
                              <span className="dept-metric-lbl">Quá tải</span>
                            </div>
                          </div>

                          <div className="progress-bar" style={{ height: 5 }}>
                            <div className="progress-bar-fill" style={{ width: `${Math.min(loadRate, 100)}%`, background: isOver ? '#dc2626' : loadRate > 80 ? '#d97706' : '#16a34a' }} />
                          </div>

                          <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
                            <Icon name="arrow-right" size={11} /> Xem danh sách cán bộ
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* ── UNIFIED SEARCH & FILTER TOOLBAR FOR CANBO AND TAIVIEC ── */}
              {(deptSubTab === 'canbo' || deptSubTab === 'taiviec') && (
                <div style={{
                  background: '#ffffff',
                  padding: '14px 18px',
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 6
                }}>
                  {/* Quick Search Input */}
                  <div style={{ flex: '1 1 240px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Icon name="search" size={14} style={{ position: 'absolute', left: 12, color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Tìm kiếm nhanh tên, email, tài khoản cán bộ..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      style={{ paddingLeft: 34, paddingRight: userSearchQuery ? 30 : 12, height: 38, fontSize: '0.88rem' }}
                    />
                    {userSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setUserSearchQuery('')}
                        style={{ position: 'absolute', right: 10, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                        title="Xóa tìm kiếm"
                      >
                        <Icon name="xmark" size={14} />
                      </button>
                    )}
                  </div>

                  {/* Department Filter Dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Phòng ban:</label>
                    <select
                      className="form-select"
                      value={selectedDeptFilter}
                      onChange={(e) => setSelectedDeptFilter(e.target.value as DepartmentCode | 'ALL')}
                      style={{ height: 38, fontSize: '0.85rem', minWidth: 160 }}
                    >
                      <option value="ALL">Tất cả phòng ban</option>
                      {(Object.keys(DEPARTMENTS) as DepartmentCode[]).map(key => (
                        <option key={key} value={key}>{DEPARTMENTS[key].shortName}</option>
                      ))}
                    </select>
                  </div>

                  {/* Role Filter Dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Chức danh:</label>
                    <select
                      className="form-select"
                      value={roleCodeFilter}
                      onChange={(e) => setRoleCodeFilter(e.target.value)}
                      style={{ height: 38, fontSize: '0.85rem', minWidth: 160 }}
                    >
                      <option value="ALL">Tất cả chức danh</option>
                      <option value="ChuTichUBND">Chủ tịch UBND xã</option>
                      <option value="PhoChuTichUBND">Phó Chủ tịch UBND xã</option>
                      <option value="TruongPhong">Trưởng phòng / Ban</option>
                      <option value="PhoPhong">Phó Trưởng phòng</option>
                      <option value="ChuyenVien">Chuyên viên</option>
                    </select>
                  </div>

                  {/* Workload Status Filter Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Tải việc:</label>
                    <button
                      type="button"
                      className={`btn btn-sm ${workloadFilter === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setWorkloadFilter('ALL')}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${workloadFilter === 'Normal' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setWorkloadFilter('Normal')}
                    >
                      Bình thường (&lt;80%)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${workloadFilter === 'NearOverload' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setWorkloadFilter('NearOverload')}
                    >
                      Gần quá tải (≥80%)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${workloadFilter === 'Overloaded' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setWorkloadFilter('Overloaded')}
                      style={{ borderColor: workloadFilter === 'Overloaded' ? '#dc2626' : undefined, background: workloadFilter === 'Overloaded' ? '#dc2626' : undefined, color: workloadFilter === 'Overloaded' ? '#fff' : undefined }}
                    >
                      Quá tải (&gt;100%)
                    </button>
                  </div>

                  {/* Reset Filters button */}
                  {(userSearchQuery || selectedDeptFilter !== 'ALL' || roleCodeFilter !== 'ALL' || workloadFilter !== 'ALL') && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setUserSearchQuery('');
                        setSelectedDeptFilter('ALL');
                        setRoleCodeFilter('ALL');
                        setWorkloadFilter('ALL');
                      }}
                      style={{ color: '#64748b' }}
                    >
                      <Icon name="rotate-left" size={12} /> Đặt lại
                    </button>
                  )}
                </div>
              )}

              {/* ── SUB-TAB 2: HỒ SƠ CÁN BỘ (Profile Cards) ── */}
              {deptSubTab === 'canbo' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="staff-card-grid">
                    {(paginatedUsersList.length > 0 ? paginatedUsersList.map(u => {
                      const staffSample = activeStaffList.find(s => s.name === u.fullName);
                      const activeTasksCount = tasks.filter(t => t.assignee === u.fullName && t.status !== 'Hoan_Thanh' && t.status !== 'Tu_Choi').length;
                      return {
                        id: u.id,
                        name: u.fullName,
                        initials: u.fullName.split(' ').pop()?.[0] || 'CB',
                        role: u.roleName || u.activeRoleCode || 'Cán bộ xã',
                        departmentCode: (staffSample?.departmentCode || 'VAN_PHONG') as DepartmentCode,
                        specialization: staffSample?.specialization || 'Công tác chuyên môn',
                        rankLabel: staffSample?.rankLabel || 'Cán bộ công chức',
                        phone: u.zaloPhoneNumber || staffSample?.phone || '0987.654.321',
                        email: u.email,
                        assignedHours: u.assignedHours,
                        maxHours: u.maxHours || 40,
                        utilizationRate: u.utilizationRate,
                        isOverloaded: u.isOverloaded,
                        tasksCount: activeTasksCount || staffSample?.tasksCount || 0,
                        completedOnTime: staffSample?.completedOnTime || 12,
                        totalCompleted: staffSample?.totalCompleted || 12,
                        score: staffSample?.score || 9.2,
                        avatarBg: staffSample?.avatarBg || '#eff6ff',
                      };
                    }) : activeStaffList.filter(s => selectedDeptFilter === 'ALL' || s.departmentCode === selectedDeptFilter).map(s => ({
                      ...s,
                      utilizationRate: Math.round((s.assignedHours / s.maxHours) * 100),
                      isOverloaded: s.assignedHours > s.maxHours,
                    })))
                      .map(staff => {
                        const rate = staff.utilizationRate || Math.round((staff.assignedHours / staff.maxHours) * 100);
                        const isOver = staff.isOverloaded || rate > 100;
                        const dept = DEPARTMENTS[staff.departmentCode] || DEPARTMENTS['VAN_PHONG'];
                        const grad = getGradLabel(staff.score);
                        const onTimeRate = staff.totalCompleted > 0 ? Math.round((staff.completedOnTime / staff.totalCompleted) * 100) : 0;

                        return (
                          <div key={staff.id} className={`staff-profile-card ${isOver ? 'staff-overloaded' : ''}`}>
                            {/* Card Header */}
                            <div className="staff-card-top">
                              <div className="staff-avatar" style={{ background: staff.avatarBg, color: dept.color }}>
                                {staff.initials}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="staff-card-name">{staff.name}</div>
                                <div className="staff-card-role">{staff.role}</div>
                                <span className="rank-badge">{staff.rankLabel}</span>
                              </div>
                            </div>

                            {/* Department & Specialization */}
                            <div className="staff-card-info-row">
                              <span className="badge" style={{ background: dept.badgeBg, color: dept.color, fontWeight: 700, fontSize: '0.72rem' }}>
                                <Icon name={dept.icon} size={10} /> {dept.shortName}
                              </span>
                            </div>
                            <div className="staff-card-info-row">
                              <span className="spec-chip">
                                <Icon name="briefcase" size={11} /> {staff.specialization}
                              </span>
                            </div>

                            {/* Contact Info */}
                            <div className="staff-card-contact">
                              <div><Icon name="phone" size={11} style={{ color: 'var(--text-muted)' }} /> {staff.phone}</div>
                              <div><Icon name="envelope" size={11} style={{ color: 'var(--text-muted)' }} /> {staff.email}</div>
                            </div>

                            {/* Metrics Row */}
                            <div className="staff-card-metrics">
                              <div className="staff-metric">
                                <span className="staff-metric-val" style={{ color: isOver ? '#dc2626' : '#16a34a' }}>
                                  {staff.assignedHours}h/{staff.maxHours}h
                                </span>
                                <span className="staff-metric-lbl">Tải tuần</span>
                                <div className="progress-bar" style={{ height: 4, marginTop: 3 }}>
                                  <div className="progress-bar-fill" style={{ width: `${Math.min(rate, 100)}%`, background: isOver ? '#dc2626' : rate > 80 ? '#d97706' : '#16a34a' }} />
                                </div>
                              </div>
                              <div className="staff-metric">
                                <span className="staff-metric-val">{staff.tasksCount}</span>
                                <span className="staff-metric-lbl">Việc đang làm</span>
                              </div>
                              <div className="staff-metric">
                                <span className="staff-metric-val">{onTimeRate}%</span>
                                <span className="staff-metric-lbl">Đúng hạn</span>
                              </div>
                            </div>

                            {/* Score & Grade */}
                            <div className="staff-card-footer">
                              <div>
                                <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>{staff.score}/10</span>
                                <span className={`badge ${grad.badge}`} style={{ marginLeft: 6, fontSize: '0.68rem' }}>{grad.label}</span>
                              </div>
                              {canAssignToByName(activeRole, staff.name) && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={(e) => { e.stopPropagation(); setActiveModule('create-task'); setNewAssignee(staff.name); }}
                                  title={`Giao việc cho ${staff.name}`}
                                >
                                  <Icon name="paper-plane" size={11} /> Giao việc
                                </button>
                              )}
                            </div>

                            {isOver && (
                              <div className="staff-overload-badge">
                                <Icon name="triangle-exclamation" size={11} /> Quá tải +{staff.assignedHours - staff.maxHours}h
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* Load More Button for Profile Cards */}
                  {userHasMore && (
                    <div style={{ textAlign: 'center', marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={userLoading}
                        onClick={() => setUserPage(prev => prev + 1)}
                        style={{ width: '100%', maxWidth: 360, margin: '0 auto', justifyContent: 'center', padding: '10px 20px', fontWeight: 600 }}
                      >
                        {userLoading ? (
                          <>
                            <Icon name="spinner" className="fa-spin" size={14} /> Đang tải...
                          </>
                        ) : (
                          <>
                            <Icon name="angles-down" size={14} /> Xem thêm cán bộ (Còn {userTotalCount - paginatedUsersList.length} người)
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── SUB-TAB 3: TẢI CÔNG VIỆC (CHỈ DÀNH CHO LÃNH ĐẠO / TRƯỞNG PHÒNG) ── */}
              {deptSubTab === 'taiviec' && (
                !canCreateTask(activeRole) ? (
                  <div className="alert alert-danger" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Icon name="shield-halved" size={24} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <div>
                      <strong style={{ fontSize: '0.95rem' }}>KHÔNG CÓ QUYỀN TRUY CẬP TẢI CÔNG VIỆC</strong>
                      <p style={{ fontSize: '0.85rem', marginTop: 4, color: '#7f1d1d' }}>
                        Chức năng Giám sát Tải công việc & Điều chuyển nhiệm vụ chỉ dành cho Lãnh đạo UBND xã và Trưởng các phòng ban.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="alert alert-info">
                      <Icon name="circle-info" size={16} style={{ flexShrink: 0 }} />
                      <span>Biểu đồ tải công việc giúp Lãnh đạo giao đúng người, tránh quá tải. Mỗi cán bộ có định mức 40 giờ/tuần.</span>
                    </div>

                    {(paginatedUsersList.length > 0 ? paginatedUsersList.map(u => {
                      const staffSample = activeStaffList.find(s => s.name === u.fullName);
                      const activeTasks = tasks.filter(t => t.assignee === u.fullName && t.status !== 'Hoan_Thanh' && t.status !== 'Tu_Choi');
                      return {
                        id: u.id,
                        name: u.fullName,
                        role: u.roleName || u.activeRoleCode || 'Cán bộ',
                        departmentName: u.departmentName || 'Văn phòng HĐND & UBND',
                        departmentCode: (staffSample?.departmentCode || 'VAN_PHONG') as DepartmentCode,
                        initials: u.fullName.split(' ').pop()?.[0] || 'NV',
                        specialization: staffSample?.specialization || 'Công tác chuyên môn',
                        assignedHours: u.assignedHours,
                        maxHours: u.maxHours || 40,
                        utilizationRate: u.utilizationRate,
                        isOverloaded: u.isOverloaded,
                        tasksCount: activeTasks.length || staffSample?.tasksCount || 0,
                        avatarBg: staffSample?.avatarBg || '#eff6ff',
                      };
                    }) : activeStaffList.filter(s => selectedDeptFilter === 'ALL' || s.departmentCode === selectedDeptFilter).map(s => ({
                      ...s,
                      utilizationRate: Math.round((s.assignedHours / s.maxHours) * 100),
                      isOverloaded: s.assignedHours > s.maxHours,
                    })))
                      .map(staff => {
                        const rate = staff.utilizationRate || Math.round((staff.assignedHours / staff.maxHours) * 100);
                        const isOver = staff.isOverloaded || rate > 100;
                        const dept = DEPARTMENTS[staff.departmentCode] || DEPARTMENTS['VAN_PHONG'];
                        return (
                          <div key={staff.id} className={`workload-item ${isOver ? 'overloaded' : ''}`}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: isOver ? '#fef2f2' : staff.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.82rem', color: isOver ? '#dc2626' : dept.color }}>{staff.initials}</div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{staff.name}</div>
                                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                                    <span>{staff.role} — <strong>{staff.departmentName}</strong></span>
                                    <span className="spec-chip" style={{ fontSize: '0.68rem', padding: '1px 7px' }}>
                                      <Icon name="briefcase" size={10} /> {staff.specialization}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: isOver ? '#dc2626' : '#16a34a' }}>
                                  {staff.assignedHours}h / {staff.maxHours}h ({rate}%)
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{staff.tasksCount} công việc đang xử lý</div>
                              </div>
                            </div>

                            <div className="progress-bar" style={{ height: 8 }}>
                              <div className="progress-bar-fill" style={{ width: `${Math.min(rate, 100)}%`, background: isOver ? '#dc2626' : rate > 80 ? '#d97706' : '#16a34a' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                              {isOver ? (
                                <div className="alert alert-danger" style={{ flex: 1, margin: 0, padding: '6px 12px', fontSize: '0.8rem' }}>
                                  <Icon name="triangle-exclamation" size={14} style={{ flexShrink: 0 }} />
                                  <strong>Quá tải +{staff.assignedHours - staff.maxHours}h!</strong> Cần điều chuyển bớt nhiệm vụ.
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Mức tải an toàn ({staff.assignedHours}h / {staff.maxHours}h)</div>
                              )}
                              <button
                                type="button"
                                className={`btn ${isOver ? 'btn-danger' : 'btn-outline'} btn-sm`}
                                style={{ marginLeft: 12 }}
                                onClick={() => {
                                  setTransferFromStaff(staff.name);
                                  const staffTasks = tasks.filter(t => t.assignee === staff.name && t.status !== 'Hoan_Thanh');
                                  if (staffTasks.length > 0) {
                                    setTransferTaskId(staffTasks[0].id);
                                  } else {
                                    setTransferTaskId(tasks[0]?.id || '');
                                  }
                                  setTransferToStaff('');
                                  setTransferToStaffId('');
                                  setShowTransferModal(true);
                                }}
                              >
                                <Icon name="right-left" size={14} /> Điều chuyển
                              </button>
                            </div>
                          </div>
                        );
                      })}

                    {/* Load More Button for Workload tab */}
                    {userHasMore && (
                      <div style={{ textAlign: 'center', marginTop: 12 }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={userLoading}
                          onClick={() => setUserPage(prev => prev + 1)}
                          style={{ width: '100%', maxWidth: 360, margin: '0 auto', justifyContent: 'center', padding: '10px 20px', fontWeight: 600 }}
                        >
                          {userLoading ? (
                            <>
                              <Icon name="spinner" className="fa-spin" size={14} /> Đang tải...
                            </>
                          ) : (
                            <>
                              <Icon name="angles-down" size={14} /> Xem thêm cán bộ (Còn {userTotalCount - paginatedUsersList.length} người)
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}

            </div>
          )}

          {/* ═════════════════════════════════════════
             MODULE: GIAO VIỆC MỚI
             ═════════════════════════════════════════ */}
          {activeModule === 'create-task' && (
            <div className="create-task-container">
              {createTaskSource && (
                <div className="alert alert-info" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Icon name="link" size={14} style={{ marginRight: 8 }} />
                    Đang tạo công việc từ văn bản: <strong>{createTaskSource.subject}</strong>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => setCreateTaskSource(null)}>
                    <Icon name="xmark" size={14} /> Gỡ liên kết
                  </button>
                </div>
              )}

              <div className="create-task-left">
                <div className="card" style={{ border: 'none', boxShadow: 'none' }}>
                  <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ fontSize: '1.2rem', margin: 0 }}><Icon name="circle-plus" size={18} style={{ color: 'var(--accent-blue)' }} /> Thông tin công việc</h2>
                      <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.75rem', padding: '3px 8px' }}>
                        <Icon name="wand-magic-sparkles" size={11} style={{ marginRight: 4 }} /> Hỗ trợ số hóa & Phân tích tự động
                      </span>
                    </div>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    {/* ── PROMPT F: KHU VỰC KÉO THẢ TỆP ĐỂ AI PHÂN TÍCH & ĐIỀN PHIẾU GIAO VIỆC ── */}
                    <div
                      style={{
                        background: isDragging ? '#eff6ff' : '#f8fafc',
                        border: `2px dashed ${isDragging ? '#2563eb' : '#94a3b8'}`,
                        borderRadius: 10,
                        padding: '16px 20px',
                        marginBottom: 20,
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={async (e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          const file = e.dataTransfer.files[0];
                          await handleAnalyzeUploadedDocument(file);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx"
                        onChange={async (e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            const file = e.target.files[0];
                            await handleAnalyzeUploadedDocument(file);
                          }
                        }}
                      />
                      {isAiAnalyzingFile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                          <Icon name="spinner" className="fa-spin" size={26} style={{ color: '#2563eb' }} />
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1e40af' }}>
                            Đang số hóa bóc tách tệp văn bản & phân tích chỉ đạo...
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Trợ lý số đang trích xuất trích yếu, tóm tắt chỉ đạo, hạn chót, phòng ban và danh mục sản phẩm nghiệm thu...
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="wand-magic-sparkles" size={16} style={{ color: '#2563eb' }} />
                            </div>
                            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1e293b' }}>
                              Kéo thả hoặc bấm để chọn tệp văn bản chỉ đạo (PDF, Word, Ảnh scan)
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Hệ thống sẽ tự động bóc tách nội dung, điền tiêu đề, trích yếu, hạn xử lý và lập danh mục đầu việc nghiệm thu (Prompt F)
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="task-title-input" className="form-label">Tiêu đề công việc <span className="required">*</span></label>
                      <input id="task-title-input" className="form-input" placeholder="VD: Rà soát tiến độ xây dựng nông thôn mới…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label htmlFor="task-desc-input" className="form-label">Mô tả chi tiết yêu cầu</label>
                      <textarea id="task-desc-input" className="form-textarea" rows={3} placeholder="Mô tả nội dung, yêu cầu cụ thể của công việc…" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                    </div>

                    <div className="form-group checklist-builder">
                      <label className="form-label">Danh mục kết quả / Sản phẩm đầu ra (Chiếm 40% tỷ trọng tiến độ)</label>
                      <div className="checklist-input-group">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Thêm đầu việc hoặc sản phẩm nghiệm thu..."
                          value={newChecklistText}
                          onChange={(e) => setNewChecklistText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newChecklistText.trim()) {
                              setChecklistItems([...checklistItems, { id: Date.now().toString(), text: newChecklistText.trim(), done: false }]);
                              setNewChecklistText('');
                            }
                          }}
                        />
                        <button className="btn btn-secondary" onClick={() => {
                          if (newChecklistText.trim()) {
                            setChecklistItems([...checklistItems, { id: Date.now().toString(), text: newChecklistText.trim(), done: false }]);
                            setNewChecklistText('');
                          }
                        }}>
                          <Icon name="plus" size={14} />
                        </button>
                      </div>
                      {checklistItems.length > 0 && (
                        <div className="checklist-items-list">
                          {checklistItems.map((item, idx) => (
                            <div key={item.id} className="checklist-item-row">
                              <div className="cl-idx">{idx + 1}.</div>
                              <div className="cl-text">{item.text}</div>
                              <button className="cl-del" onClick={() => setChecklistItems(checklistItems.filter(c => c.id !== item.id))}>
                                <Icon name="trash" size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
                      <div className="form-group">
                        <label htmlFor="task-duedate-input" className="form-label">Hạn chót <span className="required">*</span></label>
                        <input id="task-duedate-input" className="form-input" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label htmlFor="task-shift-select" className="form-label">Ca làm việc</label>
                        <select id="task-shift-select" className="form-select" value={newShift} onChange={(e) => setNewShift(e.target.value as ShiftType)}>
                          <option value="Sang">Buổi Sáng (07:00 - 11:30)</option>
                          <option value="Chieu">Buổi Chiều (13:00 - 17:00)</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="form-group">
                        <label htmlFor="task-priority-select" className="form-label">Độ ưu tiên</label>
                        <select id="task-priority-select" className="form-select" value={newPriority} onChange={(e) => setNewPriority(e.target.value as TaskPriority)}>
                          <option value="Khan">🔴 KHẨN CẤP</option>
                          <option value="Cao">🟠 ƯU TIÊN CAO</option>
                          <option value="Trung_Binh">🟡 TRUNG BÌNH</option>
                          <option value="Thuong">⚪ THƯỜNG</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="task-category-select" className="form-label">Loại việc</label>
                        <select id="task-category-select" className="form-select" value={newCategory} onChange={(e) => setNewCategory(e.target.value as TaskCategory)}>
                          <option value="BAU">Nhiệm vụ thường xuyên, định kỳ</option>
                          <option value="Dot_Xuat">Nhiệm vụ đột xuất, phát sinh</option>
                          <option value="Du_An">Đề án, Dự án trọng điểm</option>
                        </select>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              <div className="create-task-right">
                <div className="assignee-picker-header">
                  <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)' }}>Chọn người thực hiện <span className="required">*</span></h3>
                  <div className="search-box" style={{ marginTop: 12 }}>
                    <Icon name="search" size={12} />
                    <input type="text" placeholder="Tìm cán bộ..." style={{ padding: '6px 8px', fontSize: '0.85rem' }} />
                  </div>
                </div>

                <div className="assignee-picker-list">
                  {/* Chỉ hiển thị cán bộ mà vai trò hiện tại có quyền giao việc */}
                  {(() => {
                    const assignableStaff = getAssignableStaff(activeRole, activeStaffList);
                    const blockedStaff = activeStaffList.filter(s => !assignableStaff.includes(s));
                    const deptGroups = Array.from(new Set(activeStaffList.map(s => s.role.split(' - ')[0] || s.role)));
                    return deptGroups.map(dept => {
                      const deptStaff = activeStaffList.filter(s => s.role.startsWith(dept));
                      if (deptStaff.length === 0) return null;
                      return (
                        <div key={dept} className="assignee-dept-group">
                          <div className="dept-name">{dept}</div>
                          <div className="dept-staff-grid">
                            {deptStaff.map(staff => {
                              const isAssignable = assignableStaff.includes(staff);
                              const loadRate = Math.round((staff.assignedHours / staff.maxHours) * 100);
                              let loadColor = 'var(--accent-blue)';
                              if (loadRate > 80) loadColor = 'var(--status-danger)';
                              else if (loadRate > 60) loadColor = 'var(--status-warning)';
                              const isSelected = newAssignee === staff.name;
                              return (
                                <div
                                  key={staff.id}
                                  className={`staff-picker-card ${isSelected ? 'selected' : ''} ${loadRate > 80 ? 'overloaded' : ''} ${!isAssignable ? 'disabled' : ''}`}
                                  onClick={() => { if (isAssignable) setNewAssignee(staff.name); }}
                                  title={!isAssignable ? 'Không thể giao việc cho cấp trên hoặc ngang cấp' : `Chọn ${staff.name}`}
                                  style={!isAssignable ? { opacity: 0.45, cursor: 'not-allowed', filter: 'grayscale(0.5)' } : undefined}
                                >
                                  <div className="staff-avatar">
                                    <Icon name={isAssignable ? 'user-tie' : 'lock'} size={16} />
                                    {isSelected && <div className="check-badge"><Icon name="check" size={10} /></div>}
                                  </div>
                                  <div className="staff-info">
                                    <div className="staff-name">{staff.name}</div>
                                    <div className="staff-role">{staff.role.replace(dept + ' - ', '').trim()}</div>
                                    {isAssignable ? (
                                      <>
                                        <div className="staff-load-bar">
                                          <div className="fill" style={{ width: `${loadRate}%`, background: loadColor }}></div>
                                        </div>
                                        <div className="staff-load-text" style={{ color: loadColor }}>Tải: {loadRate}%</div>
                                      </>
                                    ) : (
                                      <div className="staff-load-text" style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
                                        <Icon name="ban" size={10} /> Cấp trên / Ngang cấp
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="create-task-actions">
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {newAssignee ? `Đã chọn: ${newAssignee}` : 'Chưa chọn cán bộ'}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      if (!newTitle || !newAssignee) {
                        addToast('Lỗi', 'Vui lòng nhập tiêu đề và chọn người thực hiện', 'danger');
                        return;
                      }

                      const createdTask: Task = {
                        id: `CV-2026-${106 + tasks.length}`,
                        title: newTitle,
                        description: newDesc,
                        assignedBy: ROLE_CONFIG[activeRole].label,
                        assignedByRole: ROLE_CONFIG[activeRole].label,
                        assignee: newAssignee,
                        assigneeRole: activeStaffList.find(s => s.name === newAssignee)?.role || 'Cán bộ xã',
                        collaborators: [],
                        priority: newPriority,
                        status: 'Chua_Lam',
                        category: newCategory,
                        dueDate: newDueDate || '2026-08-15',
                        shift: newShift,
                        startTime: newStartTime,
                        createdDate: new Date().toISOString().split('T')[0],
                        progress: 0,
                        effortHours: parseInt(newEffort) || 8,
                        attachments: attachedFiles.map(f => f.name),
                        comments: [],
                        statusHistory: [{
                          from: 'Khởi tạo',
                          to: 'Chờ thực hiện',
                          by: ROLE_CONFIG[activeRole].label,
                          at: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                          asRole: ROLE_CONFIG[activeRole].label,
                        }],
                        context: activeRole,
                        sourceInboxId: createTaskSource?.id,
                      };

                      setTasks(prev => [createdTask, ...prev]);

                      if (createTaskSource) {
                        setInboxItems(prev => prev.map(m => m.id === createTaskSource.id ? { ...m, folder: 'assigned', status: 'assigned' } : m));
                      }

                      addToast('Thành công', `Đã giao việc "${newTitle}" cho ${newAssignee}!`, 'success');
                      setActiveModule('workcenter');
                      setWorkcenterTab('today');
                      setSelectedTaskId(createdTask.id);
                      setCreateTaskSource(null);
                      setNewTitle('');
                      setNewDesc('');
                      setNewAssignee('');
                      setChecklistItems([]);
                    }}
                  >
                    <Icon name="paper-plane" size={14} /> Lưu & Giao Việc
                  </button>
                </div>
              </div>

            </div>
          )}

          {activeModule === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Sub-Tab Navigation */}
              <div className="dept-sub-tabs" role="tablist" aria-label="Chuyển đổi báo cáo & đánh giá">
                <button
                  type="button"
                  className={`dept-sub-tab ${reportSubTab === 'evaluation' ? 'active' : ''}`}
                  onClick={() => setReportSubTab('evaluation')}
                >
                  <Icon name="trophy" size={14} /> Bảng Đánh Giá Năng Lực
                </button>
                <button
                  type="button"
                  className={`dept-sub-tab ${reportSubTab === 'submit' ? 'active' : ''}`}
                  onClick={() => setReportSubTab('submit')}
                >
                  <Icon name="paper-plane" size={14} /> Nộp Báo Cáo Tiến Độ
                </button>
                <button
                  type="button"
                  className={`dept-sub-tab ${reportSubTab === 'review' ? 'active' : ''}`}
                  onClick={() => setReportSubTab('review')}
                >
                  <Icon name="clipboard-check" size={14} /> Duyệt Báo Cáo
                  {getPendingReports(progressReports, activeRole).length > 0 && (
                    <span className="tab-badge-count">{getPendingReports(progressReports, activeRole).length}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={`dept-sub-tab ${reportSubTab === 'history' ? 'active' : ''}`}
                  onClick={() => setReportSubTab('history')}
                >
                  <Icon name="clock-rotate-left" size={14} /> Lịch Sử Báo Cáo ({progressReports.length})
                </button>
              </div>

              {/* TAB 1: BẢNG ĐÁNH GIÁ THI ĐUA CÁN BỘ */}
              {reportSubTab === 'evaluation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '12px 16px', borderRadius: 8 }}>
                    <Icon name="award" size={18} style={{ flexShrink: 0, color: '#2563eb' }} />
                    <span style={{ fontSize: '0.84rem', lineHeight: 1.5 }}>
                      Đánh giá, xếp loại chất lượng cán bộ, công chức dựa trên kết quả thực hiện nhiệm vụ công vụ theo thang điểm 10: <strong>Điểm hệ thống tự động ghi nhận (tối đa 3.0 điểm: đúng hạn, hoàn thành nội dung công việc, không bị hoàn trả)</strong> kết hợp <strong>Điểm thẩm định chất lượng của Lãnh đạo có thẩm quyền (tối đa 7.0 điểm)</strong>.
                    </span>
                  </div>

                  <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', padding: '14px 20px' }}>
                      <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon name="award" size={18} style={{ color: '#dc2626' }} />
                        BẢNG TỔNG HỢP ĐÁNH GIÁ THI ĐUA CÁN BỘ, CÔNG CHỨC QUÝ III/2026
                      </h2>
                      <span className="badge badge-blue" style={{ fontWeight: 700, fontSize: '0.75rem' }}>
                        Thang điểm 10 (3.0đ Hệ thống + 7.0đ Lãnh đạo)
                      </span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th scope="col">Cán bộ, công chức</th>
                            <th scope="col">Chức vụ & Phòng ban</th>
                            <th scope="col">Nhiệm vụ hoàn thành / Tổng giao</th>
                            <th scope="col">Hệ thống ghi nhận (Tối đa 3.0đ)</th>
                            <th scope="col">Lãnh đạo thẩm định (Tối đa 7.0đ)</th>
                            <th scope="col">Tổng điểm (Thang 10)</th>
                            <th scope="col">Xếp loại thi đua</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(gradOfficers.length > 0 ? gradOfficers : SAMPLE_STAFF.map(s => {
                            const rawScore = s.score > 10.0 ? s.score / 10.0 : s.score;
                            const sysScore = Math.round(((s.completedOnTime / Math.max(1, s.totalCompleted)) * 1.5 + 1.0 + 0.4) * 10) / 10;
                            const leadScore = Math.round(Math.max(0, rawScore - sysScore) * 10) / 10;
                            return {
                              userId: s.id,
                              fullName: s.name,
                              roleName: s.role,
                              departmentName: s.departmentName,
                              totalTasksAssigned: s.totalCompleted,
                              completedTasksCount: s.completedOnTime,
                              overdueTasksCount: 0,
                              systemAutoScore30: Math.min(3.0, sysScore),
                              leaderEvaluationScore70: Math.min(7.0, leadScore),
                              finalScore100: Math.min(10.0, rawScore),
                              finalGRADScore: Math.min(10.0, rawScore),
                              tierGrade: rawScore >= 9.0 ? 'Hoàn thành xuất sắc nhiệm vụ'
                                : rawScore >= 7.5 ? 'Hoàn thành tốt nhiệm vụ'
                                  : rawScore >= 6.0 ? 'Hoàn thành nhiệm vụ'
                                    : 'Cần cải thiện'
                            };
                          })).map(officer => {
                            const rawSys = officer.systemAutoScore30 ?? ((officer as any).checklistProgressScore40 ? ((officer as any).checklistProgressScore40 / 4.0) * 3.0 : 2.7);
                            const sysScore = rawSys > 3.0 ? rawSys / 10.0 : rawSys;

                            const rawLead = officer.leaderEvaluationScore70 ?? ((officer as any).leaderQualityScore60 ? ((officer as any).leaderQualityScore60 / 6.0) * 7.0 : 6.3);
                            const leadScore = rawLead > 7.0 ? rawLead / 10.0 : rawLead;

                            const rawFinal = officer.finalScore100 ?? officer.finalGRADScore;
                            const finalScore = rawFinal > 10.0 ? rawFinal / 10.0 : rawFinal;

                            const isExc = finalScore >= 9.0;
                            const isGood = finalScore >= 7.5;
                            const isFair = finalScore >= 6.0;
                            const badgeClass = isExc ? 'badge-success' : isGood ? 'badge-blue' : isFair ? 'badge-warning' : 'badge-danger';

                            const tierLabel = isExc ? 'Hoàn thành xuất sắc nhiệm vụ'
                              : isGood ? 'Hoàn thành tốt nhiệm vụ'
                                : isFair ? 'Hoàn thành nhiệm vụ'
                                  : 'Không hoàn thành nhiệm vụ';

                            return (
                              <tr key={officer.userId}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', color: '#2563eb' }}>
                                      {officer.fullName.split(' ').pop()?.[0] || 'CB'}
                                    </div>
                                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{officer.fullName}</span>
                                  </div>
                                </td>
                                <td style={{ color: 'var(--text-secondary)' }}>
                                  <div style={{ fontWeight: 600, color: '#334155' }}>{officer.roleName}</div>
                                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>{officer.departmentName}</span>
                                </td>
                                <td style={{ fontWeight: 700 }}>{officer.completedTasksCount} / {officer.totalTasksAssigned} nhiệm vụ</td>
                                <td style={{ fontWeight: 700, color: '#2563eb' }}>
                                  {sysScore.toFixed(1)} / 3.0đ
                                </td>
                                <td style={{ fontWeight: 700, color: '#d97706' }}>
                                  {leadScore.toFixed(1)} / 7.0đ
                                </td>
                                <td style={{ fontWeight: 800, fontSize: '1rem', color: isExc ? '#16a34a' : isGood ? '#2563eb' : isFair ? '#d97706' : '#dc2626' }}>
                                  {finalScore.toFixed(1)} / 10đ
                                </td>
                                <td><span className={`badge ${badgeClass}`} style={{ fontWeight: 700, fontSize: '0.76rem', padding: '4px 10px' }}>{officer.tierGrade && officer.tierGrade.includes('Hoàn thành') ? officer.tierGrade : tierLabel}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: NỘP BÁO CÁO TIẾN ĐỘ */}
              {reportSubTab === 'submit' && (
                <div className="card">
                  <div className="card-header">
                    <h2><Icon name="paper-plane" size={18} style={{ color: '#2563eb' }} /> NỘP BÁO CÁO TIẾN ĐỘ CHO CẤP TRÊN</h2>
                  </div>
                  <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Chọn công việc cần báo cáo <span className="required">*</span></label>
                      <select
                        className="form-select"
                        value={reportTaskId}
                        onChange={e => setReportTaskId(e.target.value)}
                      >
                        <option value="">-- Chọn công việc đang xử lý --</option>
                        {tasks.map(t => (
                          <option key={t.id} value={t.id}>
                            [{t.id}] {t.title} — ({t.assignee})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Trạng thái công việc hiện tại <span className="required">*</span></label>
                      <select
                        className="form-select"
                        value={reportProgressStatus}
                        onChange={e => setReportProgressStatus(e.target.value as TaskProgressStatus)}
                      >
                        <option value="dang_thuc_hien">🟡 Đang thực hiện theo tiến độ</option>
                        <option value="hoan_thanh">🟢 Đã hoàn thành (Xin nghiệm thu)</option>
                        <option value="tre_han">🔴 Đang trễ hạn</option>
                        <option value="xin_gia_han">🟠 Xin gia hạn deadline</option>
                      </select>
                    </div>

                    {reportProgressStatus === 'xin_gia_han' && (
                      <div className="form-group">
                        <label className="form-label">Hạn chót đề xuất mới <span className="required">*</span></label>
                        <input
                          type="date"
                          className="form-input"
                          value={reportExtensionDate}
                          onChange={e => setReportExtensionDate(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Mô tả nội dung tiến độ / Kết quả đạt được <span className="required">*</span></label>
                      <textarea
                        className="form-textarea"
                        rows={4}
                        placeholder="Nêu chi tiết kết quả đã hoàn thành, khối lượng công việc đã thực hiện, khó khăn vướng mắc nếu có..."
                        value={reportDescription}
                        onChange={e => setReportDescription(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Đính kèm tài liệu minh chứng</label>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => handleFileSelect(e.target.files)} multiple />
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
                          <Icon name="paperclip" size={14} /> Chọn tệp minh chứng (.pdf, .docx, .xlsx)
                        </button>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {attachedFiles.length > 0 ? `Đã chọn ${attachedFiles.length} tệp` : 'Chưa có tệp minh chứng'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          const targetTask = tasks.find(t => t.id === reportTaskId);
                          if (!reportTaskId || !targetTask) {
                            addToast('Thiếu thông tin', 'Vui lòng chọn công việc cần báo cáo!', 'warning');
                            return;
                          }
                          if (!reportDescription.trim()) {
                            addToast('Thiếu thông tin', 'Vui lòng nhập mô tả tiến độ!', 'warning');
                            return;
                          }

                          const newReport = createReport(
                            targetTask.id,
                            targetTask.title,
                            ROLE_CONFIG[activeRole].label === 'Chủ tịch UBND xã' ? 'Nguyễn Đình Hùng' : ROLE_CONFIG[activeRole].label,
                            ROLE_CONFIG[activeRole].label,
                            activeRole,
                            reportProgressStatus,
                            reportDescription,
                            attachedFiles.map(f => f.name),
                            reportProgressStatus === 'xin_gia_han' ? reportExtensionDate : undefined
                          );

                          setProgressReports(prev => [newReport, ...prev]);

                          // Cập nhật trạng thái task
                          setTasks(prev => prev.map(t => t.id === reportTaskId ? {
                            ...t,
                            status: reportProgressStatus === 'hoan_thanh' ? 'Cho_Duyet' : t.status,
                            progress: reportProgressStatus === 'hoan_thanh' ? 100 : t.progress,
                          } : t));

                          addToast('Nộp báo cáo thành công', `Đã gửi báo cáo tiến độ công việc "${targetTask.title}" lên cấp trên`, 'success');
                          setReportTaskId('');
                          setReportDescription('');
                          setAttachedFiles([]);
                          setReportSubTab('history');
                        }}
                      >
                        <Icon name="paper-plane" size={14} /> Gửi Báo Cáo Lên Cấp Trên
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: DUYỆT BÁO CÁO (2 CẤP DUYỆT) */}
              {reportSubTab === 'review' && (
                <div className="card">
                  <div className="card-header">
                    <h2><Icon name="clipboard-check" size={18} style={{ color: '#16a34a' }} /> DANH SÁCH BÁO CÁO CHỜ PHÊ DUYỆT</h2>
                  </div>
                  <div className="card-body">
                    {(() => {
                      const pending = getPendingReports(progressReports, activeRole);
                      if (pending.length === 0) {
                        return (
                          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Icon name="circle-check" size={44} style={{ color: '#16a34a', opacity: 0.3, marginBottom: 12 }} />
                            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Không có báo cáo nào chờ phê duyệt</h3>
                            <p style={{ fontSize: '0.85rem', marginTop: 4 }}>Tất cả báo cáo tiến độ gửi lên đã được xử lý xong.</p>
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          {pending.map(rpt => (
                            <div key={rpt.id} style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 16, background: '#ffffff' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                <div>
                                  <span className="badge badge-blue" style={{ fontSize: '0.72rem', marginRight: 8 }}>{rpt.id}</span>
                                  <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{rpt.taskTitle}</span>
                                </div>
                                <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                                  {REPORT_STATUS_LABELS[rpt.status]}
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: '0.82rem', marginBottom: 12, background: '#f8fafc', padding: 10, borderRadius: 8 }}>
                                <div><strong>Người báo cáo:</strong> {rpt.submittedBy} ({rpt.submittedByRole})</div>
                                <div><strong>Thời gian nộp:</strong> {rpt.submittedAt}</div>
                                <div><strong>Trạng thái CV:</strong> {PROGRESS_STATUS_LABELS[rpt.progressStatus]}</div>
                              </div>

                              <div style={{ fontSize: '0.85rem', lineHeight: 1.5, marginBottom: 14 }}>
                                <strong>Nội dung báo cáo:</strong> {rpt.description}
                              </div>

                              {rpt.extensionDate && (
                                <div className="alert alert-warning" style={{ padding: '8px 12px', fontSize: '0.82rem', marginBottom: 12 }}>
                                  <Icon name="clock" size={14} /> Xin gia hạn deadline đến ngày: <strong>{rpt.extensionDate}</strong>
                                </div>
                              )}

                              {/* Form phản hồi */}
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Nhập ý kiến chỉ đạo / phản hồi..."
                                  style={{ fontSize: '0.82rem' }}
                                  id={`review-feedback-${rpt.id}`}
                                />
                                <button
                                  type="button"
                                  className="btn btn-success btn-sm"
                                  onClick={() => {
                                    const input = document.getElementById(`review-feedback-${rpt.id}`) as HTMLInputElement;
                                    const feedback = input?.value || 'Đã phê duyệt báo cáo';
                                    const res = reviewReport(rpt, activeRole, ROLE_CONFIG[activeRole].label, 'approve', feedback);
                                    if (res.error) {
                                      addToast('Lỗi', res.error, 'danger');
                                      return;
                                    }
                                    setProgressReports(prev => prev.map(r => r.id === rpt.id ? res.updatedReport : r));
                                    addToast('Đã duyệt báo cáo', `Đã phê duyệt báo cáo "${rpt.taskTitle}"`, 'success');
                                  }}
                                >
                                  <Icon name="check" size={12} /> Duyệt
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-warning btn-sm"
                                  onClick={() => {
                                    const input = document.getElementById(`review-feedback-${rpt.id}`) as HTMLInputElement;
                                    const feedback = input?.value || 'Yêu cầu bổ sung thêm thông tin minh chứng';
                                    const res = reviewReport(rpt, activeRole, ROLE_CONFIG[activeRole].label, 'needs_revision', feedback);
                                    if (res.error) {
                                      addToast('Lỗi', res.error, 'danger');
                                      return;
                                    }
                                    setProgressReports(prev => prev.map(r => r.id === rpt.id ? res.updatedReport : r));
                                    addToast('Đã yêu cầu bổ sung', `Đã yêu cầu làm lại báo cáo "${rpt.taskTitle}"`, 'warning');
                                  }}
                                >
                                  <Icon name="rotate-left" size={12} /> Yêu cầu sửa
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => {
                                    const input = document.getElementById(`review-feedback-${rpt.id}`) as HTMLInputElement;
                                    const feedback = input?.value || 'Không đồng ý báo cáo này';
                                    const res = reviewReport(rpt, activeRole, ROLE_CONFIG[activeRole].label, 'reject', feedback);
                                    if (res.error) {
                                      addToast('Lỗi', res.error, 'danger');
                                      return;
                                    }
                                    setProgressReports(prev => prev.map(r => r.id === rpt.id ? res.updatedReport : r));
                                    addToast('Đã từ chối', `Đã từ chối báo cáo "${rpt.taskTitle}"`, 'danger');
                                  }}
                                >
                                  <Icon name="xmark" size={12} /> Từ chối
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* TAB 4: LỊCH SỬ BÁO CÁO */}
              {reportSubTab === 'history' && (
                <div className="card">
                  <div className="card-header">
                    <h2><Icon name="clock-rotate-left" size={18} style={{ color: '#2563eb' }} /> LỊCH SỬ TẤT CẢ BÁO CÁO TIẾN ĐỘ</h2>
                  </div>
                  <div className="card-body">
                    {progressReports.length === 0 ? (
                      <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <Icon name="folder-open" size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
                        <p>Chưa có báo cáo tiến độ nào được tạo trong hệ thống.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {progressReports.map(rpt => (
                          <div key={rpt.id} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <div>
                                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{rpt.taskTitle}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 8 }}>({rpt.submittedAt})</span>
                              </div>
                              <span className={`badge ${rpt.status === 'approved_final' ? 'badge-success' : rpt.status === 'rejected' ? 'badge-urgent' : 'badge-warning'}`}>
                                {REPORT_STATUS_LABELS[rpt.status]}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                              Người nộp: <strong>{rpt.submittedBy}</strong> ({rpt.submittedByRole}) • Trạng thái: <strong>{PROGRESS_STATUS_LABELS[rpt.progressStatus]}</strong>
                            </div>
                            <div style={{ fontSize: '0.84rem', background: '#f8fafc', padding: 8, borderRadius: 6 }}>
                              {rpt.description}
                            </div>
                            {rpt.reviewHistory.length > 0 && (
                              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #e2e8f0', fontSize: '0.78rem' }}>
                                <strong>Lịch sử phê duyệt ({rpt.reviewHistory.length}):</strong>
                                {rpt.reviewHistory.map(rv => (
                                  <div key={rv.id} style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
                                    • {rv.reviewedAt} - <strong>{rv.reviewedBy}</strong> ({rv.reviewedByRole}): {rv.action === 'approve' ? '✅ Đồng ý' : rv.action === 'reject' ? '❌ Từ chối' : '⚠️ Yêu cầu sửa'} — "{rv.feedback}"
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         TASK DETAIL DRAWER
         ═══════════════════════════════════════════════════════════════ */}
      {selectedTask && (
        <>
          <div className="drawer-overlay" onClick={() => setSelectedTaskId(null)} />
          <div className="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-task-title">
            <div className="drawer-header">
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>{selectedTask.id}</div>
                <h2 id="drawer-task-title" style={{ fontSize: '1.05rem', fontWeight: 800 }}>{selectedTask.title}</h2>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Đóng bảng chi tiết công việc" onClick={() => setSelectedTaskId(null)}>
                <Icon name="xmark" size={16} />
              </button>
            </div>

            <div className="drawer-body">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                <span className={`badge ${getStatusBadge(selectedTask.status)}`}>{STATUS_LABELS[selectedTask.status]}</span>
                <span className={`badge ${getPriorityBadge(selectedTask.priority)}`}>{PRIORITY_LABELS[selectedTask.priority]}</span>
                <span className={`badge ${getCategoryBadge(selectedTask.category)}`}>{CATEGORY_LABELS[selectedTask.category]}</span>
                <span className="badge badge-blue">
                  <Icon name={SHIFT_CONFIG[selectedTask.shift].icon} size={11} /> {SHIFT_CONFIG[selectedTask.shift].label} ({selectedTask.startTime})
                </span>
                {selectedTask.rating && (() => {
                  const normalizedScore = selectedTask.rating > 10.0 ? selectedTask.rating / 10.0 : selectedTask.rating;
                  const tier = getEvaluationTier(normalizedScore);
                  const hasBreakdown = selectedTask.systemScore !== null && selectedTask.systemScore !== undefined && selectedTask.evaluatorScore !== null && selectedTask.evaluatorScore !== undefined;

                  const sysScore = (selectedTask.systemScore ?? 0) > 3.0 ? (selectedTask.systemScore ?? 0) / 10.0 : (selectedTask.systemScore ?? 0);
                  const evalScore = (selectedTask.evaluatorScore ?? 0) > 7.0 ? (selectedTask.evaluatorScore ?? 0) / 10.0 : (selectedTask.evaluatorScore ?? 0);

                  return (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span className={`badge ${tier.badgeClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon name={tier.icon} size={11} /> Đánh giá: {normalizedScore.toFixed(1)}/10 — {tier.label}
                      </span>
                      {hasBreakdown && (
                        <span style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                          (Hệ thống: <strong>{sysScore.toFixed(1)}đ</strong> + Lãnh đạo: <strong>{evalScore.toFixed(1)}đ</strong>)
                        </span>
                      )}
                      {ROLE_CONFIG[activeRole].scopeLevel <= 3.0 && (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => {
                            setRatingRevisionNewScore(normalizedScore);
                            setRatingRevisionReason('');
                            setRatingRevisionEvidenceUrl('');
                            setRatingRevisionFileName('');
                            setRatingRevisionFileSize('');
                            setRatingRevisionFileType('');
                            setShowRatingRevisionModal(true);
                          }}
                          style={{ fontSize: '0.72rem', padding: '2px 8px', fontWeight: 600 }}
                          title="Yêu cầu điều chỉnh điểm số đánh giá"
                        >
                          <Icon name="pen-to-square" size={11} /> Yêu cầu sửa đánh giá
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {selectedTask.rejectionReason && selectedTask.status === 'Tu_Choi' && (
                <div className="alert alert-danger" style={{ marginBottom: 18, fontSize: '0.85rem' }}>
                  <strong><Icon name="triangle-exclamation" size={14} /> Lãnh đạo yêu cầu sửa lại:</strong><br />
                  {selectedTask.rejectionReason}
                </div>
              )}

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 18 }}>
                <strong>Mô tả nội dung:</strong><br />
                {selectedTask.description}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.82rem', marginBottom: 18 }}>
                <div><strong>Người giao:</strong> {selectedTask.assignedBy}</div>
                <div><strong>Người thực hiện:</strong> {selectedTask.assignee}</div>
                <div><strong>Hạn chót:</strong> {formatDateDisplay(selectedTask.dueDate)}</div>
                <div><strong>Giờ định mức:</strong> {selectedTask.effortHours} giờ</div>
              </div>

              {/* ── BÁO CÁO KẾT QUẢ NỘP BÀI & CHÚ THÍCH KHOANH VÙNG (INLINE ANNOTATIONS) ── */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="file-lines" size={15} style={{ color: '#2563eb' }} />
                    Văn Bản Kết Quả Nộp & Chú Thích Khoanh Vùng
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Bôi đen đoạn văn để thêm nhận xét
                  </span>
                </div>

                {/* Submission Text Content with Interactive Selection & Annotation Highlighting */}
                <div style={{ position: 'relative' }}>
                  {(() => {
                    const sampleSubmissionText = selectedTask.submissionNote || `Báo cáo tổng hợp số liệu đã được kiểm tra chéo với Phòng Kinh tế - Địa chính và hoàn thiện theo đúng biểu mẫu Nghị định số 61/2018/NĐ-CP và Quyết định 468/QĐ-TTg của Thủ tướng Chính phủ. Kính trình Lãnh đạo UBND xã xem xét nghiệm thu và chỉ đạo bổ sung các nội dung liên quan đến phương án số hóa 100% kết quả giải quyết TTHC còn hiệu lực.`;

                    // Render annotated segments
                    const activeAnns = taskAnnotations.filter(a => sampleSubmissionText.includes(a.anchorText));

                    let renderedElements: React.ReactNode[] = [];
                    if (activeAnns.length === 0) {
                      renderedElements = [sampleSubmissionText];
                    } else {
                      // Match and highlight annotations
                      let lastIdx = 0;
                      const sortedAnns = [...activeAnns].sort((a, b) => {
                        const idxA = sampleSubmissionText.indexOf(a.anchorText, a.startOffsetHint || 0);
                        const idxB = sampleSubmissionText.indexOf(b.anchorText, b.startOffsetHint || 0);
                        return idxA - idxB;
                      });

                      sortedAnns.forEach((ann, i) => {
                        const foundIdx = sampleSubmissionText.indexOf(ann.anchorText, lastIdx);
                        if (foundIdx !== -1 && foundIdx >= lastIdx) {
                          if (foundIdx > lastIdx) {
                            renderedElements.push(sampleSubmissionText.substring(lastIdx, foundIdx));
                          }
                          const isResolved = ann.resolvedStatus === 'Resolved';
                          const isLoiSai = ann.severity === 1 || ann.severityText === 'LoiSai';
                          const isCanSua = ann.severity === 2 || ann.severityText === 'CanChinhSua';

                          const highlightBg = isResolved ? '#f1f5f9' : isLoiSai ? '#fee2e2' : isCanSua ? '#ffedd5' : '#eff6ff';
                          const borderBottomColor = isResolved ? '#94a3b8' : isLoiSai ? '#ef4444' : isCanSua ? '#f97316' : '#3b82f6';
                          const textColor = isResolved ? '#64748b' : isLoiSai ? '#991b1b' : isCanSua ? '#9a3412' : '#1e40af';

                          renderedElements.push(
                            <mark
                              key={`ann_${ann.id}_${i}`}
                              onClick={(e) => {
                                const rect = (e.target as HTMLElement).getBoundingClientRect();
                                setActiveAnnotationPopover(ann);
                                setActivePopoverPos({ top: rect.bottom + 6, left: Math.max(10, rect.left - 20) });
                              }}
                              style={{
                                background: highlightBg,
                                color: textColor,
                                borderBottom: `2px solid ${borderBottomColor}`,
                                padding: '1px 3px',
                                borderRadius: 3,
                                cursor: 'pointer',
                                fontWeight: 600,
                                textDecoration: isResolved ? 'line-through' : 'none',
                                opacity: isResolved ? 0.75 : 1,
                                transition: 'all 0.15s ease'
                              }}
                              title={`[${ann.severityText || 'Góp ý'}] ${ann.commentText} — Nhấn để xem chi tiết`}
                            >
                              {ann.anchorText}
                              {!isResolved && (
                                <span style={{ fontSize: '0.65rem', marginLeft: 3, color: borderBottomColor }}>
                                  <Icon name={isLoiSai ? 'circle-exclamation' : isCanSua ? 'pen' : 'comment'} size={9} />
                                </span>
                              )}
                            </mark>
                          );
                          lastIdx = foundIdx + ann.anchorText.length;
                        }
                      });
                      if (lastIdx < sampleSubmissionText.length) {
                        renderedElements.push(sampleSubmissionText.substring(lastIdx));
                      }
                    }

                    return (
                      <div
                        onMouseUp={handleTextSelection}
                        style={{
                          background: '#f8fafc',
                          padding: '12px 14px',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          fontSize: '0.85rem',
                          lineHeight: 1.7,
                          color: '#1e293b',
                          cursor: 'text',
                          userSelect: 'text'
                        }}
                      >
                        {renderedElements}
                      </div>
                    );
                  })()}

                  {/* Floating Action Button "Thêm nhận xét" right above user text selection */}
                  {selectionTooltipPos && (
                    <div
                      style={{
                        position: 'fixed',
                        top: selectionTooltipPos.top,
                        left: selectionTooltipPos.left,
                        zIndex: 9999,
                        display: 'flex',
                        gap: 4
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        onClick={handleOpenAnnotationModal}
                        style={{
                          boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Icon name="comment-dots" size={12} /> Thêm nhận xét
                      </button>
                    </div>
                  )}

                  {/* Popover on Clicking Highlighted Text */}
                  {activeAnnotationPopover && (
                    <div
                      style={{
                        position: 'fixed',
                        top: activePopoverPos?.top ?? 200,
                        left: activePopoverPos?.left ?? 200,
                        zIndex: 9999,
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        padding: 12,
                        width: 290,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span className={`badge ${activeAnnotationPopover.severity === 1 ? 'badge-urgent' : activeAnnotationPopover.severity === 2 ? 'badge-warning' : 'badge-blue'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                          {activeAnnotationPopover.severityText || (activeAnnotationPopover.severity === 1 ? 'Lỗi sai' : activeAnnotationPopover.severity === 2 ? 'Cần sửa' : 'Góp ý')}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => setActiveAnnotationPopover(null)}
                          style={{ padding: 2, height: 'auto', color: '#94a3b8' }}
                        >
                          <Icon name="xmark" size={12} />
                        </button>
                      </div>

                      <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4, lineHeight: 1.4 }}>
                        {activeAnnotationPopover.commentText}
                      </div>

                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: 8 }}>
                        Bởi <strong>{activeAnnotationPopover.createdByUserName}</strong> • {new Date(activeAnnotationPopover.createdAt).toLocaleString('vi-VN')}
                      </div>

                      {activeAnnotationPopover.resolvedStatus === 'Open' ? (
                        <button
                          type="button"
                          className="btn btn-success btn-xs"
                          style={{ width: '100%', fontSize: '0.72rem', padding: '4px 8px' }}
                          onClick={() => handleResolveAnnotation(selectedTask.id, activeAnnotationPopover.id)}
                        >
                          <Icon name="check" size={11} style={{ marginRight: 4 }} /> Đánh dấu đã sửa xong
                        </button>
                      ) : (
                        <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Icon name="circle-check" size={11} /> Đã sửa xong ({activeAnnotationPopover.resolvedByUserName || 'Cán bộ'})
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* List of Annotations Pane */}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed #e2e8f0' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      <Icon name="comments" size={12} style={{ color: '#2563eb', marginRight: 4 }} />
                      Danh Sách Góp Ý & Chú Thích ({taskAnnotations.length})
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {taskAnnotations.filter(a => a.resolvedStatus === 'Open').length} đang mở / {taskAnnotations.filter(a => a.resolvedStatus === 'Resolved').length} đã sửa
                    </span>
                  </div>

                  {taskAnnotations.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>
                      Chưa có chú thích nào. Bôi đen một đoạn chữ trên văn bản kết quả để thêm nhận xét!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {taskAnnotations.map(ann => {
                        const isResolved = ann.resolvedStatus === 'Resolved';
                        return (
                          <div
                            key={ann.id}
                            style={{
                              background: isResolved ? '#f8fafc' : '#ffffff',
                              border: `1px solid ${isResolved ? '#e2e8f0' : ann.severity === 1 ? '#fecaca' : ann.severity === 2 ? '#fed7aa' : '#bfdbfe'}`,
                              borderRadius: 6,
                              padding: '8px 10px',
                              fontSize: '0.78rem',
                              opacity: isResolved ? 0.75 : 1
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span className={`badge ${ann.severity === 1 ? 'badge-urgent' : ann.severity === 2 ? 'badge-warning' : 'badge-blue'}`} style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                                  {ann.severityText || (ann.severity === 1 ? 'Lỗi sai' : ann.severity === 2 ? 'Cần sửa' : 'Góp ý')}
                                </span>
                                <span style={{ fontStyle: 'italic', color: '#475569', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  "{ann.anchorText}"
                                </span>
                              </div>
                              {isResolved ? (
                                <span style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 600 }}>
                                  <Icon name="check" size={10} /> Đã sửa
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  style={{ fontSize: '0.68rem', padding: '1px 6px', color: '#16a34a', borderColor: '#86efac' }}
                                  onClick={() => handleResolveAnnotation(selectedTask.id, ann.id)}
                                >
                                  Đã sửa xong
                                </button>
                              )}
                            </div>
                            <div style={{ color: '#1e293b', fontWeight: 500, lineHeight: 1.4, margin: '3px 0' }}>
                              {ann.commentText}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                              {ann.createdByUserName} • {new Date(ann.createdAt).toLocaleString('vi-VN')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── LUẬT 72/2025: KHỐI PHẢN BIỆN UBMTTQ CHO NHIỆM VỤ DỰ ÁN / NGHỊ QUYẾT ── */}
              {selectedTask.category === 'Du_An' && (
                <div style={{ background: '#fdf2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 14, marginBottom: 18 }}>
                  <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.88rem', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="landmark-flag" size={14} style={{ color: '#dc2626' }} />
                    Báo Cáo Phản Biện Xã Hội UBMTTQ (Luật 72/2025/QH15)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#7f1d1d', marginBottom: 10 }}>
                    Theo quy định, công việc thuộc loại Dự án / Nghị quyết trọng điểm bắt buộc phải có ý kiến phản biện chính thức của UBMTTQ xã trước khi Lãnh đạo UBND phê duyệt.
                  </div>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    style={{ fontSize: '0.82rem', marginBottom: 8, background: '#ffffff' }}
                    placeholder="Nhập nội dung ý kiến phản biện của UBMTTQ xã…"
                    value={ubmttqContent}
                    onChange={(e) => setUbmttqContent(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-danger btn-xs"
                      onClick={() => handleUBMTTQReview(selectedTask.id, false)}
                    >
                      <Icon name="xmark" size={11} /> Yêu Cầu Chỉnh Sửa
                    </button>
                    <button
                      type="button"
                      className="btn btn-success btn-xs"
                      onClick={() => handleUBMTTQReview(selectedTask.id, true)}
                    >
                      <Icon name="check" size={11} /> Đã Phản Biện (Đồng Ý)
                    </button>
                  </div>
                </div>
              )}

              {/* ── LỊCH SỬ ĐÁNH GIÁ & NGHIỆM THU (AUDIT TRAIL MINH BẠCH 100%) ── */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="clock-rotate-left" size={14} style={{ color: '#2563eb' }} />
                    Lịch Sử Đánh Giá & Điều Chỉnh Điểm ({taskRatingHistory.length})
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selectedTask && (
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        style={{ borderColor: '#2563eb', color: '#2563eb', fontWeight: 600, fontSize: '0.75rem', padding: '3px 8px' }}
                        onClick={() => handleOpenRatingRevisionModal(selectedTask)}
                      >
                        <Icon name="pen-to-square" size={11} style={{ marginRight: 4 }} /> Yêu cầu sửa đánh giá
                      </button>
                    )}
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>Minh bạch 100%</span>
                  </div>
                </div>

                {taskRatingHistory.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>
                    Chưa có lịch sử thay đổi điểm số đánh giá.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                    {taskRatingHistory.map((item) => {
                      const getStatusBadge = (status: RatingApprovalStatusEnum) => {
                        switch (status) {
                          case 'Applied': return <span className="badge" style={{ background: '#ecfdf5', color: '#16a34a', border: '1px solid #a7f3d0' }}><Icon name="check" size={10} /> Đã áp dụng</span>;
                          case 'PendingApproval': return <span className="badge" style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fef3c7' }}><Icon name="clock" size={10} /> Chờ cấp trên duyệt</span>;
                          case 'ApprovedBySuperior': return <span className="badge" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}><Icon name="circle-check" size={10} /> Cấp trên đã duyệt</span>;
                          case 'RejectedBySuperior': return <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}><Icon name="xmark" size={10} /> Từ chối</span>;
                          default: return <span className="badge">{status}</span>;
                        }
                      };

                      return (
                        <div key={item.id} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, border: '1px solid #f1f5f9', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div>
                              <span style={{ fontWeight: 700, color: '#1e293b' }}>
                                {item.oldScore !== null && item.oldScore !== undefined ? `${item.oldScore.toFixed(1)} điểm` : 'Chưa chấm'} → <strong style={{ color: '#2563eb' }}>{item.newScore.toFixed(1)} điểm</strong>
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 8 }}>
                                (Độ lệch: {item.scoreDelta.toFixed(1)} đ)
                              </span>
                            </div>
                            {getStatusBadge(item.approvalStatus)}
                          </div>

                          <div style={{ color: '#475569', fontSize: '0.8rem', marginTop: 4, lineHeight: 1.4 }}>
                            <strong>Lý do:</strong> {item.reason}
                          </div>

                          {item.evidenceUrl && (
                            <div style={{ marginTop: 6, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <strong>Minh chứng:</strong>{' '}
                              <a
                                href={item.evidenceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="badge badge-blue"
                                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}
                              >
                                <Icon name={item.evidenceUrl.startsWith('data:image/') ? 'image' : 'file-lines'} size={11} />
                                {item.evidenceUrl.startsWith('data:') ? 'Xem tệp minh chứng đính kèm' : (item.evidenceUrl.length > 40 ? item.evidenceUrl.substring(0, 40) + '...' : item.evidenceUrl)}
                              </a>
                            </div>
                          )}

                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                            <span>Người yêu cầu: <strong>{item.changedByUserName}</strong></span>
                            <span>{new Date(item.changedAt).toLocaleString('vi-VN')}</span>
                          </div>

                          {item.approvedByUserName && (
                            <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: 3 }}>
                              <Icon name="user-check" size={10} /> Người duyệt cấp trên: <strong>{item.approvedByUserName}</strong> ({item.approvedAt ? new Date(item.approvedAt).toLocaleString('vi-VN') : ''})
                            </div>
                          )}

                          {item.rejectionReason && (
                            <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: 3 }}>
                              <Icon name="triangle-exclamation" size={10} /> Lý do từ chối: {item.rejectionReason}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── BÌNH LUẬN & @MENTION ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#64748b' }}>
                  <Icon name="at" size={12} style={{ color: '#2563eb' }} />
                  Nhắc tên nhanh:
                  <button type="button" className="spec-chip" style={{ cursor: 'pointer', padding: '1px 6px' }} onClick={() => setNewComment(prev => prev + ' @NguyenDinhHung')}>@NguyenDinhHung</button>
                  <button type="button" className="spec-chip" style={{ cursor: 'pointer', padding: '1px 6px' }} onClick={() => setNewComment(prev => prev + ' @TranThiMai')}>@TranThiMai</button>
                  <button type="button" className="spec-chip" style={{ cursor: 'pointer', padding: '1px 6px' }} onClick={() => setNewComment(prev => prev + ' @all')}>@all</button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    style={{ fontSize: '0.82rem' }}
                    placeholder="Nhập ý kiến chỉ đạo, xử lý (gõ @ để gửi thông báo trực tiếp đến cán bộ phụ trách)…"
                    aria-label="Nhập ý kiến chỉ đạo, xử lý"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddComment(selectedTask.id)}>
                    Gửi
                  </button>
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f8fafc' }}>
              {/* ── BUTTONS ── */}
              {(selectedTask.status === 'Dang_Xu_Ly' || selectedTask.status === 'Tu_Choi') && ROLE_CONFIG[activeRole].scopeLevel >= 2.5 && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSubmitTask(selectedTask.id)}>
                  <Icon name="paper-plane" size={12} /> Xin Nghiệm Thu
                </button>
              )}
              {selectedTask.status === 'Cho_Duyet' && ROLE_CONFIG[activeRole].scopeLevel <= 2.5 && (
                <>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRejectTask(selectedTask.id)}>
                    <Icon name="xmark" size={12} /> Yêu Cầu Sửa Lại
                  </button>
                  <button type="button" className="btn btn-success btn-sm" onClick={() => handleApproveTask(selectedTask.id)}>
                    <Icon name="check" size={12} /> Phê Duyệt & Đánh Giá
                  </button>
                </>
              )}
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedTaskId(null)}>
                Đóng
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL: CHẤM ĐIỂM & NGHIỆM THU (THANG 10: 3 ĐIỂM HỆ THỐNG + 7 ĐIỂM NGƯỜI CHẤM)
         ═══════════════════════════════════════════════════════════════ */}
      {showApproveModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 580 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Icon name="clipboard-check" size={20} /> CHẤM ĐIỂM & NGHIỆM THU CÔNG VIỆC
              </h2>
              <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                Thang 100 Điểm
              </span>
            </div>

            <div className="alert alert-info" style={{ marginBottom: 16, fontSize: '0.8rem', lineHeight: 1.5 }}>
              <Icon name="circle-info" size={14} style={{ marginRight: 6 }} />
              Đánh giá theo quy chuẩn <strong>Thang 10 điểm</strong>: <strong>3 điểm</strong> hệ thống tự động tính khách quan + <strong>7 điểm</strong> do người chấm quyết định.
            </div>

            {/* ── 1. ĐIỂM HỆ THỐNG TỰ TÍNH (30 ĐIỂM) ── */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="gears" size={14} style={{ color: '#2563eb' }} /> 1. Điểm Hệ Thống Tự Tính:
                </span>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#2563eb' }}>
                  {isLoadingSystemScore ? 'Đang tính…' : `${(systemScoreBreakdown?.totalSystemScore ?? 30.0).toFixed(1)} / 30.0 đ`}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: '0.78rem' }}>
                {/* Tiêu chí 1: Đúng hạn */}
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                  <div style={{ color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="clock" size={11} style={{ color: '#2563eb' }} /> Đúng hạn
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', marginTop: 2 }}>
                    {(systemScoreBreakdown?.onTimeScore ?? 1.5).toFixed(1)} / 1.5 đ
                  </div>
                  <div style={{ fontSize: '0.7rem', color: (systemScoreBreakdown?.daysLate ?? 0) > 0 ? '#dc2626' : '#16a34a', marginTop: 2 }}>
                    {(systemScoreBreakdown?.daysLate ?? 0) > 0 ? `Trễ ${systemScoreBreakdown?.daysLate} ngày (-${((systemScoreBreakdown?.daysLate ?? 0) * 2).toFixed(1)}đ)` : 'Đúng/Trước hạn'}
                  </div>
                </div>

                {/* Tiêu chí 2: Sản phẩm đầu ra */}
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                  <div style={{ color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="list-check" size={11} style={{ color: '#16a34a' }} /> Sản phẩm
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', marginTop: 2 }}>
                    {(systemScoreBreakdown?.checklistScore ?? 10.0).toFixed(1)} / 10.0 đ
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>
                    {systemScoreBreakdown && systemScoreBreakdown.totalSubTasks > 0 ? `${systemScoreBreakdown.completedSubTasks}/${systemScoreBreakdown.totalSubTasks} đầu việc` : '100% đạt chuẩn'}
                  </div>
                </div>

                {/* Tiêu chí 3: Không bị trả lại */}
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
                  <div style={{ color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="rotate-left" size={11} style={{ color: '#d97706' }} /> Trả lại
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', marginTop: 2 }}>
                    {(systemScoreBreakdown?.noRejectionScore ?? 5.0).toFixed(1)} / 5.0 đ
                  </div>
                  <div style={{ fontSize: '0.7rem', color: (systemScoreBreakdown?.rejectionCount ?? 0) > 0 ? '#dc2626' : '#16a34a', marginTop: 2 }}>
                    {(systemScoreBreakdown?.rejectionCount ?? 0) > 0 ? `${systemScoreBreakdown?.rejectionCount} lần yêu cầu sửa` : '0 lần trả lại'}
                  </div>
                </div>
              </div>
            </div>

            {/* ── 2. ĐIỂM NGƯỜI CHẤM QUYẾT ĐỊNH (70 ĐIỂM) ── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="user-check" size={14} style={{ color: '#16a34a' }} /> 2. Điểm Người Chấm Quyết Định:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min={0}
                    max={70}
                    step={0.5}
                    value={evaluatorScore}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEvaluatorScore(Math.min(70, Math.max(0, val)));
                    }}
                    style={{ width: 70, padding: '4px 8px', textAlign: 'right', fontWeight: 800, fontSize: '1rem', color: '#16a34a', borderRadius: 6, border: '1.5px solid #86efac' }}
                  />
                  <span style={{ fontWeight: 700, color: '#64748b', fontSize: '0.88rem' }}>/ 70.0 đ</span>
                </div>
              </div>

              {/* Slider 0 - 70 */}
              <input
                type="range"
                min={0}
                max={70}
                step={0.5}
                value={evaluatorScore}
                onChange={(e) => setEvaluatorScore(parseFloat(e.target.value))}
                style={{ width: '100%', height: 6, accentColor: '#16a34a', cursor: 'pointer', marginBottom: 10 }}
              />

              {/* 5 Preset Quick Buttons for Evaluator (0 - 70) */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { label: 'Xuất sắc', score: 68.0, color: '#047857', bg: '#ecfdf5', icon: 'trophy' },
                  { label: 'Tốt', score: 60.0, color: '#1d4ed8', bg: '#eff6ff', icon: 'star' },
                  { label: 'Đạt yêu cầu', score: 48.0, color: '#b45309', bg: '#fffbeb', icon: 'thumbs-up' },
                  { label: 'Cần cải thiện', score: 35.0, color: '#c2410c', bg: '#fff7ed', icon: 'triangle-exclamation' },
                  { label: 'Chưa đạt', score: 20.0, color: '#b91c1c', bg: '#fef2f2', icon: 'circle-xmark' },
                ].map(p => {
                  const isSelected = Math.abs(evaluatorScore - p.score) < 0.5;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setEvaluatorScore(p.score)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        borderRadius: 6,
                        border: `1px solid ${isSelected ? p.color : '#cbd5e1'}`,
                        background: isSelected ? p.bg : '#ffffff',
                        color: isSelected ? p.color : '#475569',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Icon name={p.icon} size={11} /> {p.label} ({p.score}đ)
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── 3. TỔNG ĐIỂM NGHIỆM THU (THANG 100) PREVIEW ── */}
            {(() => {
              const totalSys = systemScoreBreakdown?.totalSystemScore ?? 30.0;
              const totalScore = Math.min(100.0, totalSys + evaluatorScore);
              const currentTier = getEvaluationTier(totalScore);

              return (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: currentTier.bgColor,
                    border: currentTier.borderColor,
                    color: currentTier.color,
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '50%',
                      background: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    }}
                  >
                    <Icon name={currentTier.icon} size={20} style={{ color: currentTier.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.98rem', textTransform: 'uppercase' }}>
                        Mức {currentTier.level}: {currentTier.label}
                      </span>
                      <span className={`badge ${currentTier.badgeClass}`} style={{ fontSize: '0.78rem', fontWeight: 800 }}>
                        {totalScore.toFixed(1)} / 100.0 Điểm
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', marginTop: 4, opacity: 0.95 }}>
                      Điểm Hệ Thống: <strong>{totalSys.toFixed(1)}đ</strong> + Người Chấm: <strong>{evaluatorScore.toFixed(1)}đ</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', marginTop: 2, opacity: 0.85 }}>
                      {currentTier.subText}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setShowApproveModal(false)}>Hủy</button>
              <button className="btn btn-success" onClick={confirmApproveTask}>
                <Icon name="check" size={14} style={{ marginRight: 6 }} /> Xác Nhận Nghiệm Thu ({(Math.min(100.0, (systemScoreBreakdown?.totalSystemScore ?? 30.0) + evaluatorScore)).toFixed(1)} Điểm)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL: YÊU CẦU SỬA ĐÁNH GIÁ CÔNG VIỆC (CHỐNG THIÊN VỊ - THANG 10)
         ═══════════════════════════════════════════════════════════════ */}
      {showRatingRevisionModal && selectedTask && (() => {
        const rawOld = selectedTask.rating !== undefined && selectedTask.rating !== null ? selectedTask.rating : (selectedTask.ratingScore ?? 0);
        const oldScore = rawOld > 10.0 ? rawOld / 10.0 : rawOld;
        const delta = Math.abs(ratingRevisionNewScore - oldScore);
        const isPendingApprovalNeeded = delta > 1.0;
        const isReasonValid = ratingRevisionReason.trim().length >= 30;
        const isEvidenceValid = ratingRevisionEvidenceUrl.trim().length > 0;

        return (
          <div className="welcome-modal-overlay">
            <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 560 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="pen-to-square" size={18} style={{ color: '#2563eb' }} /> YÊU CẦU ĐIỀU CHỈNH ĐIỂM ĐÁNH GIÁ (THANG 10)
              </h2>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: '0.82rem', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedTask.title}</div>
                <div style={{ color: '#64748b', marginTop: 2 }}>
                  Điểm đánh giá hiện tại: <strong>{oldScore > 0 ? `${oldScore.toFixed(1)} / 10.0 điểm` : 'Chưa chấm'}</strong>
                </div>
              </div>

              {/* 10-Point Score Selector */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Chọn điểm mới đề xuất (0.0 – 10.0 điểm):</span>
                  <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#2563eb' }}>
                    {ratingRevisionNewScore.toFixed(1)} / 10.0
                  </span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.1}
                    value={ratingRevisionNewScore}
                    onChange={(e) => setRatingRevisionNewScore(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={ratingRevisionNewScore}
                    onChange={(e) => setRatingRevisionNewScore(Math.min(10, Math.max(0, parseFloat(e.target.value) || 0)))}
                    style={{ width: 70, padding: '4px 8px', textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* Pre-submit Warning Banner */}
              {isPendingApprovalNeeded ? (
                <div className="alert alert-warning" style={{ background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309', padding: '10px 12px', borderRadius: 8, marginBottom: 14, fontSize: '0.8rem' }}>
                  <Icon name="triangle-exclamation" size={14} style={{ marginRight: 6 }} />
                  Độ chênh lệch {delta.toFixed(1)} điểm (<strong>&gt; 1.0 điểm</strong>). Đề xuất này <strong>cần Lãnh đạo cấp trên phê duyệt (Kiểm soát hai bước)</strong> trước khi có hiệu lực chính thức!
                </div>
              ) : (
                <div className="alert alert-info" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '10px 12px', borderRadius: 8, marginBottom: 14, fontSize: '0.8rem' }}>
                  <Icon name="circle-check" size={14} style={{ marginRight: 6 }} />
                  Độ chênh lệch {delta.toFixed(1)} điểm (<strong>&le; 1.0 điểm</strong>). Điểm mới sẽ được <strong>áp dụng ngay lập tức</strong>.
                </div>
              )}

              {/* Reason Textarea */}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Lý do thay đổi đánh giá <span className="required">*</span></span>
                  <span style={{ fontSize: '0.72rem', color: isReasonValid ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {ratingRevisionReason.trim().length} / 30 ký tự
                  </span>
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="Nhập lý do chi tiết giải trình việc điều chỉnh điểm (Bắt buộc tối thiểu 30 ký tự để chống thiên vị)..."
                  value={ratingRevisionReason}
                  onChange={e => setRatingRevisionReason(e.target.value)}
                />
              </div>

              {/* Evidence File / Image Picker */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span>Tệp / Hình ảnh minh chứng đính kèm <span className="required">*</span></span>
                  {ratingRevisionFileName && (
                    <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
                      <Icon name="circle-check" size={11} /> Đã chọn tệp
                    </span>
                  )}
                </label>

                {!ratingRevisionEvidenceUrl ? (
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '18px 16px',
                    border: '2px dashed #cbd5e1',
                    borderRadius: 8,
                    background: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx,.xls"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setRatingRevisionFileName(file.name);
                          setRatingRevisionFileSize((file.size / 1024).toFixed(1) + ' KB');
                          setRatingRevisionFileType(file.type);
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            setRatingRevisionEvidenceUrl(ev.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                      <Icon name="cloud-arrow-up" size={18} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.85rem' }}>Bấm để chọn tệp hoặc ảnh chụp minh chứng từ máy tính</span>
                      <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: '#64748b' }}>Hỗ trợ biên bản PDF, Word (.docx), Excel, ảnh chụp JPG/PNG</p>
                    </div>
                  </label>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 8
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0 }}>
                        <Icon name={ratingRevisionFileType.includes('image') ? 'image' : 'file-lines'} size={18} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#1e3a8a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ratingRevisionFileName || 'Tệp minh chứng đã chọn'}
                        </div>
                        <div style={{ fontSize: '0.73rem', color: '#64748b' }}>{ratingRevisionFileSize || 'Định dạng hợp lệ'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {ratingRevisionEvidenceUrl.startsWith('data:image/') && (
                        <a
                          href={ratingRevisionEvidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline"
                          style={{ padding: '3px 8px', fontSize: '0.74rem', background: '#fff' }}
                        >
                          <Icon name="eye" size={11} /> Xem ảnh
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                        onClick={() => {
                          setRatingRevisionEvidenceUrl('');
                          setRatingRevisionFileName('');
                          setRatingRevisionFileSize('');
                          setRatingRevisionFileType('');
                        }}
                      >
                        <Icon name="trash-can" size={11} /> Đổi tệp khác
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-outline" onClick={() => setShowRatingRevisionModal(false)}>Hủy</button>
                <button
                  className="btn btn-primary"
                  disabled={!isReasonValid || !isEvidenceValid}
                  onClick={handleSubmitRatingRevision}
                  style={{ opacity: isReasonValid && isEvidenceValid ? 1 : 0.6 }}
                >
                  <Icon name="paper-plane" size={13} style={{ marginRight: 6 }} /> Gửi Đề Xuất Sửa Điểm
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL: TẠO CHÚ THÍCH KHOANH VÙNG (TASK REVIEW ANNOTATION)
         ═══════════════════════════════════════════════════════════════ */}
      {showAnnotationModal && selectedTask && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 480 }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 14, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="comment-dots" size={18} /> THÊM CHÚ THÍCH KHOANH VÙNG
            </h2>

            <div style={{ background: '#f8fafc', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 14, fontSize: '0.8rem' }}>
              <div style={{ color: '#64748b', fontSize: '0.72rem', fontWeight: 600, marginBottom: 2 }}>Đoạn văn bản được chọn:</div>
              <div style={{ fontStyle: 'italic', color: '#1e293b', background: '#ffffff', padding: '6px 8px', borderRadius: 4, borderLeft: '3px solid #2563eb' }}>
                "{selectedAnchorText}"
              </div>
            </div>

            {/* Severity Selector */}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ marginBottom: 6 }}>Mức độ nhận xét / góp ý:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { value: 1, label: 'Lỗi sai', color: '#ef4444', bg: '#fee2e2', border: '#fca5a5' },
                  { value: 2, label: 'Cần chỉnh sửa', color: '#f97316', bg: '#ffedd5', border: '#fdba74' },
                  { value: 3, label: 'Góp ý', color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd' },
                ].map(sev => (
                  <button
                    key={sev.value}
                    type="button"
                    onClick={() => setAnnotationSeverity(sev.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: `1.5px solid ${annotationSeverity === sev.value ? sev.color : '#e2e8f0'}`,
                      background: annotationSeverity === sev.value ? sev.bg : '#ffffff',
                      color: annotationSeverity === sev.value ? sev.color : '#64748b',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    {sev.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment Textarea */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Nội dung nhận xét chi tiết: <span className="required">*</span></label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Nhập ý kiến chỉ đạo, hướng dẫn sửa đổi hoặc góp ý hoàn thiện..."
                value={annotationComment}
                onChange={e => setAnnotationComment(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setShowAnnotationModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={() => handleCreateAnnotation(selectedTask.id)}>
                <Icon name="check" size={13} style={{ marginRight: 6 }} /> Lưu Chú Thích
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL: PHÊ DUYỆT ĐỀ XUẤT SỬA ĐÁNH GIÁ (DÀNH CHO LÃNH ĐẠO CẤP TRÊN)
         ═══════════════════════════════════════════════════════════════ */}
      {showPendingRatingRevisionsModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 680 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="user-check" size={18} style={{ color: '#2563eb' }} /> PHÊ DUYỆT ĐỀ XUẤT SỬA ĐÁNH GIÁ ({pendingRatingRevisions.length})
            </h2>

            {pendingRatingRevisions.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                <Icon name="circle-check" size={24} style={{ color: '#16a34a', marginBottom: 8 }} />
                <div>Không có đề xuất điều chỉnh điểm nào đang chờ phê duyệt.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto', paddingRight: 4, marginBottom: 16 }}>
                {pendingRatingRevisions.map(item => (
                  <div key={item.id} style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.83rem' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', marginBottom: 4 }}>
                      {item.taskItemTitle}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        Điểm cũ: <strong>{item.oldScore !== null && item.oldScore !== undefined ? `${item.oldScore.toFixed(1)} đ` : 'Chưa chấm'}</strong> → Đề xuất mới: <strong style={{ color: '#2563eb' }}>{item.newScore.toFixed(1)} đ</strong> (Chênh: {item.scoreDelta.toFixed(1)} đ)
                      </div>
                      <span className="badge" style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fef3c7' }}>
                        Chờ cấp trên duyệt
                      </span>
                    </div>

                    <div style={{ color: '#475569', marginBottom: 4 }}>
                      <strong>Người đề xuất:</strong> {item.changedByUserName} ({new Date(item.changedAt).toLocaleString('vi-VN')})
                    </div>
                    <div style={{ color: '#334155', marginBottom: 6, lineHeight: 1.4 }}>
                      <strong>Lý do:</strong> {item.reason}
                    </div>
                    {item.evidenceUrl && (
                      <div style={{ marginBottom: 10, fontSize: '0.78rem' }}>
                        <strong>Minh chứng:</strong>{' '}
                        <a href={item.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                          <Icon name="paperclip" size={11} /> Xem tài liệu minh chứng
                        </a>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() => {
                          setRejectingRevisionHistoryId(item.id);
                          setRejectingRevisionReasonInput('');
                        }}
                      >
                        <Icon name="xmark" size={11} /> Từ Chối
                      </button>
                      <button
                        className="btn btn-success btn-xs"
                        onClick={() => handleApprovePendingRevision(item.id)}
                      >
                        <Icon name="check" size={11} /> Phê Duyệt Áp Dụng
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowPendingRatingRevisionsModal(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL: TỪ CHỐI ĐỀ XUẤT SỬA ĐÁNH GIÁ (NHẬP LÝ DO ≥ 10 KÝ TỰ)
         ═══════════════════════════════════════════════════════════════ */}
      {rejectingRevisionHistoryId && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 480 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="circle-xmark" size={16} /> Từ Chối Đề Xuất Sửa Điểm
            </h2>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Lý do từ chối (Bắt buộc tối thiểu 10 ký tự) <span className="required">*</span></span>
                <span style={{ fontSize: '0.72rem', color: rejectingRevisionReasonInput.trim().length >= 10 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {rejectingRevisionReasonInput.trim().length} / 10 ký tự
                </span>
              </label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Nhập lý do từ chối đề xuất điều chỉnh điểm số..."
                value={rejectingRevisionReasonInput}
                onChange={e => setRejectingRevisionReasonInput(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setRejectingRevisionHistoryId(null)}>Hủy</button>
              <button
                className="btn btn-danger"
                disabled={rejectingRevisionReasonInput.trim().length < 10}
                onClick={handleRejectPendingRevision}
              >
                Xác Nhận Từ Chối
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL: ĐIỀU CHUYỂN CÔNG VIỆC / TẢI VIỆC
         ═══════════════════════════════════════════════════════════════ */}
      {showTransferModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 520 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="right-left" size={18} style={{ color: '#2563eb' }} /> Điều Chuyển Công Việc & Cân Bằng Tải
            </h2>

            <div className="form-group">
              <label className="form-label">Chọn công việc cần điều chuyển <span className="required">*</span></label>
              <select
                className="form-select"
                value={transferTaskId}
                onChange={e => {
                  setTransferTaskId(e.target.value);
                  const selected = tasks.find(t => t.id === e.target.value);
                  if (selected) setTransferFromStaff(selected.assignee);
                }}
              >
                <option value="">-- Chọn công việc của {transferFromStaff || 'cán bộ'} --</option>
                {(transferFromStaff
                  ? tasks.filter(t => t.assignee === transferFromStaff || t.assignee.includes(transferFromStaff))
                  : tasks
                ).map(t => (
                  <option key={t.id} value={t.id}>
                    [{t.id.substring(0, 8)}] {t.title} — (Đang giao: {t.assignee})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Người đang thực hiện</label>
                <input type="text" className="form-input" value={transferFromStaff} disabled style={{ background: '#f1f5f9' }} />
              </div>

              <div className="form-group">
                <label className="form-label">Người nhận việc mới <span className="required">*</span></label>
                <select
                  className="form-select"
                  value={transferToStaffId}
                  onChange={e => {
                    setTransferToStaffId(e.target.value);
                    const matchedUser = dbUsers.find(u => u.id === e.target.value);
                    if (matchedUser) setTransferToStaff(matchedUser.fullName);
                  }}
                >
                  <option value="">-- Chọn người nhận việc --</option>
                  {(dbUsers.length > 0 ? dbUsers : [
                    { id: 'a0000000-0000-0000-0000-000000000001', fullName: 'Nguyễn Đình Hùng', departmentName: 'Văn phòng HĐND & UBND', roleName: 'Chủ tịch UBND xã' },
                    { id: 'a0000000-0000-0000-0000-000000000002', fullName: 'Phan Văn Hà', departmentName: 'Khối Đảng - HĐND - UBMTTQ', roleName: 'Bí thư Đảng ủy' },
                    { id: 'a0000000-0000-0000-0000-000000000003', fullName: 'Nguyễn Văn Hoàng', departmentName: 'Văn phòng HĐND & UBND', roleName: 'Phó Chủ tịch UBND' },
                    { id: 'a0000000-0000-0000-0000-000000000004', fullName: 'Lê Văn Tùng', departmentName: 'Phòng Kinh tế - Hạ tầng & Đô thị', roleName: 'Trưởng phòng' },
                    { id: 'a0000000-0000-0000-0000-000000000005', fullName: 'Trần Thị Mai', departmentName: 'Phòng Văn hóa - Xã hội', roleName: 'Trưởng phòng' },
                    { id: 'a0000000-0000-0000-0000-000000000006', fullName: 'Nguyễn Văn Nam', departmentName: 'Phòng Kinh tế - Hạ tầng & Đô thị', roleName: 'Chuyên viên Địa chính' },
                    { id: 'a0000000-0000-0000-0000-000000000007', fullName: 'Hoàng Thị Thu', departmentName: 'Văn phòng HĐND & UBND', roleName: 'Chuyên viên Văn phòng' },
                    { id: 'a0000000-0000-0000-0000-000000000008', fullName: 'Phạm Văn Đức', departmentName: 'Trung tâm Phục vụ Hành chính công', roleName: 'Chuyên viên Hành chính công' },
                  ]).filter(u => u.fullName !== transferFromStaff).map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.fullName} — {staff.departmentName || 'Phòng ban'} ({staff.roleName || 'Cán bộ'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Smart Suggestion Chip */}
            {(() => {
              const candidates = activeStaffList
                .filter(s => s.name !== transferFromStaff)
                .sort((a, b) => (a.assignedHours / a.maxHours) - (b.assignedHours / b.maxHours));
              const suggestion = candidates[0];
              if (suggestion) {
                return (
                  <div className="alert alert-info" style={{ padding: '8px 12px', fontSize: '0.8rem', marginBottom: 12 }}>
                    <Icon name="wand-magic-sparkles" size={14} style={{ color: '#2563eb', marginRight: 6 }} />
                    Đề xuất điều phối: <strong>{suggestion.name}</strong> ({suggestion.departmentName}) hiện có khối lượng công việc phù hợp nhất.
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      style={{ marginLeft: 8 }}
                      onClick={() => {
                        setTransferToStaff(suggestion.name);
                        const userMatch = dbUsers.find(u => u.fullName === suggestion.name);
                        if (userMatch) setTransferToStaffId(userMatch.id);
                      }}
                    >
                      Chọn nhanh
                    </button>
                  </div>
                );
              }
              return null;
            })()}

            <div className="form-group">
              <label className="form-label">Lý do điều chuyển công việc <span className="required">*</span></label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Nhập lý do điều chuyển (ví dụ: cán bộ quá tải, đi công tác đột xuất, phân công lại nhiệm vụ...)"
                value={transferReason}
                onChange={e => setTransferReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => setShowTransferModal(false)}>Hủy</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const targetTask = tasks.find(t => t.id === transferTaskId);
                  if (!transferTaskId || !targetTask) {
                    addToast('Thiếu thông tin', 'Vui lòng chọn công việc cần chuyển!', 'warning');
                    return;
                  }
                  if (!transferToStaffId && !transferToStaff) {
                    addToast('Thiếu thông tin', 'Vui lòng chọn người nhận việc mới!', 'warning');
                    return;
                  }

                  // 1. Tìm GUID chính xác từ dbUsers hoặc mảng mẫu GUIDs
                  const userNameGuidMap: Record<string, string> = {
                    'Nguyễn Đình Hùng': 'a0000000-0000-0000-0000-000000000001',
                    'Phan Văn Hà': 'a0000000-0000-0000-0000-000000000002',
                    'Nguyễn Văn Hoàng': 'a0000000-0000-0000-0000-000000000003',
                    'Lê Văn Tùng': 'a0000000-0000-0000-0000-000000000004',
                    'Trần Thị Mai': 'a0000000-0000-0000-0000-000000000005',
                    'Nguyễn Văn Nam': 'a0000000-0000-0000-0000-000000000006',
                    'Hoàng Thị Thu': 'a0000000-0000-0000-0000-000000000007',
                    'Phạm Văn Đức': 'a0000000-0000-0000-0000-000000000008',
                  };

                  const targetUserObj = dbUsers.find(u => u.id === transferToStaffId || u.fullName === transferToStaff);
                  const targetUserGuid = targetUserObj?.id || transferToStaffId || userNameGuidMap[transferToStaff] || 'a0000000-0000-0000-0000-000000000006';
                  const targetName = targetUserObj?.fullName || transferToStaff || 'Cán bộ xã';

                  // 2. Gọi API PostgreSQL thật
                  const res = await transferTaskApi(transferTaskId, targetUserGuid, transferReason);

                  if (res && res.success) {
                    // 3. Re-fetch tasks từ PostgreSQL API để đồng bộ UI & F5 vĩnh viễn!
                    const tasksRes = await getTasksApi();
                    if (tasksRes.success && tasksRes.data && tasksRes.data.items && tasksRes.data.items.length > 0) {
                      const mapped: Task[] = tasksRes.data.items.map(t => ({
                        id: t.id,
                        title: t.title,
                        description: t.description,
                        assignedBy: t.assignerName || 'Lãnh đạo xã',
                        assignedByRole: 'Lãnh đạo xã',
                        assignee: t.assigneeName || 'Cán bộ xã',
                        assigneeRole: 'Cán bộ xã',
                        collaborators: [],
                        priority: (t.priority === 'Urgent' ? 'Khan' : t.priority === 'High' ? 'Cao' : t.priority === 'Low' ? 'Thuong' : 'Trung_Binh') as TaskPriority,
                        status: (t.status === 'Completed' ? 'Hoan_Thanh' : t.status === 'InReview' ? 'Cho_Duyet' : t.status === 'Cancelled' ? 'Tu_Choi' : t.status === 'InProgress' ? 'Dang_Xu_Ly' : 'Chua_Lam') as TaskStatus,
                        category: (t.type === 'AdHoc' ? 'Dot_Xuat' : 'BAU') as TaskCategory,
                        dueDate: t.dueDate ? t.dueDate.split('T')[0] : '2026-08-10',
                        shift: 'Sang' as const,
                        startTime: '08:00',
                        createdDate: t.createdAt ? t.createdAt.split('T')[0] : '2026-08-01',
                        progress: t.status === 'Completed' ? 100 : t.status === 'InReview' ? 90 : t.status === 'InProgress' ? 50 : 0,
                        effortHours: t.estimatedEffortHours || 8,
                        attachments: [],
                        comments: [],
                        statusHistory: [],
                        rating: t.ratingScore,
                        rejectionReason: t.rejectionReason,
                        context: 'ChuTichUBND' as const
                      }));
                      setTasks(mapped);
                    }

                    // 4. Re-fetch Báo cáo GRAD
                    getGRADReportApi().then(r => {
                      if (r.success && r.data) {
                        setGradOfficers(r.data.officers);
                        setGradDepartments(r.data.departments);
                        setCommuneAvgScore(r.data.overallCommuneAverageScore);
                      }
                    });

                    // 5. Lưu lịch sử local
                    const record = createTransferRecord(
                      transferTaskId,
                      transferFromStaff,
                      targetName,
                      ROLE_CONFIG[activeRole].label === 'Chủ tịch UBND xã' ? 'Nguyễn Đình Hùng' : ROLE_CONFIG[activeRole].label,
                      ROLE_CONFIG[activeRole].label,
                      transferReason
                    );
                    setTransferHistory(prev => [record, ...prev]);

                    addToast('Điều chuyển thành công', `Đã điều chuyển công việc "${targetTask.title}" từ ${transferFromStaff} sang ${targetName}`, 'success');
                    setShowTransferModal(false);
                    setTransferReason('');
                    setTransferToStaffId('');
                    setTransferToStaff('');
                  } else {
                    addToast('Lỗi điều chuyển', res?.message || 'Không thể điều chuyển nhiệm vụ', 'danger');
                  }
                }}
              >
                <Icon name="check" size={14} /> Xác Nhận Điều Chuyển
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL: XẾP LỊCH TỪ HÒM THƯ / THỦ CÔNG
         ═══════════════════════════════════════════════════════════════ */}
      {showScheduleModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 500 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="calendar-plus" size={18} style={{ color: '#2563eb' }} /> Xếp Lịch Công Tác Mới
            </h2>

            {scheduleSourceMail && (
              <div className="alert alert-info" style={{ padding: '8px 12px', fontSize: '0.82rem', marginBottom: 14 }}>
                <Icon name="link" size={14} style={{ marginRight: 6 }} />
                Liên kết văn bản: <strong>{scheduleSourceMail.subject}</strong>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Tiêu đề lịch công tác <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="VD: Họp giao ban Thường trực xã..."
                value={scheduleTitle}
                onChange={e => setScheduleTitle(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nội dung chi tiết / Chỉ đạo</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Mô tả nội dung công việc xếp lịch..."
                value={scheduleDescription}
                onChange={e => setScheduleDescription(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Ngày thực hiện <span className="required">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ca làm việc <span className="required">*</span></label>
                <select
                  className="form-select"
                  value={scheduleShift}
                  onChange={e => setScheduleShift(e.target.value as 'Sang' | 'Chieu')}
                >
                  <option value="Sang">Buổi Sáng (07:00 - 11:30)</option>
                  <option value="Chieu">Buổi Chiều (13:00 - 17:00)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Giờ bắt đầu</label>
                <input
                  type="time"
                  className="form-input"
                  value={scheduleStartTime}
                  onChange={e => setScheduleStartTime(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => { setShowScheduleModal(false); setScheduleSourceMail(null); }}>Hủy</button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  if (!scheduleTitle.trim()) {
                    addToast('Thiếu thông tin', 'Vui lòng nhập tiêu đề lịch công tác!', 'warning');
                    return;
                  }

                  const newTask: Task = {
                    id: `TSK-SCH-${Date.now()}`,
                    title: scheduleTitle,
                    description: scheduleDescription || (scheduleSourceMail ? `Xếp lịch từ công văn: ${scheduleSourceMail.subject}` : 'Lịch công tác thủ công'),
                    assignedBy: ROLE_CONFIG[activeRole].label,
                    assignedByRole: ROLE_CONFIG[activeRole].label,
                    assignee: 'Nguyễn Đình Hùng',
                    assigneeRole: roleInfo.label,
                    collaborators: [],
                    priority: scheduleSourceMail?.isUrgent ? 'Khan' : 'Trung_Binh',
                    status: 'Chua_Lam',
                    category: 'BAU',
                    dueDate: scheduleDate,
                    shift: scheduleShift,
                    startTime: scheduleStartTime,
                    createdDate: new Date().toISOString().split('T')[0],
                    progress: 0,
                    effortHours: 4,
                    attachments: [],
                    comments: [],
                    statusHistory: [],
                    context: activeRole,
                    sourceInboxId: scheduleSourceMail?.id,
                  };

                  if (scheduleSourceMail) {
                    await scheduleInboxDocumentApi(scheduleSourceMail.id, scheduleDate, scheduleShift);
                    setInboxItems(prev => prev.map(m => m.id === scheduleSourceMail.id ? { ...m, folder: 'scheduled', status: 'scheduled' } : m));
                  }

                  setTasks(prev => [newTask, ...prev]);

                  addToast('Xếp lịch thành công', `Đã thêm lịch công tác "${scheduleTitle}" vào ca ${SHIFT_CONFIG[scheduleShift].label} ngày ${scheduleDate}`, 'success');
                  setShowScheduleModal(false);
                  setScheduleTitle('');
                  setScheduleDescription('');
                  setScheduleSourceMail(null);
                  setActiveModule('workcenter');
                  setWorkcenterTab('week');
                  setSelectedTaskId(newTask.id);
                }}
              >
                <Icon name="calendar-check" size={14} /> Lưu Lịch Công Tác
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL: TÙY BIẾN NHẮC VIỆC TRONG LỊCH CÔNG TÁC TUẦN
         ═══════════════════════════════════════════════════════════════ */}
      {showReminderModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 460 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="bell" size={18} style={{ color: '#d97706' }} /> Cấu Hình Nhắc Việc Tự Động
            </h2>

            <div className="form-group">
              <label className="form-label">Thời điểm nhắc trước <span className="required">*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  value={reminderAmount}
                  onChange={e => setReminderAmount(parseInt(e.target.value) || 15)}
                />
                <select
                  className="form-select"
                  value={reminderUnit}
                  onChange={e => setReminderUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                >
                  <option value="minutes">Phút</option>
                  <option value="hours">Giờ</option>
                  <option value="days">Ngày</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Tần suất nhắc nhở</label>
              <select
                className="form-select"
                value={reminderFrequency}
                onChange={e => setReminderFrequency(e.target.value as 'once' | 'repeat')}
              >
                <option value="once">🔔 Một lần đúng thời điểm</option>
                <option value="repeat">🔄 Lặp lại hằng ngày cho tới hạn chót</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Nội dung ghi chú nhắc nhở</label>
              <input
                type="text"
                className="form-input"
                placeholder="Mô tả nhắc nhở (VD: Đôn đốc nộp báo cáo trước 17h...)"
                value={reminderMessage}
                onChange={e => setReminderMessage(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => setShowReminderModal(false)}>Hủy</button>
              <button
                className="btn btn-warning"
                onClick={() => {
                  const reminder = createReminder(
                    reminderTargetId,
                    reminderAmount,
                    reminderUnit,
                    reminderFrequency,
                    reminderMessage || 'Nhắc việc hệ thống'
                  );

                  addToast('Đã cài nhắc việc', formatReminderLabel(reminder), 'warning');
                  setShowReminderModal(false);
                  setReminderMessage('');
                }}
              >
                <Icon name="bell" size={14} /> Lưu Nhắc Việc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL: SOẠN THẢO / CHỈNH SỬA VĂN BẢN ĐI
         ═══════════════════════════════════════════════════════════════ */}
      {showCreateOutgoingModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 760, width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="pen-to-square" size={18} style={{ color: '#2563eb' }} />
                {editingOutgoingDoc ? 'Chỉnh Sửa Bản Nháp Văn Bản Đi' : (formDocIsCorrection ? 'Soạn Văn Bản Đính Chính' : 'Soạn Văn Bản Đi Mới')}
              </h2>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowCreateOutgoingModal(false)}>
                <Icon name="xmark" size={16} />
              </button>
            </div>

            {/* ── Tabs Luồng gửi (Cấp trên vs Cấp dưới) ── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                className={`btn btn-sm ${formDestinationLevel === 'Superior' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}
                onClick={() => setFormDestinationLevel('Superior')}
              >
                <Icon name="paper-plane" size={13} /> 📤 Gửi Cấp Trên (Báo cáo / Tờ trình)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${formDestinationLevel === 'Subordinate' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}
                onClick={() => setFormDestinationLevel('Subordinate')}
              >
                <Icon name="sitemap" size={13} /> 📥 Gửi Cấp Dưới (Giao việc / Chỉ đạo)
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '68vh', overflowY: 'auto', paddingRight: 4 }}>
              {formDocIsCorrection && (
                <div className="alert alert-warning" style={{ margin: 0, fontSize: '0.85rem' }}>
                  <Icon name="triangle-exclamation" size={14} /> <strong>Văn bản đính chính:</strong> Đang khởi tạo văn bản đính chính cho văn bản gốc đã ban hành.
                </div>
              )}

              {/* Thông tin Cấp trên vs Cấp dưới notification */}
              {formDestinationLevel === 'Subordinate' ? (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '8px 12px', fontSize: '0.83rem', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span><Icon name="info-circle" size={13} /> Văn bản gửi cấp dưới hoặc ban ngành sẽ <strong>tự động tạo nhiệm vụ theo dõi trên Hệ thống Điều hành</strong>.</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={formAutoCreateTask}
                      onChange={(e) => setFormAutoCreateTask(e.target.checked)}
                    />
                    <span>Tự động giao việc</span>
                  </label>
                </div>
              ) : (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: '0.83rem', color: '#475569' }}>
                  <Icon name="building-columns" size={13} /> Văn bản gửi Cấp trên / Huyện / Tỉnh phục vụ báo cáo tiến độ, xin ý kiến chỉ đạo hoặc trình phê duyệt kinh phí.
                </div>
              )}

              {/* Grid Metadata 1: Loại VB, Ký hiệu, Nơi nhận */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Loại văn bản <span style={{ color: '#dc2626' }}>*</span></label>
                  <select
                    className="form-select"
                    style={{ fontSize: '0.85rem' }}
                    value={formDocType}
                    onChange={(e) => setFormDocType(e.target.value as DocumentTypeEnum)}
                  >
                    <option value="CongVan">Công văn (CV)</option>
                    <option value="QuyetDinh">Quyết định (QĐ)</option>
                    <option value="ThongBao">Thông báo (TB)</option>
                    <option value="BaoCao">Báo cáo (BC)</option>
                    <option value="KeHoach">Kế hoạch (KH)</option>
                    <option value="ToTrinh">Tờ trình (TTr)</option>
                    <option value="CongDien">Công điện (CĐ)</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Ký hiệu cơ quan</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontSize: '0.85rem' }}
                    placeholder="VD: UBND-VP, UBND-KT..."
                    value={formDocumentSymbol}
                    onChange={(e) => setFormDocumentSymbol(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Nơi nhận / Đơn vị nhận</label>
                  {formDestinationLevel === 'Superior' ? (
                    <select
                      className="form-select"
                      style={{ fontSize: '0.85rem' }}
                      value={formDocRecipient}
                      onChange={(e) => setFormDocRecipient(e.target.value)}
                    >
                      <option value="">-- Chọn đơn vị cấp trên --</option>
                      <option value="UBND Huyện Đức Thọ">UBND Huyện Đức Thọ</option>
                      <option value="Sở Nông Nghiệp & PTNT Tỉnh">Sở Nông Nghiệp & PTNT Tỉnh</option>
                      <option value="Sở Tài Chính Tỉnh">Sở Tài Chính Tỉnh</option>
                      <option value="UBND Tỉnh Hà Tĩnh">UBND Tỉnh Hà Tĩnh</option>
                      <option value="HĐND Huyện">HĐND Huyện</option>
                    </select>
                  ) : (
                    <select
                      className="form-select"
                      style={{ fontSize: '0.85rem' }}
                      value={formDocRecipient}
                      onChange={(e) => setFormDocRecipient(e.target.value)}
                    >
                      <option value="">-- Chọn đơn vị/phòng ban --</option>
                      <option value="Phòng Địa Chính - Môi Trường">Phòng Địa Chính - Môi Trường</option>
                      <option value="Phòng Văn Hóa - Xã Hội">Phòng Văn Hóa - Xã Hội</option>
                      <option value="Ban Cán Bộ Thôn Cát Ngạn">Ban Cán Bộ Thôn Cát Ngạn</option>
                      <option value="Công An Xã Cát Ngạn">Công An Xã Cát Ngạn</option>
                      <option value="Trung Tâm PHCC Xã">Trung Tâm PHCC Xã</option>
                      <option value="Toàn bộ các phòng ban">Toàn bộ các phòng ban & Thôn xóm</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Grid Metadata 2: Độ khẩn, Độ mật, Hạn phản hồi */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Độ khẩn</label>
                  <select
                    className="form-select"
                    style={{ fontSize: '0.85rem' }}
                    value={formUrgencyLevel}
                    onChange={(e) => {
                      setFormUrgencyLevel(e.target.value);
                      setFormDocIsUrgent(e.target.value !== 'Normal');
                    }}
                  >
                    <option value="Normal">Thường</option>
                    <option value="Urgent">Khẩn</option>
                    <option value="VeryUrgent">Thượng khẩn</option>
                    <option value="Express">Hỏa tốc</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Độ mật</label>
                  <select
                    className="form-select"
                    style={{ fontSize: '0.85rem' }}
                    value={formSecurityLevel}
                    onChange={(e) => setFormSecurityLevel(e.target.value)}
                  >
                    <option value="Normal">Thường</option>
                    <option value="Confidential">Mật</option>
                    <option value="Secret">Tối mật</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Hạn xử lý / Phản hồi</label>
                  <input
                    type="date"
                    className="form-control"
                    style={{ fontSize: '0.85rem' }}
                    value={formResponseDeadline}
                    onChange={(e) => setFormResponseDeadline(e.target.value)}
                  />
                </div>
              </div>

              {/* Trích yếu nội dung */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem' }}>Trích yếu nội dung <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nhập trích yếu ngắn gọn khái quát nội dung văn bản đi..."
                  value={formDocTitle}
                  onChange={(e) => setFormDocTitle(e.target.value)}
                  style={{ fontSize: '0.9rem', fontWeight: 600 }}
                />
              </div>

              {/* Nội dung chi tiết */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.82rem' }}>Nội dung văn bản chi tiết</label>
                <textarea
                  className="form-control"
                  rows={5}
                  placeholder="Nhập đầy đủ thông tin nội dung văn bản đi..."
                  value={formDocContent}
                  onChange={(e) => setFormDocContent(e.target.value)}
                  style={{ fontFamily: 'inherit', fontSize: '0.88rem', lineHeight: 1.5 }}
                />
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              <div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: '#2563eb', color: '#2563eb', fontWeight: 700 }}
                  onClick={() => {
                    if (!formDocTitle.trim()) {
                      addToast('Thiếu thông tin', 'Vui lòng nhập Trích yếu nội dung trước khi xem file!', 'warning');
                      return;
                    }
                    setViewerMail({
                      id: editingOutgoingDoc?.id || 'preview_doc',
                      senderName: 'UBND Xã Cát Ngạn',
                      senderOrg: 'UBND Xã Cát Ngạn',
                      documentNumber: editingOutgoingDoc?.documentNumber || 'DỰ THẢO',
                      documentSymbol: formDocumentSymbol || 'UBND-VP',
                      subject: formDocTitle,
                      content: formDocContent || formDocTitle,
                      category: formDocType,
                      date: new Date().toISOString().split('T')[0],
                      status: 'read',
                      folder: 'inbox',
                      isStarred: false,
                      isUrgent: formDocIsUrgent,
                      attachments: [{ name: `Document_${formDocType}.pdf`, url: editingOutgoingDoc?.attachmentUrl, size: '1.2 MB', type: 'pdf' }]
                    });
                    setShowViewerModal(true);
                  }}
                >
                  <Icon name="eye" size={13} /> 👁 Xem trước file PDF ban hành
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCreateOutgoingModal(false)}>Hủy</button>

                {editingOutgoingDoc && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: '#dc2626' }}
                    onClick={async () => {
                      if (confirm(`Bạn có chắc chắn muốn xóa bản nháp: "${editingOutgoingDoc.title}"?`)) {
                        const res = await cancelOutgoingDocumentApi(editingOutgoingDoc.id, 'Xóa bản nháp');
                        if (res.success) {
                          addToast('Đã xóa', 'Bản nháp đã được xóa thành công.', 'success');
                          setShowCreateOutgoingModal(false);
                          fetchOutgoingDocs();
                        } else {
                          addToast('Lỗi', res.error || 'Không thể xóa bản nháp.', 'danger');
                        }
                      }
                    }}
                  >
                    <Icon name="trash" size={13} /> Xóa Nháp
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    if (!formDocTitle.trim()) {
                      addToast('Thiếu thông tin', 'Vui lòng nhập Trích yếu nội dung văn bản!', 'warning');
                      return;
                    }

                    if (editingOutgoingDoc) {
                      const res = await updateOutgoingDocumentApi(editingOutgoingDoc.id, {
                        documentType: formDocType,
                        title: formDocTitle.trim(),
                        content: formDocContent,
                        recipientNote: formDocRecipient,
                        isUrgent: formDocIsUrgent,
                        relatedTaskItemId: formDocRelatedTaskId || undefined,
                        destinationLevel: formDestinationLevel,
                        autoCreateTask: formAutoCreateTask,
                        securityLevel: formSecurityLevel,
                        urgencyLevel: formUrgencyLevel,
                        responseDeadline: formResponseDeadline ? new Date(formResponseDeadline).toISOString() : undefined,
                      });
                      if (res.success) {
                        addToast('Thành công', 'Đã cập nhật bản nháp văn bản đi!', 'success');
                        setShowCreateOutgoingModal(false);
                        fetchOutgoingDocs();
                      } else {
                        addToast('Lỗi', res.error || 'Không thể cập nhật văn bản nháp.', 'danger');
                      }
                    } else {
                      const res = await createOutgoingDocumentApi({
                        documentType: formDocType,
                        title: formDocTitle.trim(),
                        content: formDocContent,
                        recipientNote: formDocRecipient,
                        isUrgent: formDocIsUrgent,
                        relatedTaskItemId: formDocRelatedTaskId || undefined,
                        isCorrectionDocument: formDocIsCorrection,
                        originalDocumentId: formDocOriginalId || undefined,
                        destinationLevel: formDestinationLevel,
                        autoCreateTask: formAutoCreateTask,
                        securityLevel: formSecurityLevel,
                        urgencyLevel: formUrgencyLevel,
                        responseDeadline: formResponseDeadline ? new Date(formResponseDeadline).toISOString() : undefined,
                      });
                      if (res.success) {
                        addToast('Thành công', 'Đã lưu bản nháp văn bản đi!', 'success');
                        setShowCreateOutgoingModal(false);
                        fetchOutgoingDocs();
                      } else {
                        addToast('Lỗi', res.error || 'Không thể tạo bản nháp văn bản.', 'danger');
                      }
                    }
                  }}
                >
                  <Icon name="floppy-disk" size={13} /> Lưu Nháp
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    if (!formDocTitle.trim()) {
                      addToast('Thiếu thông tin', 'Vui lòng nhập Trích yếu nội dung văn bản!', 'warning');
                      return;
                    }

                    let targetDocId = editingOutgoingDoc?.id;
                    if (editingOutgoingDoc) {
                      await updateOutgoingDocumentApi(editingOutgoingDoc.id, {
                        documentType: formDocType,
                        title: formDocTitle.trim(),
                        content: formDocContent,
                        recipientNote: formDocRecipient,
                        isUrgent: formDocIsUrgent,
                        relatedTaskItemId: formDocRelatedTaskId || undefined,
                        destinationLevel: formDestinationLevel,
                        autoCreateTask: formAutoCreateTask,
                        securityLevel: formSecurityLevel,
                        urgencyLevel: formUrgencyLevel,
                        responseDeadline: formResponseDeadline ? new Date(formResponseDeadline).toISOString() : undefined,
                      });
                    } else {
                      const createRes = await createOutgoingDocumentApi({
                        documentType: formDocType,
                        title: formDocTitle.trim(),
                        content: formDocContent,
                        recipientNote: formDocRecipient,
                        isUrgent: formDocIsUrgent,
                        relatedTaskItemId: formDocRelatedTaskId || undefined,
                        isCorrectionDocument: formDocIsCorrection,
                        originalDocumentId: formDocOriginalId || undefined,
                        destinationLevel: formDestinationLevel,
                        autoCreateTask: formAutoCreateTask,
                        securityLevel: formSecurityLevel,
                        urgencyLevel: formUrgencyLevel,
                        responseDeadline: formResponseDeadline ? new Date(formResponseDeadline).toISOString() : undefined,
                      });
                      if (createRes.success && createRes.data) {
                        targetDocId = createRes.data;
                      }
                    }

                    if (targetDocId) {
                      const submitRes = await submitOutgoingDocumentForSignatureApi(targetDocId);
                      if (submitRes.success) {
                        addToast('Trình ký thành công', 'Văn bản đã được chuyển tới Lãnh đạo phê duyệt & ký ban hành!', 'success');
                        setShowCreateOutgoingModal(false);
                        fetchOutgoingDocs();
                      } else {
                        addToast('Lỗi', submitRes.error || 'Không thể trình ký văn bản.', 'danger');
                      }
                    }
                  }}
                >
                  <Icon name="paper-plane" size={13} /> Lưu & Trình Ký Duyệt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL: CHI TIẾT VĂN BẢN ĐI & KÝ DUYỆT / BAN HÀNH
         ═══════════════════════════════════════════════════════════════ */}
      {showDetailOutgoingModal && selectedOutgoingDoc && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 700 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: 14, marginBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span className="badge" style={{ background: '#f0f9ff', color: '#0284c7', fontWeight: 700 }}>
                    {selectedOutgoingDoc.documentTypeName}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: selectedOutgoingDoc.documentNumber ? '#15803d' : '#94a3b8' }}>
                    SỐ HIỆU: {selectedOutgoingDoc.documentNumber || 'CHƯA CẤP SỐ (BẢN NHÁP/TRÌNH KÝ)'}
                  </span>
                  {selectedOutgoingDoc.isUrgent && <span className="badge badge-urgent">KHẨN</span>}
                </div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#0f172a', lineHeight: 1.35 }}>
                  {selectedOutgoingDoc.title}
                </h2>
              </div>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowDetailOutgoingModal(false)}>
                <Icon name="xmark" size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Alert status notes */}
              {selectedOutgoingDoc.status === 'Issued' && (
                <div className="alert alert-success" style={{ margin: 0, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="check-double" size={16} style={{ color: '#16a34a' }} />
                  <div>
                    <strong>Văn bản đã ban hành chính thức!</strong> Số hiệu <strong>{selectedOutgoingDoc.documentNumber}</strong>. Văn bản đã ký là bất biến (không thể chỉnh sửa trực tiếp).
                  </div>
                </div>
              )}

              {selectedOutgoingDoc.status === 'Rejected' && (
                <div className="alert alert-danger" style={{ margin: 0, fontSize: '0.85rem' }}>
                  <Icon name="triangle-exclamation" size={16} /> <strong>Lý do từ chối ký:</strong> {selectedOutgoingDoc.rejectionReason || 'Cần chỉnh sửa bổ sung nội dung.'}
                </div>
              )}

              {/* Document Meta Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#f8fafc', padding: 14, borderRadius: 8, fontSize: '0.85rem' }}>
                <div>Người soạn nháp: <strong>{selectedOutgoingDoc.draftedByUserName}</strong></div>
                <div>Thời gian soạn: <strong>{selectedOutgoingDoc.draftedAt ? new Date(selectedOutgoingDoc.draftedAt).toLocaleString('vi-VN') : '—'}</strong></div>
                <div>Nơi nhận văn bản: <strong>{selectedOutgoingDoc.recipientNote || 'Các phòng ban / Công dân'}</strong></div>
                <div>Người ký duyệt: <strong>{selectedOutgoingDoc.signedByUserName || 'Chờ Lãnh đạo ký'}</strong></div>
              </div>

              {/* Document Content View */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>NỘI DUNG VĂN BẢN GỬI ĐỊ:</label>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, minHeight: 140, whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.6, color: '#1e293b' }}>
                  {selectedOutgoingDoc.content || '(Chưa nhập nội dung văn bản chi tiết)'}
                </div>
              </div>

              {/* Rejection input area */}
              {showRejectInput && (
                <div style={{ background: '#fef2f2', padding: 12, borderRadius: 8, border: '1px solid #fecaca' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#dc2626', marginBottom: 4, display: 'block' }}>NHẬP LÝ DO TỪ CHỐI PHÊ DUYỆT <span style={{ color: '#dc2626' }}>*</span></label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Vui lòng nêu rõ lý do từ chối để cán bộ soạn nháp chỉnh sửa lại..."
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    style={{ fontSize: '0.88rem' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowRejectInput(false)}>Hủy</button>
                    <button
                      type="button"
                      className="btn btn-danger btn-xs"
                      onClick={async () => {
                        if (!rejectionReasonInput.trim()) {
                          addToast('Thiếu lý do', 'Vui lòng nhập lý do từ chối phê duyệt!', 'warning');
                          return;
                        }
                        const res = await rejectOutgoingDocumentApi(selectedOutgoingDoc.id, rejectionReasonInput.trim());
                        if (res.success) {
                          addToast('Đã từ chối', 'Đã trả về bản nháp cho người soạn chỉnh sửa.', 'info');
                          setShowDetailOutgoingModal(false);
                          fetchOutgoingDocs();
                        } else {
                          addToast('Lỗi', res.error || 'Không thể thực hiện từ chối.', 'danger');
                        }
                      }}
                    >
                      Xác Nhận Từ Chối
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 14, borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: 10 }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowDetailOutgoingModal(false)}>Đóng</button>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* 1. LÃNH ĐẠO KÝ & BAN HÀNH / TỪ CHỐI (KHI DANG PENDING SIGNATURE & RANKLEVEL <= 2.5) */}
                {selectedOutgoingDoc.status === 'PendingSignature' && ROLE_CONFIG[activeRole]?.scopeLevel <= 2.5 && (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline btn-danger"
                      onClick={() => setShowRejectInput(true)}
                    >
                      <Icon name="xmark" size={14} /> Từ Chối Duyệt
                    </button>

                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={async () => {
                        const res = await signAndIssueOutgoingDocumentApi(selectedOutgoingDoc.id);
                        if (res.success && res.data) {
                          addToast('Ký & Ban Hành Thành Công!', `Văn bản đã được cấp số hiệu tự động: ${res.data.documentNumber}`, 'success');
                          setShowDetailOutgoingModal(false);
                          fetchOutgoingDocs();
                        } else {
                          addToast('Lỗi Ký Văn Bản', res.error || 'Không thể ký ban hành văn bản.', 'danger');
                        }
                      }}
                      style={{ fontWeight: 700 }}
                    >
                      <Icon name="signature" size={14} /> Ký & Ban Hành
                    </button>
                  </>
                )}

                {/* 2. THU HỒI VỀ NHÁP (KHI DANG PENDING SIGNATURE) */}
                {selectedOutgoingDoc.status === 'PendingSignature' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={async () => {
                      const res = await revokeOutgoingDocumentApi(selectedOutgoingDoc.id);
                      if (res.success) {
                        addToast('Đã thu hồi', 'Văn bản đã được thu hồi về bản nháp.', 'info');
                        setShowDetailOutgoingModal(false);
                        fetchOutgoingDocs();
                      } else {
                        addToast('Lỗi', res.error || 'Không thể thu hồi văn bản.', 'danger');
                      }
                    }}
                  >
                    <Icon name="rotate-left" size={14} /> Thu Hồi Về Nháp
                  </button>
                )}

                {/* 3. TRÌNH KÝ / SỬA (KHI DANG DRAFT HOẶC REJECTED) */}
                {(selectedOutgoingDoc.status === 'Draft' || selectedOutgoingDoc.status === 'Rejected') && (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => {
                        setShowDetailOutgoingModal(false);
                        setEditingOutgoingDoc(selectedOutgoingDoc);
                        setFormDocType(selectedOutgoingDoc.documentType);
                        setFormDocTitle(selectedOutgoingDoc.title);
                        setFormDocContent(selectedOutgoingDoc.content);
                        setFormDocRecipient(selectedOutgoingDoc.recipientNote || '');
                        setFormDocIsUrgent(selectedOutgoingDoc.isUrgent);
                        setFormDocRelatedTaskId(selectedOutgoingDoc.relatedTaskItemId || '');
                        setFormDocIsCorrection(selectedOutgoingDoc.isCorrectionDocument);
                        setFormDocOriginalId(selectedOutgoingDoc.originalDocumentId || '');
                        setShowCreateOutgoingModal(true);
                      }}
                    >
                      <Icon name="pen-to-square" size={14} /> Sửa Bản Nháp
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        const res = await submitOutgoingDocumentForSignatureApi(selectedOutgoingDoc.id);
                        if (res.success) {
                          addToast('Trình ký thành công', 'Văn bản đã chuyển tới Lãnh đạo duyệt ký.', 'success');
                          setShowDetailOutgoingModal(false);
                          fetchOutgoingDocs();
                        } else {
                          addToast('Lỗi', res.error || 'Không thể trình ký.', 'danger');
                        }
                      }}
                    >
                      <Icon name="paper-plane" size={14} /> Trình Ký Duyệt
                    </button>
                  </>
                )}

                {/* 4. TẠO VĂN BẢN ĐÍNH CHÍNH (KHI ĐÃ ISSUED) */}
                {selectedOutgoingDoc.status === 'Issued' && (
                  <button
                    type="button"
                    className="btn btn-outline btn-warning"
                    onClick={() => {
                      setShowDetailOutgoingModal(false);
                      setEditingOutgoingDoc(null);
                      setFormDocType('CongVan');
                      setFormDocTitle(`Công văn đính chính văn bản số ${selectedOutgoingDoc.documentNumber}`);
                      setFormDocContent(`Kính gửi: ${selectedOutgoingDoc.recipientNote || 'Các đơn vị liên quan'}\n\nNội dung đính chính cho văn bản số ${selectedOutgoingDoc.documentNumber} (${selectedOutgoingDoc.title}):\n\n- `);
                      setFormDocRecipient(selectedOutgoingDoc.recipientNote || '');
                      setFormDocIsUrgent(false);
                      setFormDocRelatedTaskId(selectedOutgoingDoc.relatedTaskItemId || '');
                      setFormDocIsCorrection(true);
                      setFormDocOriginalId(selectedOutgoingDoc.id);
                      setShowCreateOutgoingModal(true);
                    }}
                  >
                    <Icon name="file-pen" size={14} /> Tạo Văn Bản Đính Chính
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL: PHÊ DUYỆT SỬA ĐIỂM DÀNH CHO LÃNH ĐẠO CẤP TRÊN (MAKER-CHECKER)
         ═══════════════════════════════════════════════════════════════ */}
      {showPendingRatingRevisionsModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="clock-rotate-left" size={18} style={{ color: '#d97706' }} />
                Danh Sách Đề Xuất Sửa Điểm Chờ Duyệt ({pendingRatingRevisions.length})
              </h2>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowPendingRatingRevisionsModal(false)}>
                <Icon name="xmark" size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 480, overflowY: 'auto' }}>
              {pendingRatingRevisions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  <Icon name="circle-check" size={36} style={{ color: '#16a34a', marginBottom: 10 }} />
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>Hiện tại không có đề xuất sửa điểm nào đang chờ phê duyệt.</p>
                </div>
              ) : (
                pendingRatingRevisions.map((item) => (
                  <div key={item.id} style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.88rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{item.taskItemTitle}</div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                          Người đề xuất: <strong>{item.changedByUserName}</strong> ({item.changedByUserRoleName}) • Lúc {new Date(item.changedAt).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <span className="badge" style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fef3c7', fontWeight: 700 }}>
                        Chênh {item.scoreDelta.toFixed(1)} điểm
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#ffffff', padding: 10, borderRadius: 6, border: '1px solid #f1f5f9', marginBottom: 10 }}>
                      <div>Điểm hiện tại: <strong style={{ color: '#64748b' }}>{item.oldScore !== null && item.oldScore !== undefined ? `${(item.oldScore > 10 ? item.oldScore / 10 : item.oldScore).toFixed(1)} / 10` : 'Chưa chấm'}</strong></div>
                      <div>Điểm đề xuất mới: <strong style={{ color: '#2563eb', fontSize: '1rem' }}>{(item.newScore > 10 ? item.newScore / 10 : item.newScore).toFixed(1)} / 10</strong></div>
                    </div>

                    <div style={{ fontSize: '0.82rem', color: '#334155', marginBottom: 6 }}>
                      <strong>Lý do giải trình:</strong> {item.reason}
                    </div>

                    {item.evidenceUrl && (
                      <div style={{
                        marginTop: 8,
                        marginBottom: 12,
                        padding: '8px 12px',
                        background: '#f1f5f9',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        fontSize: '0.8rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <Icon name={item.evidenceUrl.startsWith('data:image/') ? 'image' : 'file-lines'} size={13} style={{ color: '#2563eb', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: '#334155' }}>Tài liệu / Hình ảnh minh chứng đính kèm</span>
                        </div>
                        <a
                          href={item.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-primary"
                          style={{ padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}
                        >
                          <Icon name="eye" size={11} /> Mở xem minh chứng
                        </a>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-danger btn-sm"
                        onClick={async () => {
                          const reason = prompt('Nhập lý do từ chối đề xuất này:');
                          if (reason !== null) {
                            const res = await rejectRatingRevisionApi(item.id, reason);
                            if (res.success) {
                              addToast('Đã Từ Chối', 'Đã từ chối đề xuất sửa điểm.', 'info');
                              fetchPendingRatingRevisions();
                            } else {
                              addToast('Lỗi', res.error || 'Không thể từ chối đề xuất.', 'danger');
                            }
                          }
                        }}
                      >
                        <Icon name="xmark" size={12} /> Từ Chối
                      </button>

                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={async () => {
                          const res = await approveRatingRevisionApi(item.id);
                          if (res.success) {
                            addToast('Phê Duyệt Thành Công!', `Đã duyệt điểm số mới ${item.newScore.toFixed(1)} điểm cho công việc.`, 'success');
                            setTasks(prev => prev.map(t => t.id === item.taskItemId ? { ...t, rating: item.newScore } : t));
                            fetchPendingRatingRevisions();
                          } else {
                            addToast('Lỗi', res.error || 'Không thể phê duyệt đề xuất.', 'danger');
                          }
                        }}
                        style={{ fontWeight: 700 }}
                      >
                        <Icon name="check" size={12} /> Phê Duyệt Sửa Điểm
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowPendingRatingRevisionsModal(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL CÀI ĐẶT THÔNG BÁO ĐẨY (WEB PUSH NOTIFICATIONS)
         ═══════════════════════════════════════════════════════════════ */}
      {showPushSettingsModal && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-card" style={{ maxWidth: 720, width: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', color: '#ffffff', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="bell" size={18} style={{ color: '#ffffff' }} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ color: '#ffffff', margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                    Cài Đặt Nhận Thông Báo Trực Tiếp Trên Thiết Bị
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#bfdbfe', marginTop: 2 }}>
                    Nhận nhắc việc & tóm tắt nhiệm vụ mỗi ngày trực tiếp trên điện thoại và máy tính
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPushSettingsModal(false)}
                style={{ color: '#ffffff', padding: 6 }}
                aria-label="Đóng cài đặt thông báo"
              >
                <Icon name="xmark" size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Status Message Alert */}
              {pushStatusMessage && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: pushStatusMessage.type === 'success' ? '#f0fdf4' : pushStatusMessage.type === 'error' ? '#fef2f2' : '#eff6ff',
                  border: `1px solid ${pushStatusMessage.type === 'success' ? '#bbf7d0' : pushStatusMessage.type === 'error' ? '#fecaca' : '#bfdbfe'}`,
                  color: pushStatusMessage.type === 'success' ? '#166534' : pushStatusMessage.type === 'error' ? '#991b1b' : '#1e40af'
                }}>
                  <Icon
                    name={pushStatusMessage.type === 'success' ? 'circle-check' : pushStatusMessage.type === 'error' ? 'circle-xmark' : 'circle-info'}
                    size={16}
                  />
                  <span>{pushStatusMessage.text}</span>
                </div>
              )}

              {/* CARD 1: THIẾT BỊ HIỆN TẠI */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      background: isPushSubscribed ? '#dcfce7' : '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Icon
                        name="laptop"
                        size={18}
                        style={{ color: isPushSubscribed ? '#16a34a' : '#64748b' }}
                      />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>Thiết Bị Này</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 1 }}>
                        {getAutoDeviceLabel()}
                      </div>
                    </div>
                  </div>

                  <span className="badge" style={{
                    background: isPushSubscribed ? '#dcfce7' : '#f1f5f9',
                    color: isPushSubscribed ? '#15803d' : '#64748b',
                    border: `1px solid ${isPushSubscribed ? '#86efac' : '#cbd5e1'}`,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    padding: '4px 10px',
                    borderRadius: 20,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: isPushSubscribed ? '#16a34a' : '#94a3b8'
                    }} />
                    {isPushSubscribed ? 'Đang bật nhận thông báo' : 'Chưa kích hoạt'}
                  </span>
                </div>

                {/* Device Label Input */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                    Đặt tên nhận diện cho thiết bị này:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={deviceLabelInput}
                    onChange={(e) => setDeviceLabelInput(e.target.value)}
                    placeholder="Ví dụ: Máy tính phòng Địa chính, iPhone cá nhân..."
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                {/* Action Buttons for Current Device */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  {!isPushSubscribed ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSubscribePush}
                      disabled={isPushLoading}
                      style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px' }}
                    >
                      <Icon name="bell" size={14} />
                      <span>{isPushLoading ? 'Đang kích hoạt...' : 'Bật Thông Báo Trên Thiết Bị Này'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => handleSendTestPush()}
                        disabled={isPushLoading}
                        style={{
                          fontWeight: 700,
                          color: '#2563eb',
                          borderColor: '#93c5fd',
                          background: '#eff6ff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Icon name="paper-plane" size={13} />
                        <span>Gửi Thử Nghiệm Ngay</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline btn-danger"
                        onClick={handleUnsubscribePush}
                        disabled={isPushLoading}
                        style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Icon name="bell-slash" size={13} />
                        <span>Tắt Trên Thiết Bị Này</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* CARD 2: HƯỚNG DẪN DÀNH CHO IPHONE & IPAD (iOS SAFARI) */}
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 10,
                padding: '16px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="mobile-screen-button" size={16} style={{ color: '#d97706' }} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#92400e' }}>
                      Hướng Dẫn Kích Hoạt Trên iPhone & iPad (iOS Safari)
                    </h4>
                    <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: 2 }}>
                      Theo chuẩn bảo mật của Apple, Web Push trên iOS chỉ hoạt động khi thêm vào Màn hình chính (PWA)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 12 }}>
                  <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: 8, border: '1px solid #fef3c7' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#b45309', marginBottom: 4 }}>
                      1️⃣ Bước 1: Mở Safari
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#475569', lineHeight: 1.4 }}>
                      Mở trang web này bằng trình duyệt <strong>Safari</strong> trên iPhone.
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: 8, border: '1px solid #fef3c7' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#b45309', marginBottom: 4 }}>
                      2️⃣ Bước 2: Thêm vào MH chính
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#475569', lineHeight: 1.4 }}>
                      Nhấn nút <strong>Chia sẻ (biểu tượng ⎋)</strong> $\rightarrow$ chọn <strong>"Thêm vào Màn hình chính"</strong>.
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: 8, border: '1px solid #fef3c7' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#b45309', marginBottom: 4 }}>
                      3️⃣ Bước 3: Bật thông báo
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#475569', lineHeight: 1.4 }}>
                      Mở app từ Màn hình chính, vào đây bấm <strong>"Bật Thông Báo"</strong>.
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 3: DANH SÁCH THIẾT BỊ ĐÃ LIÊN KẾT */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="shield-halved" size={15} style={{ color: '#2563eb' }} />
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                      Thiết Bị Đã Liên Kết ({myPushSubscriptions.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={fetchMyPushSubscriptions}
                    title="Làm mới danh sách thiết bị"
                    style={{ color: '#2563eb', fontWeight: 600 }}
                  >
                    <Icon name="rotate" size={12} /> Tải lại
                  </button>
                </div>

                {myPushSubscriptions.length === 0 ? (
                  <div style={{ padding: '18px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', background: '#f8fafc', borderRadius: 8 }}>
                    Chưa có thiết bị nào đăng ký nhận thông báo. Bấm nút phía trên để đăng ký thiết bị này.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {myPushSubscriptions.map(sub => (
                      <div
                        key={sub.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: 8,
                          border: '1px solid #f1f5f9',
                          background: sub.isActive ? '#ffffff' : '#f8fafc'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Icon
                            name={sub.deviceLabel?.includes('iPhone') || sub.deviceLabel?.includes('Android') ? 'mobile-screen-button' : 'laptop'}
                            size={16}
                            style={{ color: sub.isActive ? '#2563eb' : '#94a3b8' }}
                          />
                          <div>
                            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#1e293b' }}>
                              {sub.deviceLabel || 'Thiết bị làm việc'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              Đăng ký: {formatDateTimeDisplay(sub.createdAt)} {sub.lastUsedAt && `• Gửi gần nhất: ${formatDateTimeDisplay(sub.lastUsedAt)}`}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => handleSendTestPush(sub.endpoint)}
                            disabled={isPushLoading}
                            style={{ color: '#2563eb', borderColor: '#bfdbfe', background: '#eff6ff' }}
                            title="Gửi thông báo thử nghiệm tới thiết bị này"
                          >
                            <Icon name="paper-plane" size={11} /> Thử
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-danger btn-xs"
                            onClick={() => handleDeletePushSubscription(sub.id)}
                            title="Hủy đăng ký nhận tin trên thiết bị này"
                          >
                            <Icon name="trash" size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CARD 4: LỊCH THÔNG BÁO TỰ ĐỘNG */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '14px 16px'
              }}>
                <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="calendar-check" size={14} style={{ color: '#16a34a' }} />
                  <span>Các Thông Báo Tự Động Sẽ Được Gửi Tới Bạn:</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.78rem', color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#d97706' }}></span>
                    <span><strong>07:30 Sáng mỗi ngày:</strong> Tóm tắt việc cần xử lý hôm nay</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#2563eb' }}></span>
                    <span><strong>Trước hạn 3 ngày & 1 ngày:</strong> Nhắc việc tiến độ</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#dc2626' }}></span>
                    <span><strong>Trễ hạn & Leo thang:</strong> Cảnh báo khẩn cấp</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#7c3aed' }}></span>
                    <span><strong>Lịch sự kiện & Họp:</strong> Nhắc trước giờ khai mạc</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowPushSettingsModal(false)}
                style={{ fontWeight: 600 }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         FLOATING TOAST NOTIFICATION SYSTEM
         ═══════════════════════════════════════════════════════════════ */}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast-item toast-${toast.type}`}>
            <Icon
              name={toast.type === 'success' ? 'circle-check' : toast.type === 'danger' ? 'circle-xmark' : toast.type === 'warning' ? 'triangle-exclamation' : 'circle-info'}
              size={18}
              style={{ color: toast.type === 'success' ? '#16a34a' : toast.type === 'danger' ? '#dc2626' : toast.type === 'warning' ? '#d97706' : '#2563eb', marginTop: 1, flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => removeToast(toast.id)}
              aria-label="Đóng thông báo"
              style={{ padding: 2, margin: -2, color: 'var(--text-muted)' }}
            >
              <Icon name="xmark" size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={showViewerModal}
        onClose={() => setShowViewerModal(false)}
        documentTitle={viewerMail?.subject || 'Văn bản hành chính'}
        documentNumberSymbol={`Số: ${viewerMail?.documentNumber || '---'}/${viewerMail?.documentSymbol || 'UBND-VP'}`}
        issuingAgency={viewerMail?.issuingAgency || viewerMail?.senderOrg || viewerMail?.senderName}
        fileUrl={viewerMail?.id ? getFileViewUrl(viewerMail.id) : undefined}
        fileName={viewerMail?.attachments?.[0]?.name || `CongVan_${viewerMail?.documentNumber || '125'}.pdf`}
        fileType="pdf"
        attachments={viewerMail?.attachments}
      />

      {/* Revoke Document Modal */}
      <RevokeDocumentModal
        isOpen={showRevokeModal}
        onClose={() => setShowRevokeModal(false)}
        documentTitle={revokeDocItem?.subject || revokeDocItem?.title || 'Văn bản hành chính'}
        documentNumberSymbol={`Số: ${revokeDocItem?.documentNumber || '---'}/${revokeDocItem?.documentSymbol || 'UBND-VP'}`}
        onConfirmRevoke={async (reason) => {
          if (revokeDocItem?.id) {
            const res = await revokeIssuedOutgoingDocumentApi(revokeDocItem.id, reason);
            if (res.success) {
              addToast('Thu hồi thành công', `Đã thu hồi văn bản Số: ${revokeDocItem.documentNumber || '---'}/${revokeDocItem.documentSymbol || 'UBND-VP'}. Lý do: ${reason}`, 'success');
            } else {
              addToast('Thu hồi thất bại', res.error || 'Có lỗi xảy ra', 'danger');
            }
          }
        }}
      />

      {/* Document History & Audit Log Modal */}
      <DocumentHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        documentId={historyDocItem?.id || ''}
        documentTitle={historyDocItem?.subject || historyDocItem?.title || 'Văn bản hành chính'}
        documentNumberSymbol={`Số: ${historyDocItem?.documentNumber || '---'}/${historyDocItem?.documentSymbol || 'UBND-VP'}`}
      />

      {/* ═══════════════════════════════════════════════════════════════
         PROMPT F: MODALS LUỒNG SỐ HÓA, PHÂN TÍCH & GIAO VIỆC TỰ ĐỘNG
         ═══════════════════════════════════════════════════════════════ */}
      <AiUploadModal
        isOpen={showAiUploadModal}
        onClose={() => setShowAiUploadModal(false)}
        documentId={aiUploadTargetDocId}
        documentNumberSymbol={aiUploadTargetDocSymbol}
        onAnalysisComplete={(result) => {
          setShowAiUploadModal(false);
          setAiReviewDocId(aiUploadTargetDocId);
          setAiReviewAnalysisData(result);
          setShowAiReviewModal(true);
        }}
      />

      <AiReviewModal
        isOpen={showAiReviewModal}
        onClose={() => setShowAiReviewModal(false)}
        documentId={aiReviewDocId}
        initialData={aiReviewAnalysisData}
        departments={Object.values(DEPARTMENTS).map(d => ({ id: d.code, name: d.name }))}
        onProceedToAssign={(docId, analysisData) => {
          setShowAiReviewModal(false);
          setAiAssignDocId(docId);
          setAiAssignAnalysisData(analysisData);
          setShowAiAssignmentModal(true);
        }}
        onConfirmSuccess={(route, data) => {
          setShowAiReviewModal(false);
          if (route === 'event') {
            addToast('Tạo lịch thành công', 'Đã tạo lịch công tác từ dữ liệu phân tích văn bản.', 'success');
            setActiveModule('workcenter');
            setWorkcenterTab('week');
          } else if (route === 'review') {
            addToast('Đã lưu kết quả', 'Đã lưu tóm tắt và hạn xử lý cho văn bản chỉ đạo.', 'info');
          }
        }}
      />

      <AiAssignmentModal
        isOpen={showAiAssignmentModal}
        onClose={() => setShowAiAssignmentModal(false)}
        documentId={aiAssignDocId}
        analysisData={aiAssignAnalysisData}
        departments={Object.values(DEPARTMENTS).map(d => ({ id: d.code, name: d.name }))}
        allUsers={dbUsers.length > 0 ? dbUsers.map(u => ({ id: u.id, name: u.fullName, role: u.roleName || u.activeRoleCode, departmentId: (u as any).departmentId || '', departmentName: (u as any).departmentName || '' })) : activeStaffList.map(s => ({ id: s.id, name: s.name, role: s.role, departmentId: s.departmentCode, departmentName: s.departmentName }))}
        onTaskCreated={(taskItemId, subTasks) => {
          setShowAiAssignmentModal(false);
          setAiChecklistTaskId(taskItemId);
          setAiChecklistTaskTitle(aiAssignAnalysisData?.title || 'Nhiệm vụ mới');
          setAiChecklistSubTasks(subTasks);
          setShowAiChecklistModal(true);
          setActiveModule('workcenter');
          setWorkcenterTab('today');
          addToast('Giao việc thành công', 'Đã tạo nhiệm vụ chính thức và danh mục đầu việc tự động!', 'success');
        }}
      />

      <AiChecklistModal
        isOpen={showAiChecklistModal}
        onClose={() => setShowAiChecklistModal(false)}
        taskItemId={aiChecklistTaskId}
        taskTitle={aiChecklistTaskTitle}
        subTasks={aiChecklistSubTasks}
        onSubTaskToggled={(result) => {
          addToast('Cập nhật tiến độ', `Tiến độ nhiệm vụ hiện tại: ${result.progressPercentage}%`, 'info');
        }}
      />
    </div>
  );
}
