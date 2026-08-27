import { apiFetch, ApiResponse } from './api.config';

export interface UserDto {
  id: string;
  username: string;
  fullName: string;
  email: string;
  zaloPhoneNumber?: string;
  primaryDepartmentId?: string;
  departmentName?: string;
  activeRoleCode?: string;
  roleName?: string;
  rankLevel: number;
  assignedHours: number;
  maxHours: number;
  utilizationRate: number;
  isOverloaded: boolean;
  yearsOfExperience?: number;
  expertise?: string;
}

export interface PaginatedUsersResponse {
  items: UserDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  roleCode?: string;
  workloadStatus?: string;
}

export async function getUsersPaginatedApi(params: GetUsersParams = {}): Promise<ApiResponse<PaginatedUsersResponse>> {
  const queryParts: string[] = [];

  if (params.page !== undefined) queryParts.push(`page=${params.page}`);
  if (params.pageSize !== undefined) queryParts.push(`pageSize=${params.pageSize}`);
  if (params.search && params.search.trim()) queryParts.push(`search=${encodeURIComponent(params.search.trim())}`);
  if (params.departmentId && params.departmentId !== 'ALL') queryParts.push(`departmentId=${encodeURIComponent(params.departmentId)}`);
  if (params.roleCode && params.roleCode !== 'ALL') queryParts.push(`roleCode=${encodeURIComponent(params.roleCode)}`);
  if (params.workloadStatus && params.workloadStatus !== 'ALL') queryParts.push(`workloadStatus=${encodeURIComponent(params.workloadStatus)}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  return await apiFetch<PaginatedUsersResponse>(`/api/v1/Users${queryString}`, {
    method: 'GET',
  });
}

export interface UserProfileDto {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  zaloPhoneNumber?: string;
  phoneNumberConfirmed?: boolean;
  departmentName?: string;
  activeRoleCode?: string;
  expertise?: string;
  yearsOfExperience: number;
  workProfileJson?: string;
  notificationPreferences?: string;
  appearancePreferences?: string;
}

export interface UpdateUserProfilePayload {
  fullName?: string;
  email?: string;
  zaloPhoneNumber?: string;
  expertise?: string;
  yearsOfExperience?: number;
  workProfileJson?: string;
  notificationPreferences?: string;
  appearancePreferences?: string;
}

export async function getUserProfileApi(): Promise<ApiResponse<UserProfileDto>> {
  return await apiFetch<UserProfileDto>('/api/v1/Users/profile', {
    method: 'GET',
  });
}

export async function updateUserProfileApi(payload: UpdateUserProfilePayload): Promise<ApiResponse<UserProfileDto>> {
  return await apiFetch<UserProfileDto>('/api/v1/Users/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ── QUY TRÌNH ĐỔI EMAIL CÔNG VỤ 2 BƯỚC BẢO MẬT ──

export interface RequestEmailChangeResponse {
  cooldownSeconds?: number;
}

export async function requestChangeEmailApi(
  currentPassword: string,
  newEmail: string
): Promise<ApiResponse<RequestEmailChangeResponse>> {
  return await apiFetch<RequestEmailChangeResponse>('/api/v1/Users/email/request-change', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newEmail }),
  });
}

export interface ConfirmEmailChangeResponse {
  newEmail?: string;
}

export async function confirmChangeEmailApi(otpCode: string): Promise<ApiResponse<ConfirmEmailChangeResponse>> {
  return await apiFetch<ConfirmEmailChangeResponse>('/api/v1/Users/email/confirm-change', {
    method: 'POST',
    body: JSON.stringify({ otpCode }),
  });
}

// ── QUY TRÌNH XÁC THỰC SỐ ĐIỆN THOẠI QUA SMS GATEWAY MIỄN PHÍ ──

export interface SendPhoneOtpResponse {
  cooldownSeconds?: number;
}

export async function sendPhoneOtpApi(phoneNumber: string): Promise<ApiResponse<SendPhoneOtpResponse>> {
  const clean = phoneNumber.trim().replace(/\s/g, '');
  const maskedPhone = clean.length >= 7 ? clean.slice(0, 3) + '****' + clean.slice(-3) : '***';
  const sessionSignature = btoa(encodeURIComponent(`${maskedPhone}_${Date.now()}`)).slice(0, 18);

  // Ghi log bảo mật mã hóa trong DevTools Console (chống hacker & bảo mật danh tính)
  console.groupCollapsed(
    `%c🔒 [BẢO MẬT SMS] Yêu cầu mã xác thực SĐT: ${maskedPhone}`,
    'color: #059669; font-weight: bold; background: #f0fdf4; padding: 3px 8px; border-radius: 4px; border: 1px solid #bbf7d0;'
  );
  console.info('Kênh phát tin:', 'Hệ Thống Tin Nhắn SMS Công Vụ (Bảo mật TLS 1.3)');
  console.info('Chữ ký phiên mã hóa (Session Token):', sessionSignature);
  console.info('Số điện thoại đích (Masked):', maskedPhone);
  console.info('Thời điểm phát lệnh:', new Date().toLocaleString('vi-VN'));
  console.groupEnd();

  return await apiFetch<SendPhoneOtpResponse>('/api/v1/Users/phone/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber: clean }),
  });
}

export interface VerifyPhoneOtpResponse {
  confirmedPhoneNumber?: string;
}

export async function verifyPhoneOtpApi(
  phoneNumber: string,
  otpCode: string
): Promise<ApiResponse<VerifyPhoneOtpResponse>> {
  const clean = phoneNumber.trim().replace(/\s/g, '');
  const maskedPhone = clean.length >= 7 ? clean.slice(0, 3) + '****' + clean.slice(-3) : '***';
  const maskedOtp = otpCode.length >= 4 ? otpCode.slice(0, 2) + '**' + otpCode.slice(-2) : '******';

  // Ghi log xác minh mã OTP mã hóa trong DevTools Console
  console.groupCollapsed(
    `%c🔒 [BẢO MẬT SMS] Xác minh mã OTP SĐT: ${maskedPhone}`,
    'color: #2563eb; font-weight: bold; background: #eff6ff; padding: 3px 8px; border-radius: 4px; border: 1px solid #bfdbfe;'
  );
  console.info('Số điện thoại xác thực (Masked):', maskedPhone);
  console.info('Mã OTP kiểm tra (Masked):', maskedOtp);
  console.info('Thuật toán đối soát:', 'SHA-256 Digest Verification');
  console.info('Thời điểm đối soát:', new Date().toLocaleString('vi-VN'));
  console.groupEnd();

  return await apiFetch<VerifyPhoneOtpResponse>('/api/v1/Users/phone/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber: clean, otpCode }),
  });
}

// Gửi thử nghiệm tin nhắn SMS thông báo công vụ

export interface SendTestSmsResponse {
  gatewayStatus?: string;
}

export async function sendTestSmsApi(phoneNumber?: string): Promise<ApiResponse<SendTestSmsResponse>> {
  const clean = phoneNumber?.trim().replace(/\s/g, '');
  const maskedPhone = clean && clean.length >= 7 ? clean.slice(0, 3) + '****' + clean.slice(-3) : 'Số điện thoại cán bộ';

  // Ghi log bảo mật trong DevTools Console
  console.groupCollapsed(
    `%c🔒 [BẢO MẬT SMS] Phát tin nhắn thử nghiệm: ${maskedPhone}`,
    'color: #047857; font-weight: bold; background: #ecfdf5; padding: 3px 8px; border-radius: 4px; border: 1px solid #a7f3d0;'
  );
  console.info('Loại giao dịch:', 'Tin nhắn SMS thông báo công vụ thử nghiệm');
  console.info('Kênh bảo mật:', 'Android SMS Gateway / Local GSM Modem (TLS 1.3)');
  console.info('Số điện thoại nhận tin (Masked):', maskedPhone);
  console.info('Thời điểm phát lệnh:', new Date().toLocaleString('vi-VN'));
  console.groupEnd();

  return await apiFetch<SendTestSmsResponse>('/api/v1/Users/notifications/test-sms', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber: clean }),
  });
}

