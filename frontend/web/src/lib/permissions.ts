/**
 * Permission & Scope System — Hệ thống Phân Quyền & Phạm Vi Tác Nghiệp
 * Chuẩn hóa RBAC và Data Scoping cho chính quyền cấp xã (UBND Xã Cát Ngạn)
 */

import { RoleCode, ROLE_HIERARCHY } from '../services/role-hierarchy.service';

export type Scope = 'Organization' | 'Department' | 'Personal';

export type Permission =
  | 'ViewExecutiveDashboard'
  | 'ViewDepartmentDashboard'
  | 'ViewOwnDashboard'
  | 'ViewDocuments'
  | 'UploadDocument'
  | 'ApproveDocument'
  | 'AssignTask'
  | 'TransferTask'
  | 'EvaluateOfficer'
  | 'ManageDepartments'
  | 'ManageUsers';

export interface UserContext {
  userId?: string;
  fullName?: string;
  activeRole: RoleCode;
  departmentId?: string;
  departmentCode?: string;
}

/**
 * Danh mục quyền hạn chi tiết gắn liền với từng vai trò công vụ
 */
export const ROLE_PERMISSIONS: Record<RoleCode, { scope: Scope[]; permissions: Permission[] }> = {
  // ── 1. BÍ THƯ ĐẢNG ỦY (Toàn diện hệ thống chính trị xã) ──
  BiThu: {
    scope: ['Organization', 'Department', 'Personal'],
    permissions: [
      'ViewExecutiveDashboard',
      'ViewDepartmentDashboard',
      'ViewOwnDashboard',
      'ViewDocuments',
      'UploadDocument',
      'ApproveDocument',
      'AssignTask',
      'TransferTask',
      'EvaluateOfficer',
      'ManageDepartments',
      'ManageUsers',
    ],
  },
  BiThuDU: {
    scope: ['Organization', 'Department', 'Personal'],
    permissions: [
      'ViewExecutiveDashboard',
      'ViewDepartmentDashboard',
      'ViewOwnDashboard',
      'ViewDocuments',
      'UploadDocument',
      'ApproveDocument',
      'AssignTask',
      'TransferTask',
      'EvaluateOfficer',
      'ManageDepartments',
      'ManageUsers',
    ],
  },

  // ── 2. CHỦ TỊCH UBND / HĐND (Lãnh đạo cao nhất chính quyền) ──
  ChuTichUBND: {
    scope: ['Organization', 'Department', 'Personal'],
    permissions: [
      'ViewExecutiveDashboard',
      'ViewDepartmentDashboard',
      'ViewOwnDashboard',
      'ViewDocuments',
      'UploadDocument',
      'ApproveDocument',
      'AssignTask',
      'TransferTask',
      'EvaluateOfficer',
      'ManageDepartments',
      'ManageUsers',
    ],
  },
  ChuTichHDND: {
    scope: ['Organization', 'Department', 'Personal'],
    permissions: [
      'ViewExecutiveDashboard',
      'ViewDepartmentDashboard',
      'ViewOwnDashboard',
      'ViewDocuments',
      'UploadDocument',
      'ApproveDocument',
      'AssignTask',
      'TransferTask',
      'EvaluateOfficer',
      'ManageDepartments',
      'ManageUsers',
    ],
  },

  // ── 3. PHÓ CHỦ TỊCH UBND / HĐND (Lãnh đạo phụ trách khối / Chánh VP / GĐ TTPHCC) ──
  PhoChuTichUBND: {
    scope: ['Organization', 'Department', 'Personal'],
    permissions: [
      'ViewExecutiveDashboard',
      'ViewDepartmentDashboard',
      'ViewOwnDashboard',
      'ViewDocuments',
      'UploadDocument',
      'ApproveDocument',
      'AssignTask',
      'TransferTask',
      'EvaluateOfficer',
      'ManageDepartments',
      'ManageUsers',
    ],
  },
  PhoChuTichUBND_ChanhVP: {
    scope: ['Organization', 'Department', 'Personal'],
    permissions: [
      'ViewExecutiveDashboard',
      'ViewDepartmentDashboard',
      'ViewOwnDashboard',
      'ViewDocuments',
      'UploadDocument',
      'ApproveDocument',
      'AssignTask',
      'TransferTask',
      'EvaluateOfficer',
      'ManageDepartments',
      'ManageUsers',
    ],
  },
  PhoChuTichUBND_TTPHCC: {
    scope: ['Organization', 'Department', 'Personal'],
    permissions: [
      'ViewExecutiveDashboard',
      'ViewDepartmentDashboard',
      'ViewOwnDashboard',
      'ViewDocuments',
      'UploadDocument',
      'ApproveDocument',
      'AssignTask',
      'TransferTask',
      'EvaluateOfficer',
      'ManageDepartments',
      'ManageUsers',
    ],
  },
  PhoChuTichHDND: {
    scope: ['Organization', 'Department', 'Personal'],
    permissions: [
      'ViewExecutiveDashboard',
      'ViewDepartmentDashboard',
      'ViewOwnDashboard',
      'ViewDocuments',
      'UploadDocument',
      'ApproveDocument',
      'AssignTask',
      'TransferTask',
      'EvaluateOfficer',
      'ManageDepartments',
      'ManageUsers',
    ],
  },

  // ── 4. TRƯỞNG PHÒNG CHUYÊN MÔN / TRƯỞNG BAN HĐND ──
  TruongPhong: {
    scope: ['Department', 'Personal'],
    permissions: [
      'ViewDepartmentDashboard',
      'ViewOwnDashboard',
      'ViewDocuments',
      'UploadDocument',
      'AssignTask',
      'TransferTask',
      'EvaluateOfficer',
      'ManageUsers',
    ],
  },

  // ── 5. PHÓ TRƯỞNG PHÒNG / PHÓ TRƯỞNG BAN ──
  PhoPhong: {
    scope: ['Department', 'Personal'],
    permissions: [
      'ViewDepartmentDashboard',
      'ViewOwnDashboard',
      'ViewDocuments',
      'UploadDocument',
      'AssignTask',
      'TransferTask',
      'EvaluateOfficer',
    ],
  },

  // ── 6. CHUYÊN VIÊN / CÔNG CHỨC THỰC THI (Không có quyền giao việc / thẩm định) ──
  ChuyenVien: {
    scope: ['Personal'],
    permissions: [
      'ViewOwnDashboard',
      'ViewDocuments',
      'UploadDocument',
    ],
  },
};

