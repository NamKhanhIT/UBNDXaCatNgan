/**
 * Centralized API configuration & fetch wrapper for backend communication.
 * Dual-mode auth:
 *  - Desktop localhost: Cookie-based (HttpOnly, SameSite=Lax)
 *  - Remote/Mobile (Cloudflare Tunnel, LAN IP): Bearer token in localStorage
 */

export const REMOTE_TOKEN_KEY = 'ubnd_access_token';

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL !== undefined) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined') {
    // Ưu tiên URL tùy chỉnh (nếu người dùng nhập thủ công)
    const customUrl = localStorage.getItem('custom_api_url');
    if (customUrl && customUrl.trim()) {
      return customUrl.trim();
    }
  }

  // Mặc định trả về chuỗi rỗng để sử dụng relative path (/api/v1/...) qua Next.js Reverse Proxy
  return '';
}

/**
 * Kiểm tra xem client đang truy cập từ xa (Cloudflare Tunnel, IP mạng, v.v.)
 */
export function isRemoteAccess(): boolean {
  if (typeof window === 'undefined') return false;

  const { hostname } = window.location;

  return (
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1'
  );
}

/**
 * Kiểm tra xem client cần dùng Bearer token bổ sung
 */
export function needsBearerAuth(): boolean {
  if (typeof window === 'undefined') return false;

  const { hostname } = window.location;

  return hostname !== 'localhost' && hostname !== '127.0.0.1';
}

/**
 * Lấy Bearer token từ localStorage (nếu có)
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REMOTE_TOKEN_KEY);
}

/**
 * Lưu Bearer token vào localStorage
 */
export function storeToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REMOTE_TOKEN_KEY, token);
}

/**
 * Xóa Bearer token khỏi localStorage
 */
export function clearToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REMOTE_TOKEN_KEY);
}

export const API_BASE_URL = getApiBaseUrl();

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  token?: string;
  message?: string;
  error?: string;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const isLocalDemo = typeof window !== 'undefined' && localStorage.getItem('isLocalDemoMode') === 'true';
  const storedToken = getStoredToken();

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Demo-Mode': isLocalDemo ? 'true' : 'false',
  };

  if (storedToken) {
    defaultHeaders['Authorization'] = `Bearer ${storedToken}`;
  }

  const config: RequestInit = {
    ...options,
    credentials: options.credentials || 'include',
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || `Lỗi HTTP ${response.status}`,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Không thể kết nối đến máy chủ API backend. Vui lòng kiểm tra lại kết nối mạng.',
    };
  }
}

