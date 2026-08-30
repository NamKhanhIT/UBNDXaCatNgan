/**
 * Role Hierarchy Service — Quản lý phân cấp vai trò & quyền hạn
 *
 * Đồng bộ 1:1 với DB seed (bảng "Roles"):
 *   RankLevel 1 = Bí thư Đảng ủy (BiThuDU), Chủ tịch UBND (ChuTichUBND), Chủ tịch HĐND (ChuTichHDND)
 *   RankLevel 2 = Phó Chủ tịch UBND (PhoChuTichUBND)
 *   RankLevel 3 = Chánh Văn phòng (ChanhVanPhong), Trưởng phòng (TruongPhong)
 *   RankLevel 4 = Phó Trưởng phòng / Phó Chánh VP (PhoPhong)
 *   RankLevel 5 = Chuyên viên / Cán bộ chuyên môn (ChuyenVien)
 *
 * Quy tắc giao việc & điều chuyển:
 *   - Chỉ giao XUỐNG DƯỚI (rankLevel người giao < rankLevel người nhận)
 *   - Không giao ngang cấp, không giao lên trên
 *   - Rank 1 (Chủ tịch) & Rank 2 (Phó Chủ tịch): phạm vi toàn diện liên phòng thuộc UBND
 *   - Rank 3 (Chánh Văn phòng): quản lý Văn phòng HĐND & UBND, có quyền tham mưu điều phối liên phòng theo chỉ đạo Thường trực
 *   - Rank 3 (Trưởng phòng) & Rank 4 (Phó phòng): quản lý nội bộ phòng/ban chuyên môn mình
 *   - Rank 5 (Chuyên viên): KHÔNG giao việc, KHÔNG điều chuyển
 */

export type RoleCode =
  | 'BiThuDU'
  | 'ChuTichUBND'
  | 'ChuTichHDND'
  | 'PhoChuTichUBND'
  | 'ChanhVanPhong'
  | 'TruongPhong'
  | 'PhoPhong'
  | 'ChuyenVien';

export type DepartmentCode =
  | 'VAN_PHONG'
  | 'KINH_TE'
  | 'VAN_HOA_XA_HOI'
  | 'HANH_CHINH_CONG'
  | 'KHOI_DANG_DOAN_THE';

export type OrgScope = 'TOAN_XA' | 'UBND' | 'HDND' | 'TTPHCC' | 'PHONG_BAN';

export interface RoleConfig {
  code: RoleCode;
  label: string;
  shortLabel: string;
  org: string;
  rankLevel: number; // Integer 1-5, khớp DB. Số nhỏ = quyền cao hơn.
  orgScope: OrgScope; // phạm vi tổ chức được quản lý
  departmentCode?: DepartmentCode;
}

export const ROLE_HIERARCHY: Record<RoleCode, RoleConfig> = {
  // ── RANK 1: LÃNH ĐẠO CAO NHẤT ──
  BiThuDU: {
    code: 'BiThuDU',
    label: 'Bí thư Đảng ủy',
    shortLabel: 'Bí thư',
    org: 'UBND Cấp Xã',
    rankLevel: 1,
    orgScope: 'TOAN_XA',
  },
  ChuTichUBND: {
    code: 'ChuTichUBND',
    label: 'Chủ tịch UBND xã',
    shortLabel: 'Chủ tịch UBND',
    org: 'UBND Cấp Xã',
    rankLevel: 1,
    orgScope: 'UBND',
  },
  ChuTichHDND: {
    code: 'ChuTichHDND',
    label: 'Chủ tịch HĐND xã',
    shortLabel: 'Chủ tịch HĐND',
    org: 'UBND Cấp Xã',
    rankLevel: 1,
    orgScope: 'HDND',
  },

  // ── RANK 2: PHÓ CHỦ TỊCH UBND ──
  PhoChuTichUBND: {
    code: 'PhoChuTichUBND',
    label: 'Phó Chủ tịch UBND xã',
    shortLabel: 'Phó CT UBND',
    org: 'UBND Cấp Xã',
    rankLevel: 2,
    orgScope: 'UBND',
  },

  // ── RANK 3: CHÁNH VĂN PHÒNG & TRƯỞNG PHÒNG ──
  ChanhVanPhong: {
    code: 'ChanhVanPhong',
    label: 'Chánh Văn phòng HĐND & UBND',
    shortLabel: 'Chánh VP',
    org: 'Văn phòng HĐND & UBND',
    rankLevel: 3,
    orgScope: 'PHONG_BAN',
    departmentCode: 'VAN_PHONG',
  },
  TruongPhong: {
    code: 'TruongPhong',
    label: 'Trưởng phòng chuyên môn',
    shortLabel: 'Trưởng phòng',
    org: 'Phòng/Ban trực thuộc',
    rankLevel: 3,
    orgScope: 'PHONG_BAN',
  },

  // ── RANK 4: PHÓ TRƯỞNG PHÒNG / PHÓ CHÁNH VP ──
  PhoPhong: {
    code: 'PhoPhong',
    label: 'Phó Trưởng phòng',
    shortLabel: 'Phó phòng',
    org: 'Phòng/Ban trực thuộc',
    rankLevel: 4,
    orgScope: 'PHONG_BAN',
  },

  // ── RANK 5: CHUYÊN VIÊN ──
  ChuyenVien: {
    code: 'ChuyenVien',
    label: 'Chuyên viên',
    shortLabel: 'Chuyên viên',
    org: 'UBND Cấp Xã',
    rankLevel: 5,
    orgScope: 'PHONG_BAN',
  },
};

