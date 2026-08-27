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

export type MfaChannel = 'totp' | 'email';

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
  //Tài khoản đã bật xác thực 2 yếu tố (MFA)
  mfaEnabled?: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
  //Yêu cầu xác thực 2 yếu tố (MFA) — cần nhập mã OTP
  requiresMfa?: boolean;
  //Token tạm cho bước xác thực OTP (hết hạn sau 5 phút)
  mfaToken?: string;
}

//Xác thực đăng nhập qua API backend thật (/api/v1/Auth/login)
//Desktop localhost: backend set cookie httpOnly "access_token"
//Mobile/Remote (Cloudflare, IP LAN): backend trả token trong body → lưu vào localStorage 
export async function authenticateUser(
  usernameOrEmail: string,
  password: string,
  turnstileToken?: string
): Promise<AuthResult> {
  if (!usernameOrEmail || !usernameOrEmail.trim()) {
    return { success: false, error: 'Vui lòng nhập tên đăng nhập / email công vụ.' };
  }
  if (!password || !password.trim()) {
    return { success: false, error: 'Vui lòng nhập mật khẩu xác thực.' };
  }

  const headers: Record<string, string> = {};
  if (turnstileToken) {
    headers['X-Turnstile-Token'] = turnstileToken;
  }

  const res = await apiFetch<AuthUser>('/api/v1/Auth/login', {
    method: 'POST',
    headers,
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

  // Lưu token vào localStorage để hỗ trợ mọi luồng xác thực Bearer + Cookie
  const token = res.token || res.data.token;
  const refreshToken = (res as any).refreshToken;
  if (token) {
    storeToken(token);
  }
  if (refreshToken) {
    storeRefreshToken(refreshToken);
  }

  return {
    success: true,
    user: res.data,
  };
}

//Hoàn tất đăng nhập 2 bước: gửi mã OTP để nhận token đầy đủ

export async function verifyMfaLogin(mfaToken: string, code: string, channel: string = ''): Promise<AuthResult> {
  const res = await apiFetch<AuthUser>('/api/v1/Auth/mfa/verify-login', {
    method: 'POST',
    body: JSON.stringify({ mfaToken, code, channel }),
  });

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error || 'Mã OTP không hợp lệ.',
    };
  }

  const token = res.token || res.data.token;
  const refreshToken = (res as any).refreshToken;
  if (token) {
    storeToken(token);
  }
  if (refreshToken) {
    storeRefreshToken(refreshToken);
  }

  return {
    success: true,
    user: res.data,
  };
}

//Bước 1 bật MFA: sinh secret TOTP + URI quét QR

export async function mfaSetup(): Promise<{ secret: string; provisioningUri: string }> {
  const res = await apiFetch<{ secret: string; provisioningUri: string }>('/api/v1/Auth/mfa/setup', {
    method: 'POST',
  });
  if (!res.success || !res.data) {
    throw new Error(res.error || 'Không thể tạo mã xác thực 2 yếu tố.');
  }
  return res.data;
}

//Bước 2 bật MFA: xác nhận mã OTP đầu tiên

export async function mfaEnable(secret: string, code: string, channel: MfaChannel = 'totp'): Promise<boolean> {
  const res = await apiFetch('/api/v1/Auth/mfa/enable', {
    method: 'POST',
    body: JSON.stringify({ secret, code, channel }),
  });
  if (!res.success) {
    throw new Error(res.error || 'Không thể bật xác thực 2 yếu tố.');
  }
  return true;
}

//Tắt MFA — yêu cầu mã OTP hiện tại

export async function mfaDisable(code: string, channel: MfaChannel = 'totp'): Promise<boolean> {
  const res = await apiFetch('/api/v1/Auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ code, channel }),
  });
  if (!res.success) {
    throw new Error(res.error || 'Không thể tắt xác thực 2 yếu tố.');
  }
  return true;
}

//Gửi mã OTP xác thực 2 bước qua Email công vụ (hỗ trợ cả phiên đăng nhập và luồng MFA login)

export async function sendMfaEmailCode(mfaToken?: string): Promise<{ maskedEmail: string; cooldownSeconds: number }> {
  const res = await apiFetch<{ maskedEmail: string; cooldownSeconds: number }>('/api/v1/Auth/mfa/send-email-code', {
    method: 'POST',
    body: JSON.stringify({ mfaToken: mfaToken || undefined }),
  });
  if (!res.success || !res.data) {
    throw new Error(res.error || 'Không thể gửi mã xác thực qua email.');
  }
  return res.data;
}


//Đăng xuất khỏi tất cả các thiết bị khác (thu hồi toàn bộ Refresh Token trên DB)

