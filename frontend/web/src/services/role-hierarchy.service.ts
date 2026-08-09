/**
 * Role Hierarchy Service — Quản lý phân cấp vai trò & quyền hạn
 *
 * Cơ cấu tổ chức bộ máy chính quyền cấp xã (theo quy định):
 *
 * HĐND:
 *   - Chủ tịch HĐND (kiêm nhiệm)
 *   - Phó Chủ tịch HĐND (chuyên trách)
 *   - Các Ban HĐND: Trưởng ban (kiêm nhiệm) + Phó Trưởng ban (chuyên trách)
 *
 * UBND:
 *   - Chủ tịch UBND (chuyên trách)
 *   - Phó CT UBND kiêm Chánh VP HĐND&UBND (quản lý Văn phòng + liên cơ quan)
 *   - Phó CT UBND kiêm GĐ Trung tâm Phục vụ Hành chính công
 *   - Các phòng: Trưởng phòng (chuyên trách/kiêm nhiệm) + Phó Trưởng phòng (chuyên trách)
 *
 * ĐẢNG ỦY:
 *   - Bí thư Đảng ủy (cao nhất về lãnh đạo Đảng)
 *
 * Phân cấp ScopeLevel (số càng nhỏ = quyền càng cao):
 *   1.0 = Bí thư Đảng ủy
 *   1.5 = Chủ tịch UBND / Chủ tịch HĐND
 *   2.0 = Phó Chủ tịch UBND / Phó Chủ tịch HĐND
 *   2.5 = Trưởng phòng / Trưởng Ban HĐND
 *   3.0 = Phó Trưởng phòng / Phó Trưởng Ban HĐND
 *   4.0 = Chuyên viên / Cán bộ (KHÔNG giao việc)
 *
 * Quy tắc giao việc:
 *   - Chỉ giao XUỐNG DƯỚI (scopeLevel người giao < scopeLevel người nhận)
 *   - Không giao ngang cấp, không giao lên trên
 *   - Phó CT UBND (kiêm Chánh VP): phạm vi toàn UBND
 *   - Phó CT UBND (kiêm GĐ TTPHCC): phạm vi TT PHCC
 *   - Phó CT HĐND: phạm vi các Ban HĐND
 *   - Trưởng/Phó phòng: chỉ nội bộ phòng/ban mình
 */

export type RoleCode =
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

export type DepartmentCode =
  | 'VAN_PHONG'
  | 'KINH_TE'
  | 'VAN_HOA_XA_HOI'
  | 'HANH_CHINH_CONG'
  | 'KHOI_DANG_DOAN_THE'
  | 'HDND_BAN_KINH_TE'
  | 'HDND_BAN_PHAP_CHE';

export type OrgScope = 'TOAN_XA' | 'UBND' | 'HDND' | 'TTPHCC' | 'PHONG_BAN';

export interface RoleConfig {
  code: RoleCode;
  label: string;
  shortLabel: string;
  org: string;
  scopeLevel: number; // 1.0-1.5=lãnh đạo, 2.0=phó CT, 2.5=trưởng phòng, 3.0=phó phòng, 4.0=chuyên viên
  orgScope: OrgScope; // phạm vi tổ chức được quản lý
  departmentCode?: DepartmentCode;
}

