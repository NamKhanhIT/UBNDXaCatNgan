import { apiFetch, ApiResponse, storeToken, clearToken, needsBearerAuth } from './api.config';

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
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
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

  // Nếu là mobile/remote và backend trả token trong body → lưu vào localStorage
  const token = res.token || res.data.token;
  if (needsBearerAuth() && token) {
    storeToken(token);
  }

  return {
    success: true,
    user: res.data,
  };
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
  if (needsBearerAuth() && token) {
    storeToken(token);
  }

  return {
    success: true,
    user: res.data
  };
}

/**
 * Đăng xuất (/api/v1/Auth/logout)
 */
export async function logoutUser(): Promise<boolean> {
  const res = await apiFetch('/api/v1/Auth/logout', {
    method: 'POST',
  });

  // Xóa token khỏi localStorage nếu là remote/mobile
  if (needsBearerAuth()) {
    clearToken();
  }

  return res.success;
}