/**
 * Kiểm tra xem vai trò hoặc người dùng hiện tại có quyền thực thi tác vụ hay không.
 * @param permission Tên quyền cần kiểm tra
 * @param roleOrUser Vai trò (RoleCode) hoặc UserContext hiện tại
 */
export function hasPermission(permission: Permission, roleOrUser?: RoleCode | UserContext | null): boolean {
  if (!roleOrUser) return false;

  const role: RoleCode = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser.activeRole;
  const config = ROLE_PERMISSIONS[role];
  if (!config) return false;

  return config.permissions.includes(permission);
}

/**
 * Kiểm tra phạm vi dữ liệu mà vai trò hoặc người dùng được phép truy cập
 */
export function hasScope(scope: Scope, roleOrUser?: RoleCode | UserContext | null): boolean {
  if (!roleOrUser) return false;

  const role: RoleCode = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser.activeRole;
  const config = ROLE_PERMISSIONS[role];
  if (!config) return false;

  return config.scope.includes(scope);
}

/**
 * Tạo hàm can() tiện dụng cho các React Component và Layout
 */
export function createPermissionChecker(roleOrUser?: RoleCode | UserContext | null) {
  return {
    can: (permission: Permission) => hasPermission(permission, roleOrUser),
    hasScope: (scope: Scope) => hasScope(scope, roleOrUser),
    role: typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.activeRole || 'ChuyenVien',
    isLeader: () => {
      const r = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.activeRole;
      if (!r) return false;
      return ROLE_HIERARCHY[r]?.scopeLevel <= 2.0;
    },
    isManagerPlus: () => {
      const r = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.activeRole;
      if (!r) return false;
      return ROLE_HIERARCHY[r]?.scopeLevel <= 3.0;
    },
    isOfficerOnly: () => {
      const r = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.activeRole;
      if (!r) return true;
      return ROLE_HIERARCHY[r]?.scopeLevel >= 4.0;
    },
  };
}