/**
 * Fail-safe: lấy RoleConfig an toàn. Role không nhận diện → ChuyenVien (Rank 5).
 */
export function getRoleConfig(roleCode: string): RoleConfig {
  return ROLE_HIERARCHY[roleCode as RoleCode] ?? ROLE_HIERARCHY.ChuyenVien;
}

/**
 * Lấy rankLevel an toàn từ roleCode. Role không nhận diện → 5.
 */
export function getRankLevel(roleCode: string): number {
  return getRoleConfig(roleCode).rankLevel;
}

/**
 * Bảng ánh xạ nhân viên ↔ vai trò theo tên (dùng cho mock data).
 */
export const STAFF_ROLE_MAP: Record<string, RoleCode> = {
  // Đảng ủy
  'Phan Văn Hà': 'BiThuDU',
  // UBND
  'Nguyễn Đình Hùng': 'ChuTichUBND',
  'Nguyễn Văn Hoàng': 'PhoChuTichUBND',
  'Hoàng Đức Minh': 'ChanhVanPhong',
  // HĐND
  'Lê Thị Hồng': 'ChuTichHDND',
  // Trưởng phòng
  'Lê Văn Tùng': 'TruongPhong',
  'Trần Thị Mai': 'TruongPhong',
  // Phó phòng
  'Đặng Văn Lộc': 'PhoPhong',
  // Chuyên viên
  'Nguyễn Văn Nam': 'ChuyenVien',
  'Hoàng Thị Thu': 'ChuyenVien',
  'Phạm Văn Đức': 'ChuyenVien',
  'Lê Hoàng Anh': 'ChuyenVien',
  'Phạm Đức Minh': 'ChuyenVien',
  'Vũ Thị Hương': 'ChuyenVien',
};

/**
 * Nhận diện rankLevel từ nhãn chức danh (dùng khi chỉ có label string).
 */
export function getRankLevelByRoleLabel(roleLabel: string): number {
  if (roleLabel.includes('Bí thư')) return 1;
  if (roleLabel.includes('Chủ tịch UBND') || roleLabel.includes('Chủ tịch HĐND')) return 1;
  if (roleLabel.includes('Phó Chủ tịch') || roleLabel.includes('Phó chủ tịch')) return 2;
  if (
    roleLabel.includes('Chánh Văn phòng') ||
    roleLabel.includes('Chánh VP') ||
    roleLabel.includes('Trưởng phòng') ||
    roleLabel.includes('Trưởng Ban') ||
    roleLabel.includes('Giám đốc Trung tâm')
  ) return 3;
  if (
    roleLabel.includes('Phó Trưởng phòng') ||
    roleLabel.includes('Phó Chánh Văn phòng') ||
    roleLabel.includes('Phó Trưởng Ban') ||
    roleLabel.includes('Phó phòng')
  ) return 4;
  return 5;
}

/** @deprecated Dùng getRankLevelByRoleLabel() thay thế. */
export const getScopeLevelByRoleLabel = getRankLevelByRoleLabel;