export async function revokeOtherSessionsApi(): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch<{ success: boolean; message: string }>('/api/v1/Auth/revoke-other-sessions', {
    method: 'POST',
  });
  if (!res.success) {
    throw new Error(res.error || 'Không thể đăng xuất các thiết bị khác.');
  }
  return res.data || { success: true, message: 'Đã đăng xuất khỏi các thiết bị khác thành công.' };
}

// Kiểm tra phiên làm việc hiện tại từ backend (/api/v1/Auth/me)
export async function getCurrentUser(): Promise<AuthUser | null> {
  const res = await apiFetch<AuthUser>('/api/v1/Auth/me', {
    method: 'GET',
  });

  if (res.success && res.data) {
    return res.data;
  }
  return null;
}

// Chuyển đổi ngữ cảnh vai trò (/api/v1/Auth/switch-context)
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

  // Cập nhật token mới khi switch context
  const token = res.token || res.data.token;
  const refreshToken = (res as any).refreshToken;
  if (token) {
    storeToken(token);
  }
  if (refreshToken) {
    storeRefreshToken(refreshToken);
  }

  return {
    success: true,
    user: res.data
  };
}

// Đăng xuất (/api/v1/Auth/logout) — thu hồi refresh token phía server
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

// Yêu cầu gửi mã OTP khôi phục mật khẩu qua Email công vụ (hỗ trợ Turnstile token)
export async function sendPasswordResetOtpApi(
  email: string,
  turnstileToken?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const headers: Record<string, string> = {};
  if (turnstileToken) {
    headers['X-Turnstile-Token'] = turnstileToken;
  }

  const res = await apiFetch<{ message: string }>('/api/v1/Auth/forgot-password/send-otp', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: email.trim() }),
  });

  if (!res.success) {
    return { success: false, error: res.error || res.message || (res as any)?.data?.message || 'Không thể gửi mã xác thực khôi phục mật khẩu.' };
  }
  return { success: true, message: res.message || res.data?.message || (res as any)?.message || 'Mã xác thực đã được gửi đến email của đồng chí.' };
}

// Bước 1 (Email): Xác thực mã OTP 6 số để lấy ResetToken
export async function verifyResetOtpApi(
  email: string,
  otpCode: string,
  turnstileToken?: string
): Promise<{ success: boolean; resetToken?: string; message?: string; error?: string }> {
  const headers: Record<string, string> = {};
  if (turnstileToken) {
    headers['X-Turnstile-Token'] = turnstileToken;
  }

  const res = await apiFetch<{ resetToken: string; message?: string }>('/api/v1/Auth/forgot-password/verify-otp', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: email.trim(),
      otpCode: otpCode.trim(),
    }),
  });

  const resetToken = (res as any)?.resetToken || res.data?.resetToken;
  if (!res.success || !resetToken) {
    return { success: false, error: res.error || (res as any)?.message || 'Mã xác thực OTP không hợp lệ hoặc đã hết hạn.' };
  }
  return { success: true, resetToken, message: res.message || res.data?.message || 'Xác thực OTP thành công.' };
}

// Bước 1 (MFA): Xác thực mã 2 bước Authenticator để lấy ResetToken
export async function verifyResetMfaApi(
  email: string,
  mfaCode: string,
  turnstileToken?: string
): Promise<{ success: boolean; resetToken?: string; message?: string; error?: string }> {
  const headers: Record<string, string> = {};
  if (turnstileToken) {
    headers['X-Turnstile-Token'] = turnstileToken;
  }

  const res = await apiFetch<{ resetToken: string; message?: string }>('/api/v1/Auth/forgot-password/verify-reset-mfa', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: email.trim(),
      mfaCode: mfaCode.trim(),
    }),
  });

  const resetToken = (res as any)?.resetToken || res.data?.resetToken;
  if (!res.success || !resetToken) {
    return { success: false, error: res.error || (res as any)?.message || 'Mã xác thực 2 bước không chính xác.' };
  }
  return { success: true, resetToken, message: res.message || res.data?.message || 'Xác thực 2 bước thành công.' };
}

// Bước 2 (Email): Đặt lại mật khẩu mới bằng ResetToken
export async function resetPasswordWithOtpApi(
  resetToken: string,
  newPassword: string,
  turnstileToken?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const headers: Record<string, string> = {};
  if (turnstileToken) {
    headers['X-Turnstile-Token'] = turnstileToken;
  }

  const res = await apiFetch<{ message: string }>('/api/v1/Auth/forgot-password/reset-with-otp', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      resetToken: resetToken.trim(),
      newPassword,
    }),
  });

  if (!res.success) {
    return { success: false, error: res.error || res.message || 'Đặt lại mật khẩu không thành công.' };
  }
  return { success: true, message: res.message || res.data?.message || 'Đặt lại mật khẩu thành công.' };
}