export const ROLE_HIERARCHY: Record<RoleCode, RoleConfig> = {
  // ── CẤP 1.0: BÍ THƯ ĐẢNG ỦY ──
  BiThu: {
    code: 'BiThu',
    label: 'Bí thư Đảng ủy xã',
    shortLabel: 'BT ĐU',
    org: 'Đảng ủy Xã Cát Ngạn',
    scopeLevel: 1.0,
    orgScope: 'TOAN_XA',
  },
  BiThuDU: {
    code: 'BiThuDU',
    label: 'Bí thư Đảng ủy xã',
    shortLabel: 'BT ĐU',
    org: 'Đảng ủy Xã Cát Ngạn',
    scopeLevel: 1.0,
    orgScope: 'TOAN_XA',
  },

  // ── CẤP 1.5: CHỦ TỊCH ──
  ChuTichUBND: {
    code: 'ChuTichUBND',
    label: 'Chủ tịch UBND xã',
    shortLabel: 'CT UBND',
    org: 'UBND Xã Cát Ngạn',
    scopeLevel: 1.5,
    orgScope: 'UBND',
  },
  ChuTichHDND: {
    code: 'ChuTichHDND',
    label: 'Chủ tịch HĐND xã',
    shortLabel: 'CT HĐND',
    org: 'HĐND Xã Cát Ngạn',
    scopeLevel: 1.5,
    orgScope: 'HDND',
  },

  // ── CẤP 2.0: PHÓ CHỦ TỊCH ──
  PhoChuTichUBND: {
    code: 'PhoChuTichUBND',
    label: 'Phó Chủ tịch UBND xã',
    shortLabel: 'PCT UBND',
    org: 'UBND Xã Cát Ngạn',
    scopeLevel: 2.0,
    orgScope: 'UBND',
  },
  PhoChuTichUBND_ChanhVP: {
    code: 'PhoChuTichUBND_ChanhVP',
    label: 'Phó Chủ tịch UBND (kiêm Chánh VP HĐND&UBND)',
    shortLabel: 'PCT UBND - CVP',
    org: 'UBND Xã Cát Ngạn',
    scopeLevel: 2.0,
    orgScope: 'UBND',
    departmentCode: 'VAN_PHONG',
  },
  PhoChuTichUBND_TTPHCC: {
    code: 'PhoChuTichUBND_TTPHCC',
    label: 'Phó Chủ tịch UBND (kiêm GĐ Trung tâm PHCC)',
    shortLabel: 'PCT UBND - TTPHCC',
    org: 'UBND Xã Cát Ngạn',
    scopeLevel: 2.0,
    orgScope: 'TTPHCC',
    departmentCode: 'HANH_CHINH_CONG',
  },
  PhoChuTichHDND: {
    code: 'PhoChuTichHDND',
    label: 'Phó Chủ tịch HĐND xã (chuyên trách)',
    shortLabel: 'PCT HĐND',
    org: 'HĐND Xã Cát Ngạn',
    scopeLevel: 2.0,
    orgScope: 'HDND',
  },

  // ── CẤP 2.5: TRƯỞNG PHÒNG / TRƯỞNG BAN ──
  TruongPhong: {
    code: 'TruongPhong',
    label: 'Trưởng phòng',
    shortLabel: 'TP',
    org: 'Phòng/Ban trực thuộc',
    scopeLevel: 2.5,
    orgScope: 'PHONG_BAN',
    departmentCode: 'KINH_TE',
  },

  // ── CẤP 3.0: PHÓ TRƯỞNG PHÒNG / PHÓ TRƯỞNG BAN ──
  PhoPhong: {
    code: 'PhoPhong',
    label: 'Phó Trưởng phòng',
    shortLabel: 'PTP',
    org: 'Phòng/Ban trực thuộc',
    scopeLevel: 3.0,
    orgScope: 'PHONG_BAN',
    departmentCode: 'KINH_TE',
  },

  // ── CẤP 4.0: CHUYÊN VIÊN / CÁN BỘ ──
  ChuyenVien: {
    code: 'ChuyenVien',
    label: 'Chuyên viên',
    shortLabel: 'CV',
    org: 'Văn phòng HĐND & UBND',
    scopeLevel: 4.0,
    orgScope: 'PHONG_BAN',
    departmentCode: 'VAN_PHONG',
  },
};

/**
 * Bảng ánh xạ nhân viên ↔ vai trò theo tên (dùng cho mock data).
 * Khi có CSDL thật, thay bằng query từ DB.
 */
export const STAFF_ROLE_MAP: Record<string, RoleCode> = {
  // Đảng ủy
  'Trần Văn Nam': 'BiThuDU',
  // UBND
  'Nguyễn Đình Hùng': 'ChuTichUBND',
  'Lê Văn Bình': 'PhoChuTichUBND_ChanhVP',
  'Nguyễn Thị Lan': 'PhoChuTichUBND_TTPHCC',
  // HĐND
  'Lê Thị Hồng': 'ChuTichHDND',
  'Phạm Văn Đức': 'PhoChuTichHDND',
  // Trưởng phòng
  'Trần Thị Mai': 'TruongPhong',
  'Hoàng Văn Thái': 'TruongPhong',
  // Phó phòng
  'Đặng Văn Lộc': 'PhoPhong',
  // Chuyên viên
  'Nguyễn Văn Nam': 'ChuyenVien',
  'Lê Hoàng Anh': 'ChuyenVien',
  'Phạm Đức Minh': 'ChuyenVien',
  'Vũ Thị Hương': 'ChuyenVien',
};

/**
 * Nhận diện scopeLevel từ nhãn chức danh (dùng khi chỉ có label string).
 */
export function getScopeLevelByRoleLabel(roleLabel: string): number {
  if (roleLabel.includes('Bí thư')) return 1.0;
  if (roleLabel.includes('Chủ tịch UBND') || roleLabel.includes('Chủ tịch HĐND')) return 1.5;
  if (roleLabel.includes('Phó Chủ tịch') || roleLabel.includes('Phó chủ tịch')) return 2.0;
  if (
    roleLabel.includes('Trưởng phòng') ||
    roleLabel.includes('Trưởng Ban') ||
    roleLabel.includes('Chánh Văn phòng') ||
    roleLabel.includes('Giám đốc Trung tâm')
  ) return 2.5;
  if (
    roleLabel.includes('Phó Trưởng phòng') ||
    roleLabel.includes('Phó Trưởng Ban') ||
    roleLabel.includes('Phó phòng')
  ) return 3.0;
  return 4.0;
}

