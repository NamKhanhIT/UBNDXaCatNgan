// Cấu hình kết nối API & fetch wrapper (hỗ trợ cả Cookie httpOnly và Bearer token)

export const REMOTE_TOKEN_KEY = 'ubnd_access_token';
export const REMOTE_REFRESH_TOKEN_KEY = 'ubnd_refresh_token';

// BẢO MẬT (Audit H10): Whitelist API URL hợp lệ (chỉ loopback hoặc same-origin)
function isAllowedCustomApiUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const host = parsed.hostname.toLowerCase();
    const isLoopback =
      host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
    const isSameOrigin =
      typeof window !== 'undefined' && parsed.origin === window.location.origin;

    return isLoopback || isSameOrigin;
  } catch {
    return false;
  }
}

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL !== undefined) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined') {
    // Ưu tiên URL tùy chỉnh đã qua whitelist bảo mật
    const customUrl = localStorage.getItem('custom_api_url');
    if (customUrl && customUrl.trim()) {
      const trimmed = customUrl.trim();
      if (isAllowedCustomApiUrl(trimmed)) {
        return trimmed;
      }
      localStorage.removeItem('custom_api_url');
    }
  }

  // Mặc định relative path (/api/v1/...) qua Next.js Reverse Proxy
  return '';
}

// Kiểm tra client truy cập từ xa (Tunnel/LAN IP)
export function isRemoteAccess(): boolean {
  if (typeof window === 'undefined') return false;

  const { hostname } = window.location;

  return (
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1'
  );
}

// Kiểm tra client cần dùng Bearer token bổ sung
export function needsBearerAuth(): boolean {
  if (typeof window === 'undefined') return false;

  const { hostname } = window.location;

  return hostname !== 'localhost' && hostname !== '127.0.0.1';
}

// Lấy Bearer access token từ localStorage
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REMOTE_TOKEN_KEY);
}

// BẢO MẬT (Audit H9): Lưu Bearer token và đặt cookie marker ubnd_logged_in cho Next.js middleware
export function storeToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REMOTE_TOKEN_KEY, token);
  markLoggedInCookie();
}

const LOGGED_IN_MARKER_COOKIE = 'ubnd_logged_in';

// Đặt cookie marker phiên cho middleware route protection
export function markSessionActive(): void {
  markLoggedInCookie();
}

function markLoggedInCookie(): void {
  if (typeof document === 'undefined') return;
  // Cookie marker xác định trạng thái đăng nhập (không chứa token bí mật)
  document.cookie = `${LOGGED_IN_MARKER_COOKIE}=1; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
}

// Lấy refresh token từ localStorage
export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REMOTE_REFRESH_TOKEN_KEY);
}

// Lưu refresh token vào localStorage
export function storeRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REMOTE_REFRESH_TOKEN_KEY, token);
}

// Xóa access & refresh token khỏi localStorage
export function clearToken(): void {
  if (typeof window === 'undefined') return;
  authGeneration++;
  localStorage.removeItem(REMOTE_TOKEN_KEY);
  localStorage.removeItem(REMOTE_REFRESH_TOKEN_KEY);
}

const CACHED_USER_KEY = 'ubnd_cached_user';
const ACTIVE_ROLE_KEY = 'ubnd_active_role';
let authGeneration = 0;

// BẢO MẬT (Audit Mục 3): Dọn sạch toàn bộ session storage & cookie marker
export function clearSessionStorage(): void {
  if (typeof window === 'undefined') return;
  authGeneration++;
  localStorage.removeItem(REMOTE_TOKEN_KEY);
  localStorage.removeItem(REMOTE_REFRESH_TOKEN_KEY);
  localStorage.removeItem(CACHED_USER_KEY);
  localStorage.removeItem(ACTIVE_ROLE_KEY);
  // Xóa cookie marker phiên
  if (typeof document !== 'undefined') {
    document.cookie = `${LOGGED_IN_MARKER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export const API_BASE_URL = getApiBaseUrl();

export interface ApiResponse<T = any> {
  success: boolean;
  status?: number;
  data?: T;
  token?: string;
  refreshToken?: string;
  message?: string;
  error?: string;
}

/** Download through the authenticated API; protected files are never exposed as public URLs. */
export async function apiFileBlob(endpoint: string, signal?: AbortSignal): Promise<ApiResponse<Blob>> {
  const scope = sessionScope();
  const initialToken = getStoredToken();
  const request = () => fetch(`${getApiBaseUrl()}${endpoint}`, {
    credentials: 'include', signal,
    headers: getStoredToken() ? { Authorization: `Bearer ${getStoredToken()}` } : {},
  });
  try {
    let response = await request();
    if (response.status === 401 && await retrySession(scope, initialToken)) response = await request();
    if (!response.ok) return { success: false, status: response.status, error: 'Không thể mở tệp trong phạm vi quyền hiện tại.' };
    return { success: true, data: await response.blob() };
  } catch (error) {
    return { success: false, status: 0, error: error instanceof Error ? error.message : 'Không thể tải tệp.' };
  }
}

// Tự động refresh access token qua refresh endpoint khi nhận HTTP 401
type SessionScope = { generation: number; userId: string | null };
function sessionScope(): SessionScope {
  let userId: string | null = null;
  try { userId = JSON.parse(typeof localStorage === 'undefined' ? 'null' : localStorage.getItem(CACHED_USER_KEY) || 'null')?.userId || null; } catch {}
  return { generation: authGeneration, userId };
}
function sameSession(scope: SessionScope): boolean {
  const current = sessionScope();
  return current.generation === scope.generation && current.userId === scope.userId;
}
let refreshing: { refreshToken: string; promise: Promise<boolean> } | undefined;
async function retrySession(scope: SessionScope, initialToken: string | null): Promise<boolean> {
  if (!sameSession(scope)) return false;
  const current = getStoredToken();
  if (current && current !== initialToken) return true;
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;
  if (refreshing?.refreshToken === refreshToken) return refreshing.promise;
  const promise = performRefresh(scope, refreshToken).finally(() => {
    if (refreshing?.promise === promise) refreshing = undefined;
  });
  refreshing = { refreshToken, promise };
  return promise;
}
async function performRefresh(scope: SessionScope, refreshToken: string): Promise<boolean> {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/Auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!sameSession(scope) || getStoredRefreshToken() !== refreshToken) return false;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) clearSessionStorage();
      return false;
    }

    const text = await response.text();
    let data: any = null;
    if (text && text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {}
    }

    if (!sameSession(scope) || getStoredRefreshToken() !== refreshToken) return false;
    const token = data?.token || data?.data?.token;
    const nextRefresh = data?.refreshToken || data?.data?.refreshToken;
    if (typeof token !== 'string' || !token) return false;
    storeToken(token);
    if (typeof nextRefresh === 'string' && nextRefresh) storeRefreshToken(nextRefresh);
    return true;
}

