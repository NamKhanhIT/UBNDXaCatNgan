import { apiFetch, ApiResponse, storeToken, storeRefreshToken, getStoredRefreshToken, clearToken, needsBearerAuth } from './api.config';

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

export interface UserRoleDto {
  roleCode: string;
  roleName: string;
  departmentName?: string;
  isPrimary: boolean;
}

export interface AuthUser {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  activeRole: string;
  availableRoles: UserRoleDto[];
  token?: string;
  /** Tài khoản đã bật xác thực 2 yếu tố (MFA) */
  mfaEnabled?: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  /** Yêu cầu xác thực 2 yếu tố (MFA) — cần nhập mã OTP */
  requiresMfa?: boolean;
  /** Token tạm cho bước xác thực OTP (hết hạn sau 5 phút) */
  mfaToken?: string;
}

/**
 * Xác thực đăng nhập qua API backend thật (/api/v1/Auth/login)
 * - Desktop localhost: backend set cookie httpOnly "access_token"
 * - Mobile/Remote (Cloudflare, IP LAN): backend trả token trong body → lưu vào localStorage
 */
export async function authenticateUser(usernameOrEmail: string, password: string): Promise<AuthResult> {
  if (!usernameOrEmail || !usernameOrEmail.trim()) {
    return { success: false, error: 'Vui lòng nhập tên đăng nhập / email công vụ.' };
  }
  if (!password || !password.trim()) {
    return { success: false, error: 'Vui lòng nhập mật khẩu xác thực.' };
  }

  const res = await apiFetch<AuthUser>('/api/v1/Auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: usernameOrEmail.trim(),
      password: password
    }),
  });

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản và mật khẩu.',
    };
  }

  // Tài khoản đã bật MFA → chuyển sang bước nhập mã OTP
  if ((res.data as any).mfaRequired) {
    return {
      success: true,
      requiresMfa: true,
      mfaToken: (res.data as any).mfaToken || '',
    };
  }

  // Nếu là mobile/remote và backend trả token trong body → lưu vào localStorage
  const token = res.token || res.data.token;
  const refreshToken = (res as any).refreshToken;
  if (needsBearerAuth() && token) {
    storeToken(token);
  }
  if (needsBearerAuth() && refreshToken) {
    storeRefreshToken(refreshToken);
  }

  return {
    success: true,
    user: res.data,
  };
}

/**
 * Hoàn tất đăng nhập 2 bước: gửi mã OTP để nhận token đầy đủ
 */
export async function verifyMfaLogin(mfaToken: string, code: string): Promise<AuthResult> {
  const res = await apiFetch<AuthUser>('/api/v1/Auth/mfa/verify-login', {
    method: 'POST',
    body: JSON.stringify({ mfaToken, code }),
  });

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error || 'Mã OTP không hợp lệ.',
    };
  }

  const token = res.token || res.data.token;
  const refreshToken = (res as any).refreshToken;
  if (needsBearerAuth() && token) {
    storeToken(token);
  }
  if (needsBearerAuth() && refreshToken) {
    storeRefreshToken(refreshToken);
  }

  return {
    success: true,
    user: res.data,
  };
}

/**
 * Bước 1 bật MFA: sinh secret TOTP + URI quét QR
 */
export async function mfaSetup(): Promise<{ secret: string; provisioningUri: string }> {
  const res = await apiFetch<{ secret: string; provisioningUri: string }>('/api/v1/Auth/mfa/setup', {
    method: 'POST',
  });
  if (!res.success || !res.data) {
    throw new Error(res.error || 'Không thể tạo mã xác thực 2 yếu tố.');
  }
  return res.data;
}

/**
 * Bước 2 bật MFA: xác nhận mã OTP đầu tiên
 */
export async function mfaEnable(secret: string, code: string): Promise<boolean> {
  const res = await apiFetch('/api/v1/Auth/mfa/enable', {
    method: 'POST',
    body: JSON.stringify({ secret, code }),
  });
  if (!res.success) {
    throw new Error(res.error || 'Không thể bật xác thực 2 yếu tố.');
  }
  return true;
}

/**
 * Tắt MFA — yêu cầu mã OTP hiện tại
 */
export async function mfaDisable(code: string): Promise<boolean> {
  const res = await apiFetch('/api/v1/Auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  if (!res.success) {
    throw new Error(res.error || 'Không thể tắt xác thực 2 yếu tố.');
  }
  return true;
}

/**
 * Kiểm tra phiên làm việc hiện tại từ backend (/api/v1/Auth/me)
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const res = await apiFetch<AuthUser>('/api/v1/Auth/me', {
    method: 'GET',
  });

  if (res.success && res.data) {
    return res.data;
  }
  return null;
}

/**
 * Chuyển đổi ngữ cảnh vai trò (/api/v1/Auth/switch-context)
 */
export async function switchContext(userId: string, targetRoleCode: string): Promise<AuthResult> {
  const res = await apiFetch<AuthUser>('/api/v1/Auth/switch-context', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      targetRoleCode
    })
  });

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error || 'Không thể chuyển ngữ cảnh.',
    };
  }

  // Cập nhật token mới khi switch context (nếu là remote/mobile)
  const token = res.token || res.data.token;
  const refreshToken = (res as any).refreshToken;
  if (needsBearerAuth() && token) {
    storeToken(token);
  }
  if (needsBearerAuth() && refreshToken) {
    storeRefreshToken(refreshToken);
  }

  return {
    success: true,
    user: res.data
  };
}

/**
 * Đăng xuất (/api/v1/Auth/logout) — thu hồi refresh token phía server
 */
export async function logoutUser(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  const res = await apiFetch('/api/v1/Auth/logout', {
    method: 'POST',
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  });

  // Xóa token khỏi localStorage nếu là remote/mobile
  if (needsBearerAuth()) {
    clearToken();
  }

  return res.success;
}