// Bước 2 (MFA): Đặt lại mật khẩu mới bằng ResetToken
export async function resetPasswordWithMfaApi(
  resetToken: string,
  newPassword: string,
  turnstileToken?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const headers: Record<string, string> = {};
  if (turnstileToken) {
    headers['X-Turnstile-Token'] = turnstileToken;
  }

  const res = await apiFetch<{ message: string }>('/api/v1/Auth/forgot-password/reset-with-mfa', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      resetToken: resetToken.trim(),
      newPassword,
    }),
  });

  if (!res.success) {
    return { success: false, error: res.error || res.message || 'Xác thực 2 bước không hợp lệ.' };
  }
  return { success: true, message: res.message || res.data?.message || 'Xác thực thành công và đã cập nhật mật khẩu mới.' };
}

// Bước 1: Yêu cầu gửi mã OTP đổi mật khẩu về Email công vụ
export async function sendChangePasswordOtpApi(
  turnstileToken?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const headers: Record<string, string> = {};
  if (turnstileToken) {
    headers['X-Turnstile-Token'] = turnstileToken;
  }

  const res = await apiFetch<{ message: string }>('/api/v1/Auth/change-password/send-otp', {
    method: 'POST',
    headers,
  });

  if (!res.success) {
    return { success: false, error: res.error || res.message || 'Không thể gửi mã xác thực qua email.' };
  }
  return { success: true, message: res.message || res.data?.message || 'Mã xác thực đã được gửi đến email công vụ của đồng chí.' };
}

// Bước 1: Xác thực mật khẩu hiện tại và OTP 6 số để nhận ChangePasswordToken
export async function verifyChangePasswordStep1Api(
  currentPassword: string,
  otpCode: string,
  method: 'email' | 'totp' = 'email',
  turnstileToken?: string
): Promise<{ success: boolean; changePasswordToken?: string; message?: string; error?: string }> {
  const headers: Record<string, string> = {};
  if (turnstileToken) {
    headers['X-Turnstile-Token'] = turnstileToken;
  }

  const res = await apiFetch<{ changePasswordToken: string; message?: string }>('/api/v1/Auth/change-password/verify-step1', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      currentPassword,
      otpCode: otpCode.trim(),
      method,
    }),
  });

  const changePasswordToken = (res as any)?.changePasswordToken || res.data?.changePasswordToken;
  if (!res.success || !changePasswordToken) {
    return { success: false, error: res.error || (res as any)?.message || 'Xác thực thông tin Bước 1 không thành công.' };
  }
  return { success: true, changePasswordToken, message: res.message || res.data?.message || 'Xác thực thành công.' };
}

// Bước 2: Thiết lập mật khẩu mới bằng ChangePasswordToken
export async function completeChangePasswordApi(
  changePasswordToken: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (newPassword !== confirmPassword) {
    return { success: false, error: 'Mật khẩu mới và xác nhận mật khẩu không khớp.' };
  }

  const res = await apiFetch<{ token?: string; refreshToken?: string }>('/api/v1/Auth/change-password/complete', {
    method: 'POST',
    body: JSON.stringify({
      changePasswordToken: changePasswordToken.trim(),
      newPassword,
    }),
  });

  if (!res.success) {
    return { success: false, error: res.error || res.message || 'Cập nhật mật khẩu mới thất bại.' };
  }

  const token = res.token || res.data?.token;
  const refreshToken = (res as any)?.refreshToken || res.data?.refreshToken;
  if (token) storeToken(token);
  if (refreshToken) storeRefreshToken(refreshToken);

  return { success: true, message: res.message || 'Đã cập nhật mật khẩu mới cho tài khoản công vụ thành công!' };
}

// Đổi mật khẩu trực tiếp cho người dùng đang đăng nhập (tương thích ngược)
export async function changePasswordApi(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await apiFetch<{ token?: string; refreshToken?: string }>('/api/v1/Auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword,
      newPassword,
      confirmPassword,
    }),
  });

  if (!res.success) {
    return { success: false, error: res.error || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.' };
  }

  const token = res.token || res.data?.token;
  const refreshToken = (res as any)?.refreshToken || res.data?.refreshToken;
  if (token) storeToken(token);
  if (refreshToken) storeRefreshToken(refreshToken);

  return { success: true, message: 'Đã cập nhật mật khẩu mới thành công.' };
}