// Wrapper fetch tập trung: tự động đính kèm Bearer token, xử lý cookie & auto-retry 401
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const isLocalDemo = typeof window !== 'undefined' && localStorage.getItem('isLocalDemoMode') === 'true';
  const storedToken = getStoredToken();

  const scope = sessionScope();

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

  const doFetch = async (): Promise<ApiResponse<T>> => {
    let response = await fetch(url, config);

    // Access token hết hạn → thử refresh 1 lần rồi gọi lại request ban đầu
    if (response.status === 401 && !endpoint.includes('/Auth/login') && !endpoint.includes('/Auth/refresh')) {
      const refreshed = await retrySession(scope, storedToken);
      if (refreshed) {
        const newToken = getStoredToken();
        if (newToken) {
          config.headers = {
            ...config.headers,
            Authorization: `Bearer ${newToken}`,
          };
          response = await fetch(url, config);
        }
      }
    }

    // Xử lý phản hồi 204 No Content
    if (response.status === 204) {
      return { success: true } as ApiResponse<T>;
    }

    const text = await response.text();
    let data: any = null;
    if (text && text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!response.ok) {
      const defaultMsg = response.status === 401
        ? 'Phiên làm việc đã hết hạn hoặc chưa đăng nhập hợp lệ.'
        : response.status === 403
        ? 'Tài khoản không có quyền thực hiện thao tác này.'
        : `Lỗi máy chủ HTTP ${response.status} (${response.statusText || 'Lỗi không xác định'})`;

      return {
        success: false,
        status: response.status,
        error: data?.message || data?.error || defaultMsg,
      };
    }

    if (data === null || data === undefined) {
      return { success: true } as ApiResponse<T>;
    }

    return data;
  };

  try {
    return await doFetch();
  } catch (err: any) {
    return {
      success: false,
      status: 0,
      error: err.message || 'Không thể kết nối đến máy chủ API backend. Vui lòng kiểm tra lại kết nối mạng.',
    };
  }
}

// BẢO MẬT (Audit M7): Upload tệp chuẩn qua FormData với Bearer auth và auto-retry 401
export async function apiUpload<T = any>(
  endpoint: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  const isLocalDemo = typeof window !== 'undefined' && localStorage.getItem('isLocalDemoMode') === 'true';
  const headers: Record<string, string> = {
    'X-Demo-Mode': isLocalDemo ? 'true' : 'false',
  };
  const storedToken = getStoredToken();
  const scope = sessionScope();
  if (storedToken) {
    headers['Authorization'] = `Bearer ${storedToken}`;
  }

  const send = () => fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: formData,
  });

  try {
    let response = await send();

    // Hết hạn access token → refresh 1 lần và thử lại
    if (response.status === 401) {
      const refreshed = await retrySession(scope, storedToken);
      if (refreshed) {
        const refreshedToken = getStoredToken();
        if (refreshedToken) headers['Authorization'] = `Bearer ${refreshedToken}`;
        else delete headers['Authorization'];
        response = await send();
      }
    }

    const text = await response.text();
    let data: any = null;
    if (text && text.trim()) {
      try { data = JSON.parse(text); } catch { data = { message: text }; }
    }

    if (!response.ok || data?.success === false) {
      return {
        success: false,
        status: response.status,
        error: data?.error || data?.message || `Lỗi tải lên tệp (Mã HTTP ${response.status})`,
      };
    }

    return data ?? ({ success: true } as ApiResponse<T>);
  } catch (err: any) {
    return {
      success: false,
      status: 0,
      error: err.message || 'Lỗi mạng khi tải lên tệp.',
    };
  }
}

