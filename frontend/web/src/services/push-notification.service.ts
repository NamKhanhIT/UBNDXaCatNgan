import { apiFetch } from './api.config';

export interface PushSubscriptionDto {
  id: string;
  userId: string;
  endpoint: string;
  deviceLabel?: string;
  createdAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

export interface SubscribePushPayload {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  deviceLabel?: string;
}

/**
 * Chuyển đổi VAPID Public Key từ Base64 URL-safe sang Uint8Array
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  try {
    const clean = (base64String || '').trim();
    const padding = '='.repeat((4 - (clean.length % 4)) % 4);
    const base64 = (clean + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (err) {
    console.warn('Lỗi giải mã VAPID Key base64, sử dụng khóa chuẩn:', err);
    const fallbackKey = 'BEl62iUYgUivxIkv69yViEuiBIa+Ib9+SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U=';
    const rawData = window.atob(fallbackKey);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

/**
 * Kiểm tra xem trình duyệt có hỗ trợ Service Worker và PushManager không
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Nhận diện thiết bị Apple iOS (iPhone, iPad, iPod)
 */
export function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Kiểm tra xem ứng dụng trên iOS đã được cài đặt và đang chạy dưới dạng PWA Standalone chưa
 */
export function isIosStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  // @ts-ignore
  const isStandalone = window.navigator.standalone === true;
  const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return isStandalone || isDisplayStandalone;
}

/**
 * Tạo nhãn thiết bị thân thiện tự động từ user agent
 */
export function getAutoDeviceLabel(): string {
  if (typeof window === 'undefined') return 'Thiết bị không xác định';

  const ua = window.navigator.userAgent;
  let os = 'Thiết bị';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Trình duyệt';
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  const pwaSuffix = isIosStandalonePwa() ? ' (PWA)' : '';
  return `${browser} trên ${os}${pwaSuffix}`;
}

/**
 * Đăng ký Service Worker (/sw.js)
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    return registration;
  } catch (error) {
    console.error('Lỗi khi đăng ký Service Worker:', error);
    return null;
  }
}

/**
 * VAPID Public Key cấu hình đồng bộ với Backend
 */
const DEFAULT_VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

/**
 * Lấy VAPID Public Key từ Backend API
 */
export async function getVapidPublicKeyApi(): Promise<string> {
  try {
    const res = await apiFetch<any>('/api/v1/Push/vapid-public-key', {
      method: 'GET'
    });

    const key = res?.data?.publicKey || (res as any)?.publicKey || (typeof res?.data === 'string' ? res.data : null);
    if (key && typeof key === 'string' && key.trim()) {
      return key.trim();
    }
  } catch (err) {
    console.warn('Lỗi kết nối API lấy VAPID Public Key, dùng khóa mặc định:', err);
  }

  return DEFAULT_VAPID_PUBLIC_KEY;
}

/**
 * Gửi thông tin subscription lên Backend API
 */
export async function subscribePushApi(payload: SubscribePushPayload): Promise<PushSubscriptionDto> {
  const res = await apiFetch<any>('/api/v1/Push/subscribe', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  const data = res?.data || res;
  if (data && (data.id || data.endpoint)) {
    return data as PushSubscriptionDto;
  }

  if (res.success && res.data) {
    return res.data;
  }

  throw new Error(res.error || 'Không thể đăng ký nhận thông báo đẩy trên máy chủ.');
}

/**
 * Hủy đăng ký subscription trên Backend API
 */
export async function unsubscribePushApi(endpoint?: string, subscriptionId?: string): Promise<boolean> {
  const params = new URLSearchParams();
  if (endpoint) params.append('endpoint', endpoint);
  if (subscriptionId) params.append('subscriptionId', subscriptionId);

  const qs = params.toString();
  const url = `/api/v1/Push/subscribe${qs ? `?${qs}` : ''}`;

  const res = await apiFetch<{ success: boolean }>(url, {
    method: 'DELETE'
  });

  return res.success && !!res.data?.success;
}

/**
 * Lấy danh sách thiết bị đã liên kết của người dùng
 */
export async function getMyPushSubscriptionsApi(): Promise<PushSubscriptionDto[]> {
  const res = await apiFetch<PushSubscriptionDto[]>('/api/v1/Push/subscriptions', {
    method: 'GET'
  });

  if (!res.success || !res.data) {
    return [];
  }

  return res.data;
}

/**
 * Gửi thông báo đẩy thử nghiệm
 */
export async function sendTestPushApi(endpoint?: string): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch<{ success: boolean; message: string }>('/api/v1/Push/test', {
    method: 'POST',
    body: JSON.stringify({ endpoint })
  });

  if (!res.success || !res.data) {
    throw new Error(res.error || 'Không thể gửi thông báo thử nghiệm.');
  }

  return res.data;
}

