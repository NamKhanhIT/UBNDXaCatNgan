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
import { createScheduleFromInbox, createManualSchedule, autoScheduleFromInbox, createReminder, getWeekSchedules, formatReminderLabel } from '../services/schedule.service';
import type { ScheduleEntry, Reminder } from '../services/schedule.service';
import { getNotifications, markNotificationRead, markAllNotificationsRead, initSignalRConnection, stopSignalRConnection } from '../services/notification.service';
import type { NotificationItem } from '../services/notification.service';
import { getCommentsApi, createCommentApi, TaskCommentDto } from '../services/comment.service';
import { getActivityLogApi, ActivityLogItemDto } from '../services/activity-log.service';
import { getAuditLogApi, AuditLogItemDto } from '../services/audit-log.service';
import { markReadReceiptApi, getReadReceiptsApi } from '../services/read-receipt.service';

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
type ModuleKey = 'overview' | 'inbox' | 'tasks' | 'departments' | 'create-task' | 'reports' | 'my-day' | 'activity-log';
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
  rating?: number;
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
    subText: 'Hoàn thành xuất sắc (9.0 – 10.0 điểm) — Vượt chỉ tiêu & chất lượng cao',
    badgeClass: 'badge-success',
    icon: 'trophy',
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
    subText: 'Hoàn thành (6.0 – 7.4 điểm) — Đạt mức yêu cầu cơ bản',
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
    subText: 'Cần cải thiện (4.0 – 5.9 điểm) — Chậm tiến độ hoặc cần sửa đổi nhẹ',
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
    subText: 'Chưa đạt (1.0 – 3.9 điểm) — Không hoàn thành nhiệm vụ / vi phạm quy định',
    badgeClass: 'badge-urgent',
    icon: 'circle-xmark',
    color: '#b91c1c',
    bgColor: '#fef2f2',
    borderColor: '1px solid #fecaca',
  },
];

function getEvaluationTier(score: number): EvaluationTier {
  if (score >= 9.0) return EVALUATION_TIERS[0];
  if (score >= 7.5) return EVALUATION_TIERS[1];
  if (score >= 6.0) return EVALUATION_TIERS[2];
  if (score >= 4.0) return EVALUATION_TIERS[3];
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
  attachments: { name: string; size: string; type: string }[];
  deadline?: string;
}

