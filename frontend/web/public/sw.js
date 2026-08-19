/**
 * Service Worker xử lý Web Push & Background Notifications
 * Hệ thống Quản trị & Điều hành UBND Xã Cát Ngạn
 */

const DEFAULT_ICON = '/icon-192.png';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Xử lý sự kiện nhận thông báo đẩy từ Web Push Server
self.addEventListener('push', (event) => {
  let data = {
    title: 'UBND Xã Cát Ngạn',
    body: 'Bạn có thông báo mới từ hệ thống điều hành công việc.',
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
    data: {
      url: '/'
    }
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        data: payload.data || data.data
      };
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    data: data.data,
    vibrate: [200, 100, 200],
    tag: 'ubnd-catngan-notification',
    renotify: true,
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Xử lý khi người dùng bấm vào thông báo
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Nếu đã có tab mở, focus tab gần nhất và điều hướng (chỉ 1 tab)
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url !== targetUrl && 'navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Nếu chưa có tab nào mở, mở tab mới
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Xử lý khi push subscription bị thay đổi/hết hạn (trình duyệt tự cấp subscription mới)
self.addEventListener('pushsubscriptionchange', (event) => {
  const newSubscription = event.newSubscription || null;

  const notifyClients = () => {
    return self.clients.matchAll({ type: 'window' }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
      });
    });
  };

  if (!newSubscription) {
    event.waitUntil(notifyClients());
    return;
  }

  // Gửi subscription mới lên backend (best-effort; nếu thất bại, ứng dụng sẽ đăng ký lại khi mở trang)
  const p256dhBuffer = newSubscription.getKey('p256dh');
  const authBuffer = newSubscription.getKey('auth');

  if (!p256dhBuffer || !authBuffer) {
    event.waitUntil(notifyClients());
    return;
  }

  const p256dhKey = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhBuffer))));
  const authKey = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authBuffer))));

  const payload = {
    endpoint: newSubscription.endpoint,
    p256dhKey,
    authKey,
    deviceLabel: 'Thiết bị (tự đăng ký lại)'
  };

  event.waitUntil(
    fetch('/api/v1/Push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include'
    })
      .catch(() => {})
      .then(notifyClients)
  );
});