/**
 * Lấy push subscription hiện có trên trình duyệt
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Kích hoạt đăng ký nhận thông báo đẩy trên thiết bị hiện tại
 */
export async function subscribeCurrentDevice(customLabel?: string): Promise<PushSubscriptionDto> {
  if (!isPushNotificationSupported()) {
    throw new Error('Trình duyệt hiện tại không hỗ trợ Web Push Notifications.');
  }

  // 1. Xin quyền thông báo
  if (Notification.permission === 'denied') {
    throw new Error('Quyền nhận thông báo đang bị chặn. Vui lòng bấm vào biểu tượng cài đặt cạnh URL và Cho phép (Allow) thông báo cho trang web này.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Người dùng chưa cấp quyền nhận thông báo trên trình duyệt.');
  }

  // 2. Đăng ký Service Worker
  const registration = await registerServiceWorker();
  if (!registration) {
    throw new Error('Không thể khởi tạo Service Worker trên thiết bị.');
  }

  const swReady = await navigator.serviceWorker.ready;

  // 3. Lấy VAPID Public Key từ Backend
  const publicKey = await getVapidPublicKeyApi();
  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  // 4. Đăng ký PushManager
  let subscription = await swReady.pushManager.getSubscription();
  if (subscription) {
    const existingP256dh = subscription.getKey('p256dh');
    const existingAuth = subscription.getKey('auth');
    if (!existingP256dh || !existingAuth) {
      try {
        await subscription.unsubscribe();
      } catch {}
      subscription = null;
    }
  }

  if (!subscription) {
    try {
      subscription = await swReady.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any
      });
    } catch (subErr: any) {
      // Nếu gặp lỗi invalid key, thử unsubscribe và đăng ký lại
      try {
        const oldSub = await swReady.pushManager.getSubscription();
        if (oldSub) await oldSub.unsubscribe();
        subscription = await swReady.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as any
        });
      } catch (retryErr: any) {
        throw new Error(`Lỗi đăng ký PushManager: ${retryErr.message || subErr.message}`);
      }
    }
  }

  // 5. Trích xuất keys p256dh và auth (ưu tiên chuẩn toJSON W3C Push API)
  const json = subscription.toJSON();
  let p256dhKey = json.keys?.p256dh || '';
  let authKey = json.keys?.auth || '';

  if (!p256dhKey || !authKey) {
    const p256dhBuffer = subscription.getKey('p256dh');
    const authBuffer = subscription.getKey('auth');

    if (!p256dhBuffer || !authBuffer) {
      throw new Error('Không thể trích xuất khóa mã hóa từ Push Subscription.');
    }

    p256dhKey = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhBuffer))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    authKey = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authBuffer))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  const deviceLabel = customLabel || getAutoDeviceLabel();

  // 6. Gửi lên backend
  return await subscribePushApi({
    endpoint: subscription.endpoint,
    p256dhKey,
    authKey,
    deviceLabel
  });
}

/**
 * Hủy đăng ký nhận thông báo đẩy trên thiết bị hiện tại
 */
export async function unsubscribeCurrentDevice(): Promise<boolean> {
  if (!isPushNotificationSupported()) return false;

  try {
    const swReady = await navigator.serviceWorker.ready;
    const subscription = await swReady.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await unsubscribePushApi(endpoint);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Lỗi khi hủy đăng ký Push:', error);
    return false;
  }
}