/**
 * Kiểm tra quyền giao việc: assigner.rankLevel < assignee.rankLevel.
 * Quy tắc: chỉ giao XUỐNG dưới; không giao ngang cấp, không giao lên trên.
 */
export function canAssignTo(assignerRole: RoleCode, assigneeRole: RoleCode): boolean {
  const assigner = ROLE_HIERARCHY[assignerRole];
  const assignee = ROLE_HIERARCHY[assigneeRole];
  if (!assigner || !assignee) return false;
  return assigner.rankLevel < assignee.rankLevel;
}

export function canAssignToByName(assignerRole: RoleCode, assigneeName: string): boolean {
  const assigneeRole = STAFF_ROLE_MAP[assigneeName];
  if (!assigneeRole) {
    // Unknown staff → treat as chuyên viên (Rank 5)
    return ROLE_HIERARCHY[assignerRole].rankLevel < 5;
  }
  return canAssignTo(assignerRole, assigneeRole);
}

export function getAssignableStaff<T extends { name: string }>(
  currentRole: RoleCode,
  allStaff: T[]
): T[] {
  const currentRankLevel = ROLE_HIERARCHY[currentRole].rankLevel;
  return allStaff.filter(staff => {
    const staffRole = STAFF_ROLE_MAP[staff.name];
    if (!staffRole) return currentRankLevel < 5;
    return currentRankLevel < ROLE_HIERARCHY[staffRole].rankLevel;
  });
}

/**
 * Kiểm tra quyền tạo/giao việc mới.
 * Chuyên viên (rankLevel=5) KHÔNG được tạo hoặc giao việc.
 * Tất cả các chức danh lãnh đạo, Phó, Chánh VP, Trưởng/Phó phòng đều được.
 */
export function canCreateTask(role: RoleCode): boolean {
  return ROLE_HIERARCHY[role].rankLevel < 5;
}

/**
 * Kiểm tra quyền điều chuyển công việc.
 *
 * Quy tắc:
 * - Chuyên viên (5): KHÔNG được điều chuyển.
 * - Phó Trưởng phòng (4): KHÔNG thể điều chuyển công việc của cấp bằng hoặc cao hơn mình.
 * - Trưởng phòng chuyên môn (3): chỉ điều chuyển nội bộ phòng/ban mình.
 * - Chánh Văn phòng (3): điều chuyển nội bộ Văn phòng HĐND&UBND và có quyền tham mưu điều phối liên phòng theo chỉ đạo Thường trực UBND.
 * - Phó CT (2) và Chủ tịch (1): điều chuyển liên phòng toàn diện.
 */
export function canTransferTask(
  currentRole: RoleCode,
  fromStaffDept: DepartmentCode,
  toStaffDept: DepartmentCode,
  fromStaffName?: string
): boolean {
  const config = ROLE_HIERARCHY[currentRole];

  // Chuyên viên không được điều chuyển
  if (config.rankLevel >= 5) return false;

  // Không được điều chuyển công việc của người ngang cấp hoặc cao hơn
  if (fromStaffName) {
    const targetRole = STAFF_ROLE_MAP[fromStaffName];
    if (targetRole) {
      const targetLevel = ROLE_HIERARCHY[targetRole].rankLevel;
      if (config.rankLevel >= targetLevel) return false;
    }
  }

  // Chánh Văn phòng (Rank 3): điều phối liên phòng theo chỉ đạo Thường trực hoặc nội bộ Văn phòng
  if (currentRole === 'ChanhVanPhong') {
    return true;
  }

  // Trưởng/Phó phòng chuyên môn (3/4): chỉ nội bộ phòng mình
  if (config.rankLevel >= 3) {
    return fromStaffDept === toStaffDept;
  }

  // Lãnh đạo UBND (Rank 1, 2) + Bí thư (Rank 1): liên phòng tự do
  return true;
}

/**
 * Kiểm tra quyền duyệt báo cáo tiến độ.
 * Người duyệt phải có rankLevel THẤP HƠN người nộp (tức là cấp cao hơn).
 */
export function canApproveReport(
  currentRole: RoleCode,
  submitterRankLevel: number
): boolean {
  return ROLE_HIERARCHY[currentRole].rankLevel < submitterRankLevel;
}