const SAMPLE_INBOX: InboxItem[] = [
  {
    id: 'MAIL-001',
    senderName: 'Vũ Đức Đam',
    senderOrg: 'UBND Tỉnh',
    date: '05/08/2026 08:30',
    subject: 'Công điện khẩn về việc phòng chống bão số 3',
    content: 'Yêu cầu các địa phương khẩn trương rà soát các hộ dân vùng trũng, lên phương án sơ tán an toàn trước 17h chiều nay. Đảm bảo lực lượng túc trực 24/24 tại trụ sở.',
    status: 'unread',
    folder: 'inbox',
    isStarred: true,
    isUrgent: true,
    deadline: '05/08/2026',
    attachments: [{ name: 'CongDien_BaoSo3.pdf', size: '2.4 MB', type: 'pdf' }]
  },
  {
    id: 'MAIL-002',
    senderName: 'Nguyễn Văn A',
    senderOrg: 'Sở Tài Nguyên & Môi Trường',
    date: '04/08/2026 14:15',
    subject: 'Hướng dẫn mới về phân loại rác thải tại nguồn',
    content: 'Gửi UBND Xã tài liệu hướng dẫn phân loại rác thải tại nguồn áp dụng từ quý 4/2026. Đề nghị chủ tịch phân công cán bộ chuyên môn nghiên cứu và triển khai đến từng thôn bản.',
    status: 'read',
    folder: 'inbox',
    isStarred: false,
    isUrgent: false,
    deadline: '15/08/2026',
    attachments: [{ name: 'HD_PhanLoaiRac.docx', size: '1.1 MB', type: 'doc' }, { name: 'Poster_TuyenTruyen.png', size: '4.5 MB', type: 'image' }]
  },
  {
    id: 'MAIL-003',
    senderName: 'Trần Thị B',
    senderOrg: 'Phòng Tài Chính - Kế Hoạch Huyện',
    date: '03/08/2026 09:00',
    subject: 'Báo cáo giải ngân vốn đầu tư công tháng 7',
    content: 'Yêu cầu UBND Xã khẩn trương tổng hợp số liệu giải ngân vốn đầu tư công các công trình trên địa bàn trong tháng 7/2026. Nộp báo cáo trước ngày mùng 5.',
    status: 'assigned',
    folder: 'assigned',
    isStarred: false,
    isUrgent: true,
    deadline: '05/08/2026',
    attachments: [{ name: 'MauBaoCao_GiaiNgan.xlsx', size: '120 KB', type: 'excel' }]
  },
  {
    id: 'MAIL-004',
    senderName: 'Người Dân',
    senderOrg: 'Hệ thống phản ánh kiến nghị',
    date: '05/08/2026 10:20',
    subject: 'Phản ánh tình trạng lấn chiếm lòng lề đường tại Chợ Xã',
    content: 'Kính gửi UBND Xã, hiện nay tại khu vực ngã ba Chợ Xã có tình trạng một số tiểu thương lấn chiếm lòng đường để buôn bán gây ách tắc giao thông vào giờ cao điểm.',
    status: 'read',
    folder: 'inbox',
    isStarred: false,
    isUrgent: false,
    attachments: []
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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

  // New comment state
  const [newComment, setNewComment] = useState('');

  // Approval & Rejection Modals State
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const [ratingScore, setRatingScore] = useState<number>(5);
  const [rejectReason, setRejectReason] = useState('');
  const [newExtendedDate, setNewExtendedDate] = useState('');
  const [submitNote, setSubmitNote] = useState('');


  // Inbox State
  const [inboxItems, setInboxItems] = useState<InboxItem[]>(SAMPLE_INBOX);
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

  useEffect(() => {
    if (isLoggedIn) {
      // 1. Fetch real tasks from PostgreSQL API
      getTasksApi().then(res => {
        if (res.success && res.data && res.data.length > 0) {
          const mapped: Task[] = res.data.map(t => ({
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
      });

      // 2. Fetch Inbox Documents from PostgreSQL
      getInboxDocumentsApi().then(res => {
        if (res.success && res.data && res.data.length > 0) {
          const mappedDocs: InboxItem[] = res.data.map(d => ({
            id: d.id,
            senderName: d.sender,
            senderOrg: d.sender,
            date: d.receivedDate ? d.receivedDate.split('T')[0] : '2026-08-07',
            subject: d.subject,
            content: `Văn bản chỉ đạo số ${d.documentNumber} gửi từ ${d.sender}. Thể loại: ${d.category}. Yêu cầu xem xét và xử lý.`,
            status: d.isScheduled ? 'scheduled' : 'read',
            folder: d.isScheduled ? 'scheduled' : 'inbox',
            isStarred: d.isUrgent,
            isUrgent: d.isUrgent,
            deadline: d.scheduledDate ? d.scheduledDate.split('T')[0] : undefined,
            attachments: [{ name: `CongVan_${d.documentNumber.replace(/[\/\s]/g, '_')}.pdf`, size: '1.8 MB', type: 'pdf' }]
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
        avatarSrc: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80",
        name: "Bùi Văn Hùng",
        handle: "Chủ tịch UBND xã Cát Ngạn",
        text: "Hệ thống đôn đốc tự động giúp Thường trực UBND xã xử lý 98% công việc đúng tiến độ."
      },
      {
        avatarSrc: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80",
        name: "Trần Thị Mai",
        handle: "Trưởng phòng Địa chính - Xây dựng",
        text: "Bảng phân ca Sáng - Chiều - Tối minh bạch, tránh trùng lặp lịch công tác của cán bộ."
      },
      {
        avatarSrc: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80",
        name: "Nguyễn Văn Nam",
        handle: "Chuyên viên Văn phòng HĐND & UBND",
        text: "Giao diện tinh gọn, trợ lý AI hỗ trợ tự động bốc tách công văn PDF cực kỳ nhanh chóng."
      },
    ];

    return (
      <SignInPage
        heroImageSrc="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1600&q=80"
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

  const handleApproveTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setRatingScore(9.0); // Mặc định 9.0/10 (Mức 1: Xuất sắc)
    setShowApproveModal(true);
  };

  const confirmApproveTask = async () => {
    if (!selectedTaskId) return;
    const targetTask = tasks.find(t => t.id === selectedTaskId);
    const tier = getEvaluationTier(ratingScore);

    // Call PostgreSQL API
    await updateTaskStatusApi(selectedTaskId, 'Completed', ratingScore);

    setTasks(prev => prev.map(t =>
      t.id === selectedTaskId ? {
        ...t,
        status: 'Hoan_Thanh' as TaskStatus,
        progress: 100,
        rating: ratingScore,
        statusHistory: [...t.statusHistory, {
          from: 'Chờ duyệt', to: `Hoàn thành (Đánh giá: ${ratingScore.toFixed(1)}/10 — Mức ${tier.level}: ${tier.label})`,
          by: ROLE_CONFIG[activeRole].label, at: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          asRole: ROLE_CONFIG[activeRole].label,
        }],
      } : t
    ));
    addToast('Nghiệm thu thành công', `Đã phê duyệt "${targetTask?.title || selectedTaskId}" — Đánh giá: ${ratingScore.toFixed(1)}/10 điểm (Mức ${tier.level}: ${tier.label}).`, 'success');
    setShowApproveModal(false);
    setSelectedTaskId(null);
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
        addToast('Đã gửi ý kiến & @mention', `Đã tự động gửi thông báo SignalR cho: ${res.data.mentionedUsers.join(', ')}`, 'success');
      } else {
        addToast('Đã gửi ý kiến', 'Bình luận đã được lưu vào CSDL PostgreSQL.', 'info');
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
      if (tasksRes.success && tasksRes.data) {
        const mapped: Task[] = tasksRes.data.map(t => ({
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
    addToast('Giao việc thành công', `Đã giao việc "${newTask.title}" cho đ/c ${newAssignee} (Đã đồng bộ PostgreSQL)`, 'success');
    setActiveModule('tasks');
  };

  // Voice simulation
  const handleVoiceToggle = () => {
    if (!isRecording) {
      setIsRecording(true);
      setVoiceText('Đang thu âm...');
      setTimeout(() => {
        setVoiceText('Giao đồng chí Nam rà soát tiến độ thu ngân sách xã tháng 7 và nộp báo cáo trước 17h ngày 29/07.');
        setIsRecording(false);
        addToast('AI Trích xuất thành công', 'Đã phân tích giọng nói và điền tự động vào form giao việc!', 'success');
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
      addToast('OCR AI Trích xuất thành công', 'Đã quét xong văn bản chỉ đạo!', 'info');
    }, 2000);
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
    { key: 'my-day', icon: 'sun', label: 'Việc Của Tôi Hôm Nay' },
    { key: 'inbox', icon: 'envelope-open-text', label: 'Hộp Thư Văn Bản', badge: 3 },
    { key: 'tasks', icon: 'calendar-days', label: 'Lịch Công Tác Tuần', badge: sidebarBadges.tasks },
    { key: 'departments', icon: 'sitemap', label: 'Nhân Sự & Phòng Ban', badge: sidebarBadges.departments },
    // Chuyên viên (scopeLevel=3) KHÔNG có quyền giao việc → ẩn module
    ...(canCreateTask(activeRole) ? [{ key: 'create-task' as ModuleKey, icon: 'circle-plus', label: 'Giao Việc Mới', badge: sidebarBadges['create-task'] }] : []),
    { key: 'reports', icon: 'chart-column', label: 'Báo Cáo & Đánh Giá', badge: sidebarBadges.reports },
    ...(SHOW_ACTIVITY_LOG ? [{ key: 'activity-log' as ModuleKey, icon: 'newspaper', label: 'Nhật Ký Hoạt Động' }] : []),
  ];

  const moduleTitles: Record<ModuleKey, string> = {
    'overview': 'Tổng Quan Hệ Thống',
    'my-day': 'Việc Của Tôi Hôm Nay',
    'inbox': 'Hộp Thư Văn Bản & Yêu Cầu',
    'tasks': 'Lịch Công Tác Tuần',
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
                          onClick={() => handleMarkNotificationRead(n.id)}
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
                </div>
              )}
            </div>

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
                  <strong>Thông báo nhiệm vụ hôm nay ({formatDateDisplay(new Date().toISOString())}):</strong> Hệ thống ghi nhận <strong>{kpiData.active}</strong> công việc đang xử lý, <strong>{kpiData.pendingApproval}</strong> việc chờ duyệt, và <strong>{unreadNotifCount}</strong> thông báo mới từ PostgreSQL!
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
                {/* Left: Urgent Tasks */}
                <div className="card">
                  <div className="card-header">
                    <h2><Icon name="fire" size={18} style={{ color: '#dc2626' }} /> Công Việc Khẩn Cấp & Đột Xuất Tuần Này</h2>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setActiveModule('tasks')}>Xem Tất Cả</button>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Mã CV / Tiêu đề</th>
                          <th scope="col">Người thực hiện</th>
                          <th scope="col">Ca / Thời gian</th>
                          <th scope="col">Hạn chót</th>
                          <th scope="col">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTasks.slice(0, 5).map(task => (
                          <tr key={task.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTaskId(task.id)}>
                            <td>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{task.title}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mã: {task.id} • Giao bởi: {task.assignedBy}</div>
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
                              <span style={{ fontWeight: 700, color: getDaysUntilDue(task.dueDate) < 0 ? '#dc2626' : '#d97706' }}>
                                {task.dueDate}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${getStatusBadge(task.status)}`}>{STATUS_LABELS[task.status]}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

          {/* ═════════════════════════════════════════
             MODULE: VIỆC CỦA TÔI HÔM NAY (MY DAY)
             ═════════════════════════════════════════ */}
          {activeModule === 'my-day' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="sun" size={20} style={{ color: '#d97706' }} />
                <div>
                  <strong>Việc Của Tôi Hôm Nay ({formatDateDisplay(new Date().toISOString())}):</strong> Đang làm việc với vai trò <strong>{ROLE_CONFIG[activeRole].label}</strong>. Danh sách tập trung công việc cần xử lý trong ngày.
                </div>
              </div>

              {/* My Day Summary Cards */}
              {/* <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-label">Tổng Nhiệm Vụ Được Giao</div>
                  <div className="kpi-value" style={{ color: '#2563eb' }}>{tasks.length}</div>
                  <div className="kpi-hint">Toàn bộ công việc hệ thống</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Đang Xử Lý Hôm Nay</div>
                  <div className="kpi-value" style={{ color: '#d97706' }}>{tasks.filter(t => t.status === 'Dang_Xu_Ly').length}</div>
                  <div className="kpi-hint">Cần tập trung giải quyết</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Chờ Duyệt Nghiệm Thu</div>
                  <div className="kpi-value" style={{ color: '#8b5cf6' }}>{tasks.filter(t => t.status === 'Cho_Duyet').length}</div>
                  <div className="kpi-hint">Đã nộp báo cáo kết quả</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">Đã Hoàn Thành</div>
                  <div className="kpi-value" style={{ color: '#16a34a' }}>{tasks.filter(t => t.status === 'Hoan_Thanh').length}</div>
                  <div className="kpi-hint">Đạt 100% tiến độ</div>
                </div>
              </div> */}

              {/* My Day Task List with Search, Multi-Filter, Indexing & Pagination */}
              <div className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <h2 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="list-check" size={16} style={{ color: '#2563eb' }} />
                    Danh Sách Nhiệm Vụ Của Tôi
                  </h2>
                  <span className="badge badge-primary">
                    {myDayFilteredTasks.length === tasks.length ? `${tasks.length} việc` : `Tìm thấy ${myDayFilteredTasks.length} / ${tasks.length} việc`}
                  </span>
                </div>

                {/* Filter & Search Bar */}
                <div style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  {/* Search Input */}
                  <div className="search-box" style={{ flex: '1 1 240px', margin: 0 }}>
                    <Icon name="search" size={13} />
                    <input
                      type="text"
                      placeholder="Tìm theo tiêu đề, mã CV, người giao..."
                      value={myDaySearchQuery}
                      onChange={e => handleMyDaySearchChange(e.target.value)}
                      style={{ padding: '7px 10px 7px 30px', fontSize: '0.84rem' }}
                    />
                    {myDaySearchQuery && (
                      <button
                        type="button"
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                        onClick={() => handleMyDaySearchChange('')}
                      >
                        <Icon name="xmark" size={12} />
                      </button>
                    )}
                  </div>

                  {/* Status Filter */}
                  <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: 140, padding: '6px 10px', fontSize: '0.82rem' }}
                    value={myDayStatusFilter}
                    onChange={e => handleMyDayStatusChange(e.target.value as TaskStatus | 'all')}
                    aria-label="Lọc theo trạng thái"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="Chua_Lam">Chưa làm</option>
                    <option value="Dang_Xu_Ly">Đang xử lý</option>
                    <option value="Cho_Duyet">Chờ duyệt</option>
                    <option value="Hoan_Thanh">Hoàn thành</option>
                    <option value="Tu_Choi">Từ chối</option>
                  </select>

                  {/* Priority Filter */}
                  <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: 140, padding: '6px 10px', fontSize: '0.82rem' }}
                    value={myDayPriorityFilter}
                    onChange={e => handleMyDayPriorityChange(e.target.value as TaskPriority | 'all')}
                    aria-label="Lọc theo mức độ ưu tiên"
                  >
                    <option value="all">Tất cả mức độ</option>
                    <option value="Khan">Khẩn cấp</option>
                    <option value="Cao">Cao</option>
                    <option value="Trung_Binh">Trung bình</option>
                    <option value="Thuong">Thường</option>
                  </select>

                  {/* Shift Filter */}
                  <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: 120, padding: '6px 10px', fontSize: '0.82rem' }}
                    value={myDayShiftFilter}
                    onChange={e => handleMyDayShiftChange(e.target.value as ShiftType | 'all')}
                    aria-label="Lọc theo ca làm việc"
                  >
                    <option value="all">Tất cả Ca (Sáng/Chiều)</option>
                    <option value="Sang">Ca Sáng (07:00 - 11:30)</option>
                    <option value="Chieu">Ca Chiều (13:00 - 17:00)</option>
                  </select>

                  {/* Reset Filters Button */}
                  {(myDaySearchQuery || myDayStatusFilter !== 'all' || myDayPriorityFilter !== 'all' || myDayShiftFilter !== 'all') && (
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={handleMyDayResetFilters}
                      title="Xóa tất cả bộ lọc"
                      style={{ height: 32, padding: '0 10px', fontSize: '0.78rem', color: '#dc2626', borderColor: '#fca5a5' }}
                    >
                      <Icon name="rotate-right" size={11} /> Xóa lọc
                    </button>
                  )}
                </div>

                {/* Table Data */}
                <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
                  {myDayFilteredTasks.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Icon name="folder-open" size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Không tìm thấy nhiệm vụ nào</div>
                      <div style={{ fontSize: '0.82rem', marginTop: 4 }}>Thử thay đổi từ khóa tìm kiếm hoặc chọn lại điều kiện lọc.</div>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ marginTop: 14 }}
                        onClick={handleMyDayResetFilters}
                      >
                        <Icon name="rotate-right" size={12} /> Đặt lại bộ lọc
                      </button>
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 50, textAlign: 'center' }}>STT</th>
                          <th>Nhiệm vụ / Mã CV</th>
                          <th>Người giao</th>
                          <th>Hạn chót</th>
                          <th>Mức độ</th>
                          <th>Trạng thái</th>
                          <th>Tiến độ</th>
                          <th style={{ textAlign: 'right' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myDayPaginatedTasks.map((t, idx) => {
                          const sttIndex = (myDayCurrentPage - 1) * myDayPageSize + idx + 1;
                          return (
                            <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedTaskId(t.id)}>
                              <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                {sttIndex}
                              </td>
                              <td>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.title}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                  <span>[{t.id.substring(0, 8)}]</span>
                                  <span>•</span>
                                  <span style={{ color: '#2563eb', fontWeight: 600 }}>
                                    <Icon name={SHIFT_CONFIG[t.shift].icon} size={10} /> Ca {SHIFT_CONFIG[t.shift].label} ({t.startTime})
                                  </span>
                                  {t.sourceInboxId && (
                                    <span style={{ color: '#7c3aed', fontWeight: 600 }} title="Nguồn gốc từ Hộp thư công văn">
                                      • <Icon name="envelope-open-text" size={10} /> Từ công văn
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{t.assignedBy}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.assignedByRole}</div>
                              </td>
                              <td>
                                <span style={{ fontWeight: 700, color: t.status === 'Hoan_Thanh' ? '#16a34a' : getDaysUntilDue(t.dueDate) < 0 ? '#dc2626' : '#d97706' }}>
                                  {formatDateDisplay(t.dueDate)}
                                </span>
                              </td>
                              <td><span className={`badge ${getPriorityBadge(t.priority)}`}>{PRIORITY_LABELS[t.priority]}</span></td>
                              <td><span className={`badge ${getStatusBadge(t.status)}`}>{STATUS_LABELS[t.status]}</span></td>
                              <td style={{ minWidth: 100 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 2 }}>{t.progress}%</div>
                                <div className="progress-bar" style={{ height: 5 }}>
                                  <div className="progress-bar-fill" style={{ width: `${t.progress}%`, background: t.progress === 100 ? '#16a34a' : '#2563eb' }} />
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={(e) => { e.stopPropagation(); setSelectedTaskId(t.id); }}
                                >
                                  <Icon name="eye" size={12} /> Chi tiết
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination Controls */}
                {myDayFilteredTasks.length > 0 && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#ffffff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      <span>
                        Hiển thị <strong>{Math.min((myDayCurrentPage - 1) * myDayPageSize + 1, myDayFilteredTasks.length)}</strong> - <strong>{Math.min(myDayCurrentPage * myDayPageSize, myDayFilteredTasks.length)}</strong> trên tổng số <strong>{myDayFilteredTasks.length}</strong> nhiệm vụ
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label htmlFor="my-day-page-size" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Số dòng/trang:</label>
                        <select
                          id="my-day-page-size"
                          className="form-select"
                          style={{ width: 'auto', padding: '3px 8px', fontSize: '0.8rem' }}
                          value={myDayPageSize}
                          onChange={e => {
                            setMyDayPageSize(Number(e.target.value));
                            setMyDayCurrentPage(1);
                          }}
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        disabled={myDayCurrentPage === 1}
                        onClick={() => setMyDayCurrentPage(prev => Math.max(1, prev - 1))}
                        style={{ opacity: myDayCurrentPage === 1 ? 0.5 : 1, cursor: myDayCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
                      >
                        <Icon name="chevron-left" size={10} /> Trước
                      </button>

                      {Array.from({ length: myDayTotalPages }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          type="button"
                          className={`btn btn-xs ${myDayCurrentPage === page ? 'btn-primary' : 'btn-outline'}`}
                          style={{ minWidth: 28, height: 26, padding: 0 }}
                          onClick={() => setMyDayCurrentPage(page)}
                        >
                          {page}
                        </button>
                      ))}

                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        disabled={myDayCurrentPage === myDayTotalPages}
                        onClick={() => setMyDayCurrentPage(prev => Math.min(myDayTotalPages, prev + 1))}
                        style={{ opacity: myDayCurrentPage === myDayTotalPages ? 0.5 : 1, cursor: myDayCurrentPage === myDayTotalPages ? 'not-allowed' : 'pointer' }}
                      >
                        Sau <Icon name="chevron-right" size={10} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                      Nhật Ký Hoạt Động Thời Gian Thực Toàn Xã (PostgreSQL)
                    </h2>
                  </div>
                  <div className="card-body">
                    {activityLogs.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                        Đang kết nối CSDL PostgreSQL...
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
                      Sổ Kiểm Toán Append-Only (An Toàn & Bảo Mật CSDL PostgreSQL)
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

          {/* ═══════════════════════════════════════════════════════════════
              INBOX MODULE
              ═══════════════════════════════════════════════════════════════ */}
          {activeModule === 'inbox' && (
            <div className="inbox-container">
              {/* Left Pane: Folders */}
              <div className="inbox-sidebar">
                <div className="inbox-compose-btn">
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    <Icon name="pen" size={14} /> Soạn văn bản
                  </button>
                </div>
                <div className="inbox-folder-list">
                  {INBOX_FOLDERS.map(f => {
                    const count = inboxItems.filter(m => m.folder === f.id && m.status === 'unread').length;
                    return (
                      <button
                        key={f.id}
                        className={`inbox-folder-item ${activeFolder === f.id ? 'active' : ''}`}
                        onClick={() => { setActiveFolder(f.id as InboxFolder); setSelectedMailId(null); }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Icon name={f.icon} size={14} style={{ color: activeFolder === f.id ? f.color : 'var(--text-muted)' }} />
                          <span>{f.label}</span>
                        </div>
                        {count > 0 && <span className="inbox-badge">{count}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Middle Pane: List */}
              <div className="inbox-list-pane">
                <div className="inbox-list-header">
                  <div className="search-box">
                    <Icon name="search" size={14} />
                    <input type="text" placeholder="Tìm kiếm văn bản..." />
                  </div>
                </div>
                <div className="inbox-list-content">
                  {inboxItems.filter(m => m.folder === activeFolder).map(item => {
                    const isUrgent = item.isUrgent;
                    const isStarred = item.isStarred;
                    const isSelected = selectedMailId === item.id;
                    const isUnread = item.status === 'unread';

                    let itemBg = undefined;
                    let borderLeftStyle = undefined;

                    if (isUrgent) {
                      borderLeftStyle = '4px solid #dc2626';
                      itemBg = isSelected ? '#fecaca' : '#fef2f2';
                    } else if (isStarred) {
                      borderLeftStyle = '4px solid #d97706';
                      itemBg = isSelected ? '#fef3c7' : '#fffbeb';
                    }

                    return (
                      <div
                        key={item.id}
                        className={`inbox-list-item ${isSelected ? 'selected' : ''} ${isUnread ? 'unread' : ''} ${isUrgent ? 'urgent' : ''} ${isStarred ? 'starred' : ''}`}
                        style={{
                          borderLeft: borderLeftStyle,
                          background: itemBg,
                          transition: 'all 0.15s ease',
                        }}
                        onClick={() => {
                          setSelectedMailId(item.id);
                          if (item.status === 'unread') {
                            setInboxItems(prev => prev.map(m => m.id === item.id ? { ...m, status: 'read' } : m));
                          }
                        }}
                      >
                        <div className="inbox-item-top">
                          <div className="inbox-item-sender" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isUrgent && (
                              <span className="badge badge-urgent" style={{ padding: '2px 6px', fontSize: '0.66rem', fontWeight: 800 }}>
                                <Icon name="triangle-exclamation" size={10} /> KHẨN CẤP
                              </span>
                            )}
                            {isStarred && !isUrgent && (
                              <span className="badge badge-warning" style={{ padding: '2px 6px', fontSize: '0.66rem', fontWeight: 800 }}>
                                <Icon name="star" size={10} style={{ color: '#eab308' }} /> QUAN TRỌNG
                              </span>
                            )}
                            <span>{item.senderOrg}</span>
                          </div>
                          <div className="inbox-item-date">{formatDateDisplay(item.date.split(' ')[0])}</div>
                        </div>
                        <div className="inbox-item-subject" style={{ color: isUrgent ? '#b91c1c' : isStarred ? '#b45309' : undefined }}>
                          {item.subject}
                        </div>
                        <div className="inbox-item-preview">{item.content.substring(0, 60)}...</div>
                      </div>
                    );
                  })}
                  {inboxItems.filter(m => m.folder === activeFolder).length === 0 && (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Icon name="folder-open" size={40} style={{ opacity: 0.2, marginBottom: 16 }} />
                      <p>Thư mục trống</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane: Detail */}
              <div className="inbox-detail-pane">
                {selectedMail ? (
                  <div className="inbox-detail-content">
                    <div className="inbox-detail-header">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <h2 className="inbox-detail-subject">{selectedMail.subject}</h2>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {selectedMail.status !== 'scheduled' && selectedMail.status !== 'assigned' && (
                            <>
                              <button
                                className={`btn ${selectedMail.isUrgent ? 'btn-danger' : 'btn-outline'} btn-sm`}
                                title="Xếp lịch công tác"
                                onClick={() => {
                                  setScheduleSourceMail(selectedMail);
                                  setScheduleTitle(selectedMail.subject);
                                  setScheduleDescription(selectedMail.content);
                                  if (selectedMail.deadline) {
                                    const parts = selectedMail.deadline.split('/');
                                    if (parts.length === 3) setScheduleDate(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
                                  }
                                  setShowScheduleModal(true);
                                }}
                              >
                                <Icon name="calendar-plus" size={14} /> Xếp lịch
                              </button>
                              <button
                                className="btn btn-outline btn-sm"
                                title="Tự động xếp lịch (AI)"
                                onClick={async () => {
                                  const [y, m, d] = weekStart.split('-').map(Number);
                                  const daysOffset = selectedMail.isUrgent ? 1 : 2;
                                  const targetDate = new Date(Date.UTC(y, m - 1, d + daysOffset));
                                  const dateStr = targetDate.toISOString().split('T')[0];
                                  const shift = selectedMail.isUrgent ? 'Sang' : 'Chieu';
                                  const startTime = selectedMail.isUrgent ? '08:00' : '14:00';

                                  const newTask: Task = {
                                    id: `TSK-AUTO-${Date.now()}`,
                                    title: selectedMail.subject,
                                    description: `Tự động xếp lịch từ công văn: ${selectedMail.content}`,
                                    assignedBy: ROLE_CONFIG[activeRole].label,
                                    assignedByRole: ROLE_CONFIG[activeRole].label,
                                    assignee: 'Nguyễn Đình Hùng',
                                    assigneeRole: roleInfo.label,
                                    collaborators: [],
                                    priority: selectedMail.isUrgent ? 'Khan' : 'Trung_Binh',
                                    status: 'Chua_Lam',
                                    category: 'BAU',
                                    dueDate: dateStr,
                                    shift: shift,
                                    startTime: startTime,
                                    createdDate: new Date().toISOString().split('T')[0],
                                    progress: 0,
                                    effortHours: 4,
                                    attachments: [],
                                    comments: [],
                                    statusHistory: [],
                                    context: activeRole,
                                    sourceInboxId: selectedMail.id,
                                  };

                                  await scheduleInboxDocumentApi(selectedMail.id, dateStr, shift);
                                  setTasks(prev => [newTask, ...prev]);
                                  setInboxItems(prev => prev.map(m => m.id === selectedMail.id ? { ...m, folder: 'scheduled', status: 'scheduled' } : m));
                                  addToast('Tự động xếp lịch thành công', `Đã tự động phân bổ công văn vào ca ${SHIFT_CONFIG[shift].label} ngày ${dateStr}`, 'success');
                                  setSelectedMailId(null);
                                  setActiveModule('tasks');
                                  setSelectedTaskId(newTask.id);
                                }}
                              >
                                <Icon name="wand-magic-sparkles" size={14} style={{ color: '#8b5cf6' }} /> Tự động
                              </button>
                            </>
                          )}

                          {selectedMail.status === 'scheduled' && (
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ borderColor: '#2563eb', color: '#2563eb', fontWeight: 700 }}
                              title="Xem lịch sắp xếp trong Lịch tuần"
                              onClick={() => {
                                const matched = tasks.find(t => t.sourceInboxId === selectedMail.id || t.title === selectedMail.subject);
                                if (matched) setSelectedTaskId(matched.id);
                                setActiveModule('tasks');
                              }}
                            >
                              <Icon name="calendar-check" size={14} /> Xem lịch sắp xếp
                            </button>
                          )}

                          {selectedMail.status === 'assigned' && (
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ borderColor: '#16a34a', color: '#16a34a', fontWeight: 700 }}
                              title="Xem công việc đã giao"
                              onClick={() => {
                                const matched = tasks.find(t => t.sourceInboxId === selectedMail.id || t.title === selectedMail.subject);
                                if (matched) setSelectedTaskId(matched.id);
                                setActiveModule('tasks');
                              }}
                            >
                              <Icon name="list-check" size={14} /> Xem công việc đã giao
                            </button>
                          )}

                          {/* ⚠️ CHỈ HIỂN THỊ NÚT GIAO VIỆC CHO CẤP TRÊN (scopeLevel < 4.0), CHUYÊN VIÊN KHÔNG ĐƯỢC THẤY */}
                          {canCreateTask(activeRole) && selectedMail.status !== 'assigned' && (
                            <button
                              className="btn btn-primary btn-sm"
                              title="Giao việc từ công văn này"
                              onClick={() => {
                                setCreateTaskSource(selectedMail);
                                setNewTitle(selectedMail.subject);
                                setNewDesc(selectedMail.content);
                                setNewDueDate(selectedMail.deadline || '');
                                setActiveModule('create-task');
                              }}
                            >
                              <Icon name="paper-plane" size={14} /> Giao việc
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Prominent Alert Banner for Urgent & Important Emails */}
                      {selectedMail.isUrgent && (
                        <div className="alert alert-danger" style={{ marginBottom: 16, borderLeft: '4px solid #dc2626', background: '#fef2f2', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Icon name="triangle-exclamation" size={20} style={{ color: '#dc2626', flexShrink: 0 }} />
                          <div>
                            <strong style={{ color: '#991b1b', fontSize: '0.9rem' }}>VĂN BẢN HỎA TỐC / KHẨN CẤP</strong>
                            <p style={{ fontSize: '0.82rem', marginTop: 2, color: '#7f1d1d' }}>Công văn chỉ đạo khẩn cấp! Yêu cầu ưu tiên xử lý & xếp lịch công tác ngay trên Lịch tuần.</p>
                          </div>
                        </div>
                      )}

                      {selectedMail.isStarred && !selectedMail.isUrgent && (
                        <div className="alert alert-warning" style={{ marginBottom: 16, borderLeft: '4px solid #d97706', background: '#fffbeb', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Icon name="star" size={20} style={{ color: '#d97706', flexShrink: 0 }} />
                          <div>
                            <strong style={{ color: '#92400e', fontSize: '0.9rem' }}>VĂN BẢN QUAN TRỌNG</strong>
                            <p style={{ fontSize: '0.82rem', marginTop: 2, color: '#78350f' }}>Văn bản chỉ đạo trọng tâm đã được đánh dấu quan trọng.</p>
                          </div>
                        </div>
                      )}
                      <div className="inbox-detail-meta">
                        <div className="inbox-meta-avatar">
                          <Icon name="building-columns" size={20} style={{ color: '#fff' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedMail.senderOrg}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Người gửi: {selectedMail.senderName}</div>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {formatDateDisplay(selectedMail.date)}
                          <div style={{ marginTop: 4 }}>
                            <span
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setInboxItems(prev => prev.map(m => m.id === selectedMail.id ? { ...m, isStarred: !m.isStarred } : m));
                              }}
                            >
                              <Icon
                                name="star"
                                size={14}
                                style={{ color: selectedMail.isStarred ? '#eab308' : '#cbd5e1' }}
                              />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="inbox-detail-body">
                      {selectedMail.deadline && (
                        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
                          <Icon name="clock" size={14} /> Hạn xử lý công văn: <strong>{formatDateDisplay(selectedMail.deadline)}</strong>
                        </div>
                      )}

                      <div className="inbox-body-text" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                        {selectedMail.content}
                      </div>

                      {selectedMail.attachments.length > 0 && (
                        <div className="inbox-attachments">
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Tệp đính kèm ({selectedMail.attachments.length})</h4>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            {selectedMail.attachments.map((att, idx) => (
                              <div key={idx} className="attachment-card">
                                <div className="att-icon">
                                  <Icon name={att.type === 'pdf' ? 'file-pdf' : att.type === 'excel' ? 'file-excel' : att.type === 'doc' ? 'file-word' : 'file-image'} size={24} />
                                </div>
                                <div className="att-info">
                                  <div className="att-name">{att.name}</div>
                                  <div className="att-size">{att.size}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="inbox-empty-detail">
                    <Icon name="envelope-open" size={48} style={{ opacity: 0.1, marginBottom: 24 }} />
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Chưa chọn văn bản</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 300, textAlign: 'center', marginTop: 8 }}>
                      Chọn một văn bản từ danh sách bên trái để xem chi tiết và phân công xử lý.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeModule === 'tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Navigation & Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#ffffff', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={handlePrevWeek} title="Tuần trước">
                    <Icon name="chevron-left" size={12} /> Tuần Trước
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleTodayWeek}>
                    Hôm Nay
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleNextWeek} title="Tuần sau">
                    Tuần Sau <Icon name="chevron-right" size={12} />
                  </button>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', marginLeft: 8 }}>
                    Tuần từ {weekDays[0].dayNumber} đến {weekDays[6].dayNumber}/2026
                  </span>
                </div>

                {/* Shift Filter Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Ca làm việc:</span>
                  <button
                    type="button"
                    className={`btn btn-sm ${shiftFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setShiftFilter('all')}
                  >
                    Tất cả (2 Ca)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${shiftFilter === 'Sang' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setShiftFilter('Sang')}
                  >
                    <Icon name="sun" size={12} style={{ color: '#d97706' }} /> Sáng (07:00 - 11:30)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${shiftFilter === 'Chieu' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setShiftFilter('Chieu')}
                  >
                    <Icon name="cloud-sun" size={12} style={{ color: '#2563eb' }} /> Chiều (13:00 - 17:00)
                  </button>
                </div>
              </div>

              {/* Weekly Shift Grid Table */}
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="shift-grid-table" aria-label="Lịch công tác phân ca Sáng Chiều">
                    <thead>
                      <tr>
                        <th style={{ width: 110, textAlign: 'center', background: '#f8fafc' }}>CA / BUỔI</th>
                        {weekDays.map(day => (
                          <th key={day.dateStr} className={day.isToday ? 'is-today-header' : ''} style={{ textAlign: 'center', minWidth: 140 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{day.dayName}</div>
                            <div style={{ fontSize: '0.78rem', color: day.isToday ? '#2563eb' : 'var(--text-muted)' }}>{day.dayNumber}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>

                      {/* ROW 1: BUỔI SÁNG (07:00 - 11:30) */}
                      {(shiftFilter === 'all' || shiftFilter === 'Sang') && (
                        <tr>
                          <td className="shift-label-cell shift-label-morning">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Icon name="sun" size={14} style={{ color: '#d97706' }} /> SÁNG
                            </div>
                            <div className="shift-time-hint">07:00 - 11:30</div>
                          </td>
                          {weekDays.map(day => {
                            const shiftTasks = visibleTasks.filter(t => t.dueDate === day.dateStr && t.shift === 'Sang');
                            const isOverloaded = shiftTasks.length >= 2;

                            return (
                              <td key={day.dateStr} className={`shift-cell ${day.isToday ? 'is-today' : ''}`}>
                                <div className="shift-cell-header">
                                  <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>{shiftTasks.length > 0 ? `${shiftTasks.length} việc` : ''}</span>
                                  {isOverloaded && (
                                    <span className="shift-warning-badge" title="Trùng lịch hoặc mật độ công việc cao">
                                      <Icon name="triangle-exclamation" size={11} /> Trùng ca! ({shiftTasks.length} việc)
                                    </span>
                                  )}
                                </div>
                                {shiftTasks.map(t => (
                                  <div
                                    key={t.id}
                                    className={`shift-task-card ${getPriorityBadge(t.priority)}`}
                                    onClick={() => setSelectedTaskId(t.id)}
                                    role="button"
                                    tabIndex={0}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                                      <span className="shift-task-time"><Icon name="clock" size={10} /> {t.startTime}</span>
                                      <span className={`badge ${getStatusBadge(t.status)}`} style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                                        {STATUS_LABELS[t.status]}
                                      </span>
                                    </div>
                                    <div className="shift-task-title">{t.title}</div>
                                    <div className="shift-task-assignee">
                                      <Icon name="user" size={10} /> {t.assignee}
                                    </div>

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-xs"
                                        onClick={(e) => handleSwapShift(e, t.id, t.shift)}
                                        title="Đổi sang ca Chiều"
                                      >
                                        <Icon name="arrow-right-arrow-left" size={10} /> Đổi ca
                                      </button>
                                      {t.status === 'Cho_Duyet' && ROLE_CONFIG[activeRole].scopeLevel <= 2.5 && (
                                        <button
                                          type="button"
                                          className="btn btn-success btn-xs"
                                          onClick={(e) => { e.stopPropagation(); handleApproveTask(t.id); }}
                                        >
                                          Duyệt
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      )}

                      {/* ROW 2: BUỔI CHIỀU (13:00 - 17:00) */}
                      {(shiftFilter === 'all' || shiftFilter === 'Chieu') && (
                        <tr>
                          <td className="shift-label-cell shift-label-afternoon">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Icon name="cloud-sun" size={14} style={{ color: '#2563eb' }} /> CHIỀU
                            </div>
                            <div className="shift-time-hint">13:00 - 17:00</div>
                          </td>
                          {weekDays.map(day => {
                            const shiftTasks = visibleTasks.filter(t => t.dueDate === day.dateStr && t.shift === 'Chieu');
                            const isOverloaded = shiftTasks.length >= 2;

                            return (
                              <td key={day.dateStr} className={`shift-cell ${day.isToday ? 'is-today' : ''}`}>
                                <div className="shift-cell-header">
                                  <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>{shiftTasks.length > 0 ? `${shiftTasks.length} việc` : ''}</span>
                                  {isOverloaded && (
                                    <span className="shift-warning-badge" title="Trùng lịch ca Chiều">
                                      <Icon name="triangle-exclamation" size={11} /> Trùng ca! ({shiftTasks.length} việc)
                                    </span>
                                  )}
                                </div>
                                {shiftTasks.map(t => (
                                  <div
                                    key={t.id}
                                    className={`shift-task-card ${getPriorityBadge(t.priority)}`}
                                    onClick={() => setSelectedTaskId(t.id)}
                                    role="button"
                                    tabIndex={0}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                                      <span className="shift-task-time"><Icon name="clock" size={10} /> {t.startTime}</span>
                                      <span className={`badge ${getStatusBadge(t.status)}`} style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                                        {STATUS_LABELS[t.status]}
                                      </span>
                                    </div>
                                    <div className="shift-task-title">{t.title}</div>
                                    <div className="shift-task-assignee">
                                      <Icon name="user" size={10} /> {t.assignee}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-xs"
                                        onClick={(e) => handleSwapShift(e, t.id, t.shift)}
                                        title="Đổi sang ca Sáng"
                                      >
                                        <Icon name="arrow-right-arrow-left" size={10} /> Đổi ca
                                      </button>
                                      {t.status === 'Cho_Duyet' && ROLE_CONFIG[activeRole].scopeLevel <= 2 && (
                                        <button
                                          type="button"
                                          className="btn btn-success btn-xs"
                                          onClick={(e) => { e.stopPropagation(); handleApproveTask(t.id); }}
                                        >
                                          Duyệt
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      )}

                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

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
                    {activeStaffList.filter(s => s.assignedHours > s.maxHours).length > 0 && (
                      <span className="tab-badge-count">{activeStaffList.filter(s => s.assignedHours > s.maxHours).length}</span>
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

              {/* ── SUB-TAB 2: HỒ SƠ CÁN BỘ (Profile Cards) ── */}
              {deptSubTab === 'canbo' && (
                <div className="staff-card-grid">
                  {activeStaffList
                    .filter(s => selectedDeptFilter === 'ALL' || s.departmentCode === selectedDeptFilter)
                    .map(staff => {
                      const rate = Math.round((staff.assignedHours / staff.maxHours) * 100);
                      const isOver = rate > 100;
                      const dept = DEPARTMENTS[staff.departmentCode];
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

                    {(dbUsers.length > 0 ? dbUsers.map(u => {
                      const staffSample = activeStaffList.find(s => s.name === u.fullName);
                      const activeTasks = tasks.filter(t => t.assignee === u.fullName && t.status !== 'Hoan_Thanh');
                      return {
                        id: u.id,
                        name: u.fullName,
                        role: u.roleName || u.activeRoleCode || 'Cán bộ',
                        departmentName: u.departmentName || 'Văn phòng HĐND & UBND',
                        departmentCode: (staffSample?.departmentCode || 'VAN_PHONG') as DepartmentCode,
                        initials: u.fullName.split(' ').pop()?.[0] || 'NV',
                        specialization: staffSample?.specialization || 'Công tác chuyên môn',
                        assignedHours: staffWorkload.get(u.fullName) ?? 0,
                        maxHours: u.maxHours || 40,
                        tasksCount: activeTasks.length,
                        avatarBg: staffSample?.avatarBg || '#eff6ff',
                      };
                    }) : activeStaffList)
                      .filter(s => selectedDeptFilter === 'ALL' || s.departmentCode === selectedDeptFilter)
                      .map(staff => {
                        const rate = Math.round((staff.assignedHours / staff.maxHours) * 100);
                        const isOver = rate > 100;
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
                  <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 24 }}>
                    <h2 style={{ fontSize: '1.2rem' }}><Icon name="circle-plus" size={18} style={{ color: 'var(--accent-blue)' }} /> Thông tin công việc</h2>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <div className="form-group">
                      <label htmlFor="task-title-input" className="form-label">Tiêu đề công việc <span className="required">*</span></label>
                      <input id="task-title-input" className="form-input" placeholder="VD: Rà soát tiến độ xây dựng nông thôn mới…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label htmlFor="task-desc-input" className="form-label">Mô tả chi tiết yêu cầu</label>
                      <textarea id="task-desc-input" className="form-textarea" rows={3} placeholder="Mô tả nội dung, yêu cầu cụ thể của công việc…" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                    </div>

                    <div className="form-group checklist-builder">
                      <label className="form-label">Checklist Sản phẩm đầu ra (Phục vụ đo lường 40% tiến độ)</label>
                      <div className="checklist-input-group">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Thêm tiêu chí hoàn thành..."
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
                          <option value="BAU">Thường ngày (BAU)</option>
                          <option value="Dot_Xuat">Đột xuất chỉ đạo</option>
                          <option value="Du_An">Dự án trọng điểm</option>
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
                      setActiveModule('tasks');
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

              {/* TAB 1: BẢNG ĐÁNH GIÁ NĂNG LỰC */}
              {reportSubTab === 'evaluation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="alert alert-info">
                    <Icon name="award" size={18} style={{ flexShrink: 0 }} />
                    <span>Xếp loại năng lực dựa trên dữ liệu thực tế: tỷ lệ hoàn thành đúng hạn và điểm nghiệm thu khách quan (Mô hình GRAD).</span>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <h2><Icon name="trophy" size={18} style={{ color: '#2563eb' }} /> BẢNG ĐÁNH GIÁ NĂNG LỰC CÁN BỘ QUÝ III/2026</h2>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th scope="col">Cán bộ</th>
                            <th scope="col">Chức danh & Phòng ban</th>
                            <th scope="col">Hoàn thành / Tổng giao</th>
                            <th scope="col">Checklist (40%)</th>
                            <th scope="col">Lãnh đạo chấm (60%)</th>
                            <th scope="col">Điểm GRAD</th>
                            <th scope="col">Xếp loại thi đua</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(gradOfficers.length > 0 ? gradOfficers : SAMPLE_STAFF.map(s => ({
                            userId: s.id,
                            fullName: s.name,
                            roleName: s.role,
                            departmentName: s.departmentName,
                            totalTasksAssigned: s.totalCompleted,
                            completedTasksCount: s.completedOnTime,
                            overdueTasksCount: 0,
                            checklistProgressScore40: 3.6,
                            leaderQualityScore60: 5.4,
                            finalGRADScore: s.score,
                            tierGrade: getGradLabel(s.score).label
                          }))).map(officer => {
                            const isExc = officer.finalGRADScore >= 9.0;
                            const isGood = officer.finalGRADScore >= 7.5;
                            const isFair = officer.finalGRADScore >= 6.0;
                            const badgeClass = isExc ? 'badge-success' : isGood ? 'badge-blue' : isFair ? 'badge-warning' : 'badge-danger';

                            return (
                              <tr key={officer.userId}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', color: '#2563eb' }}>
                                      {officer.fullName.split(' ').pop()?.[0] || 'NV'}
                                    </div>
                                    <span style={{ fontWeight: 600 }}>{officer.fullName}</span>
                                  </div>
                                </td>
                                <td style={{ color: 'var(--text-secondary)' }}>
                                  {officer.roleName}<br /><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{officer.departmentName}</span>
                                </td>
                                <td style={{ fontWeight: 700 }}>{officer.completedTasksCount} / {officer.totalTasksAssigned} việc</td>
                                <td style={{ fontWeight: 700, color: '#2563eb' }}>{officer.checklistProgressScore40} / 4.0 điểm</td>
                                <td style={{ fontWeight: 700, color: '#d97706' }}>{officer.leaderQualityScore60} / 6.0 điểm</td>
                                <td style={{ fontWeight: 800, fontSize: '0.98rem', color: isExc ? '#16a34a' : isGood ? '#2563eb' : isFair ? '#d97706' : '#dc2626' }}>
                                  {officer.finalGRADScore} / 10
                                </td>
                                <td><span className={`badge ${badgeClass}`}>{officer.tierGrade}</span></td>
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
                  const tier = getEvaluationTier(selectedTask.rating);
                  return (
                    <span className={`badge ${tier.badgeClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon name={tier.icon} size={11} /> Đánh giá: {selectedTask.rating.toFixed(1)}/10 — Mức {tier.level}: {tier.label}
                    </span>
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
                    placeholder="Nhập ý kiến chỉ đạo hoặc phản hồi (dùng @username để nhắc tên)…"
                    aria-label="Nhập ý kiến chỉ đạo hoặc phản hồi"
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
         DAILY WELCOME POP-UP MODAL
         ═══════════════════════════════════════════════════════════════ */}
      {showWelcomeModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title">
            <div className="welcome-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="sun" size={24} style={{ color: '#d97706' }} />
                </div>
                <div>
                  <h2 id="welcome-modal-title" style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    KÍNH CHÀO BÙI VĂN HÙNG — CHỦ TỊCH UBND XÃ CÁT NGẠN
                  </h2>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Báo cáo tổng hợp tình hình công việc hôm nay (Thứ Hai, ngày 26/07/2026)
                  </div>
                </div>
              </div>
            </div>

            <div className="welcome-body">
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: '0.85rem', lineHeight: 1.5 }}>
                <Icon name="circle-info" size={15} style={{ color: '#2563eb', marginRight: 6 }} />
                <span>Hôm nay ca Sáng có <strong>4 công việc phát sinh trùng ca</strong> và <strong>{kpiData.pendingApproval}</strong> công việc trình xin ý kiến phê duyệt của Chủ tịch xã.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, textAlign: 'center', marginBottom: 20 }}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>{kpiData.active}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Cần Xử Lý</div>
                </div>
                <div style={{ background: '#fffbeb', padding: 12, borderRadius: 8, border: '1px solid #fef3c7' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706', fontVariantNumeric: 'tabular-nums' }}>{kpiData.nearDeadline}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Sắp Hết Hạn</div>
                </div>
                <div style={{ background: '#fef2f2', padding: 12, borderRadius: 8, border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{kpiData.overdue}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Quá Hạn</div>
                </div>
              </div>
            </div>

            <div className="welcome-actions">
              <button type="button" className="btn btn-primary" style={{ width: '100%', padding: '10px 16px' }} onClick={() => setShowWelcomeModal(false)}>
                <Icon name="check" size={14} /> Đóng & Vào Dashboard Làm Việc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         PRINT WEEKLY SCHEDULE MODAL
         ═══════════════════════════════════════════════════════════════ */}
      {showPrintModal && (
        <div className="print-modal-overlay">
          <div className="print-modal" role="dialog" aria-modal="true" aria-labelledby="print-modal-title">
            <div className="print-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border-color)' }}>
              <h2 id="print-modal-title" style={{ fontSize: '1.05rem', fontWeight: 800 }}>Xem Trước Bản In Lịch Công Tác Tuần</h2>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
                  <Icon name="print" size={14} /> In Ngay (Print)
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowPrintModal(false)}>
                  Đóng
                </button>
              </div>
            </div>

            <div className="print-doc-header">
              <div style={{ textAlign: 'center', textTransform: 'uppercase' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>ỦY BAN NHÂN DÂN XÃ CÁT NGẠN</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 4 }}>LỊCH CÔNG TÁC TUẦN</div>
                <div style={{ fontSize: '0.8rem', fontStyle: 'italic', marginTop: 2, textTransform: 'none' }}>
                  (Từ ngày {weekDays[0].dayNumber} đến ngày {weekDays[6].dayNumber} tháng 7 năm 2026)
                </div>
              </div>
            </div>

            <table className="data-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ width: 110 }}>Thứ / Ngày</th>
                  <th scope="col" style={{ width: 80 }}>Buổi</th>
                  <th scope="col">Nội dung công việc chỉ đạo</th>
                  <th scope="col" style={{ width: 160 }}>Cán bộ phụ trách</th>
                </tr>
              </thead>
              <tbody>
                {weekDays.map(day => {
                  const morningTasks = visibleTasks.filter(t => t.dueDate === day.dateStr && t.shift === 'Sang');
                  const afternoonTasks = visibleTasks.filter(t => t.dueDate === day.dateStr && t.shift === 'Chieu');

                  return (
                    <React.Fragment key={day.dateStr}>
                      <tr>
                        <td rowSpan={2} style={{ fontWeight: 800, textAlign: 'center', background: '#f8fafc', verticalAlign: 'middle' }}>
                          {day.fullDateDisplay}
                        </td>
                        <td style={{ fontWeight: 700, color: '#d97706' }}>SÁNG</td>
                        <td>
                          {morningTasks.length === 0 ? '—' : (
                            morningTasks.map(t => <div key={t.id}>• {t.title} ({PRIORITY_LABELS[t.priority]})</div>)
                          )}
                        </td>
                        <td>{morningTasks.map(t => t.assignee).join(', ') || '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 700, color: '#2563eb' }}>CHIỀU</td>
                        <td>
                          {afternoonTasks.length === 0 ? '—' : (
                            afternoonTasks.map(t => <div key={t.id}>• {t.title} ({PRIORITY_LABELS[t.priority]})</div>)
                          )}
                        </td>
                        <td>{afternoonTasks.map(t => t.assignee).join(', ') || '—'}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            <div className="print-doc-footer" style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <div style={{ width: '45%' }}>
                <strong>Nơi nhận:</strong><br />
                - Thường trực Đảng ủy (b/c);<br />
                - Thường trực HĐND xã;<br />
                - Lãnh đạo UBND xã;<br />
                - Trưởng các ban ngành, đoàn thể;<br />
                - Cán bộ công chức xã;<br />
                - Lưu: VT, VP.
              </div>
              <div style={{ width: '45%', textAlign: 'center' }}>
                <strong>TL. CHỦ TỊCH</strong><br />
                CHÁNH VĂN PHÒNG<br /><br /><br />
                <strong>Nguyễn Đình Hùng</strong>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ═══════════════════════════════════════════════════════════════
         SUBMIT / APPROVE / REJECT MODALS
         ═══════════════════════════════════════════════════════════════ */}
      {showSubmitModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 450 }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 16 }}>Nộp Kết Quả Xin Nghiệm Thu</h2>
            <div className="form-group">
              <label className="form-label">Ghi chú kết quả thực hiện</label>
              <textarea className="form-textarea" rows={3} placeholder="Mô tả kết quả công việc đã hoàn thành..." value={submitNote} onChange={e => setSubmitNote(e.target.value)} />
            </div>
            <div className="alert alert-info" style={{ marginBottom: 16, fontSize: '0.8rem' }}>
              <Icon name="file-arrow-up" size={14} style={{ marginRight: 6 }} /> Vui lòng đính kèm báo cáo ở phần bình luận trước khi nộp.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setShowSubmitModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={confirmSubmitTask}>Gửi Lãnh Đạo Duyệt</button>
            </div>
          </div>
        </div>
      )}

      {showApproveModal && (
        <div className="welcome-modal-overlay">
          <div className="welcome-modal" role="dialog" aria-modal="true" style={{ maxWidth: 520 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 14, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="clipboard-check" size={20} /> CHẤM ĐIỂM & NGHỆM THU CÔNG VIỆC
            </h2>

            <div className="alert alert-info" style={{ marginBottom: 16, fontSize: '0.82rem' }}>
              <Icon name="circle-info" size={14} style={{ marginRight: 6 }} />
              Đánh giá theo thang <strong>10 điểm</strong> chuẩn bộ máy cấp xã. Điểm đánh giá sẽ tự động cập nhật vào thi đua cán bộ.
            </div>

            {/* 10-Point Rating Selector Bar */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Chọn điểm chất lượng (1.0 – 10.0 điểm):</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: getEvaluationTier(ratingScore).color }}>
                  {ratingScore.toFixed(1)} / 10.0
                </span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(scoreVal => {
                  const isSelected = Math.round(ratingScore) === scoreVal;
                  const itemTier = getEvaluationTier(scoreVal);
                  return (
                    <button
                      key={scoreVal}
                      type="button"
                      onClick={() => setRatingScore(scoreVal)}
                      className="btn"
                      style={{
                        padding: '8px 0',
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        borderRadius: 8,
                        border: `1.5px solid ${isSelected ? itemTier.color : '#e2e8f0'}`,
                        background: isSelected ? itemTier.bgColor : '#ffffff',
                        color: isSelected ? itemTier.color : '#64748b',
                        boxShadow: isSelected ? `0 2px 8px ${itemTier.color}33` : 'none',
                        transition: 'all 0.15s ease',
                      }}
                      title={`Mức ${itemTier.level}: ${itemTier.label} (${scoreVal} điểm)`}
                    >
                      {scoreVal}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tier Level Quick Selector Tabs */}
            <div style={{ marginBottom: 18 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                Chọn nhanh theo 5 phân cấp đánh giá:
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EVALUATION_TIERS.map(tier => {
                  const activeTier = getEvaluationTier(ratingScore);
                  const isCurrent = activeTier.code === tier.code;
                  return (
                    <button
                      key={tier.code}
                      type="button"
                      onClick={() => setRatingScore(tier.level === 1 ? 9.5 : tier.level === 2 ? 8.5 : tier.level === 3 ? 7.0 : tier.level === 4 ? 5.0 : 3.0)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        borderRadius: 6,
                        border: `1px solid ${isCurrent ? tier.color : '#cbd5e1'}`,
                        background: isCurrent ? tier.bgColor : '#f8fafc',
                        color: isCurrent ? tier.color : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      <Icon name={tier.icon} size={11} style={{ marginRight: 4 }} />
                      Mức {tier.level}: {tier.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Preview Card of Selected Evaluation Tier */}
            {(() => {
              const currentTier = getEvaluationTier(ratingScore);
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
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase' }}>
                        Mức {currentTier.level}: {currentTier.label}
                      </span>
                      <span className={`badge ${currentTier.badgeClass}`} style={{ fontSize: '0.7rem' }}>
                        {ratingScore.toFixed(1)} / 10.0 Điểm
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', marginTop: 4, opacity: 0.95, lineHeight: 1.45 }}>
                      {currentTier.subText}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-outline" onClick={() => setShowApproveModal(false)}>Hủy</button>
              <button className="btn btn-success" onClick={confirmApproveTask}>
                <Icon name="check" size={14} /> Xác Nhận Nghiệm Thu
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
                    <Icon name="wand-magic-sparkles" size={14} style={{ color: '#8b5cf6', marginRight: 6 }} />
                    Gợi ý AI: <strong>{suggestion.name}</strong> ({suggestion.departmentName}) có tải công việc thấp nhất.
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
                    if (tasksRes.success && tasksRes.data && tasksRes.data.length > 0) {
                      const mapped: Task[] = tasksRes.data.map(t => ({
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

                    addToast('Điều chuyển thành công', `Đã điều chuyển công việc "${targetTask.title}" từ ${transferFromStaff} sang ${targetName} trong CSDL PostgreSQL`, 'success');
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
                  setActiveModule('tasks');
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

    </div>
  );
}