/**
 * Kiểm tra quyền giao việc: assigner.scopeLevel < assignee.scopeLevel.
 * Quy tắc: chỉ giao XUỐNG dưới; không giao ngang cấp, không giao lên trên.
 */
export function canAssignTo(assignerRole: RoleCode, assigneeRole: RoleCode): boolean {
  const assigner = ROLE_HIERARCHY[assignerRole];
  const assignee = ROLE_HIERARCHY[assigneeRole];
  if (!assigner || !assignee) return false;
  return assigner.scopeLevel < assignee.scopeLevel;
}

export function canAssignToByName(assignerRole: RoleCode, assigneeName: string): boolean {
  const assigneeRole = STAFF_ROLE_MAP[assigneeName];
  if (!assigneeRole) {
    // Unknown staff → treat as chuyên viên (4.0)
    return ROLE_HIERARCHY[assignerRole].scopeLevel < 4.0;
  }
  return canAssignTo(assignerRole, assigneeRole);
}

export function getAssignableStaff<T extends { name: string }>(
  currentRole: RoleCode,
  allStaff: T[]
): T[] {
  const currentScopeLevel = ROLE_HIERARCHY[currentRole].scopeLevel;
  return allStaff.filter(staff => {
    const staffRole = STAFF_ROLE_MAP[staff.name];
    if (!staffRole) return currentScopeLevel < 4.0;
    return currentScopeLevel < ROLE_HIERARCHY[staffRole].scopeLevel;
  });
}

/**
 * Kiểm tra quyền tạo/giao việc mới.
 * Chuyên viên (scopeLevel=4.0) KHÔNG được tạo hoặc giao việc.
 * Tất cả các chức danh lãnh đạo, Phó, Trưởng/Phó phòng đều được.
 */
export function canCreateTask(role: RoleCode): boolean {
  return ROLE_HIERARCHY[role].scopeLevel < 4.0;
}

/**
 * Kiểm tra quyền điều chuyển công việc.
 *
 * Quy tắc:
 * - Chuyên viên (4.0): KHÔNG được điều chuyển.
 * - Phó Trưởng phòng (3.0): KHÔNG thể điều chuyển công việc của cấp bằng hoặc cao hơn mình (Trưởng vẫn hơn Phó).
 * - Trưởng phòng (2.5) và Phó CT (2.0): chỉ điều chuyển nội bộ phòng/ban mình.
 * - Chủ tịch (1.5) và Bí thư (1.0): điều chuyển liên phòng.
 */
export function canTransferTask(
  currentRole: RoleCode,
  fromStaffDept: DepartmentCode,
  toStaffDept: DepartmentCode,
  fromStaffName?: string
): boolean {
  const config = ROLE_HIERARCHY[currentRole];

  // Chuyên viên không được điều chuyển
  if (config.scopeLevel >= 4.0) return false;

  // Không được điều chuyển công việc của người ngang cấp hoặc cao hơn
  if (fromStaffName) {
    const targetRole = STAFF_ROLE_MAP[fromStaffName];
    if (targetRole) {
      const targetLevel = ROLE_HIERARCHY[targetRole].scopeLevel;
      if (config.scopeLevel >= targetLevel) return false;
    }
  }

  // Trưởng/Phó phòng (2.5/3.0): chỉ nội bộ phòng
  if (config.scopeLevel >= 2.5) {
    return fromStaffDept === toStaffDept;
  }

  // Phó CT UBND kiêm GĐ TTPHCC: chỉ trong TTPHCC
  if (currentRole === 'PhoChuTichUBND_TTPHCC') {
    return fromStaffDept === 'HANH_CHINH_CONG' && toStaffDept === 'HANH_CHINH_CONG';
  }

  // Phó CT HĐND: chỉ các ban HĐND
  if (currentRole === 'PhoChuTichHDND') {
    const hdndDepts: DepartmentCode[] = ['HDND_BAN_KINH_TE', 'HDND_BAN_PHAP_CHE'];
    return hdndDepts.includes(fromStaffDept) && hdndDepts.includes(toStaffDept);
  }

  // Phó CT UBND kiêm Chánh VP + CT UBND + Bí thư: liên phòng tự do
  return true;
}

/**
 * Kiểm tra quyền duyệt báo cáo tiến độ.
 * Người duyệt phải có scopeLevel THẤP HƠN người nộp (tức là cấp cao hơn).
 */
export function canApproveReport(
  currentRole: RoleCode,
  submitterScopeLevel: number
): boolean {
  return ROLE_HIERARCHY[currentRole].scopeLevel < submitterScopeLevel;
}
