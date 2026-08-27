'use client';

import React, { useEffect, useRef } from 'react';

/**
 * BẢO MẬT (Audit Đợt 4 - P4B): Widget Cloudflare Turnstile chống bot.
 * - Chỉ render khi NEXT_PUBLIC_TURNSTILE_SITE_KEY được cấu hình.
 *   Không có key (môi trường dev / chưa đăng ký) → component trả null,
 *   toàn bộ luồng hoạt động như cũ và backend cũng bỏ qua kiểm tra.
 * - Token được đẩy lên qua onToken để caller gắn header X-Turnstile-Token.
 */

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

interface TurnstileGlobal {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
      theme?: 'light' | 'dark' | 'auto';
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
    __turnstileScriptLoading?: Promise<void>;
  }
}

function ensureTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__turnstileScriptLoading) return window.__turnstileScriptLoading;

  window.__turnstileScriptLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không tải được Turnstile script'));
    document.head.appendChild(script);
  });

  return window.__turnstileScriptLoading;
}

interface TurnstileWidgetProps {
  /** Nhận token khi người dùng/bot vượt qua challenge; null khi hết hạn/lỗi */
  onToken: (token: string | null) => void;
  /** Đổi giá trị này để ép render lại widget (vd sau khi gửi thất bại) */
  resetKey?: number;
}

export function TurnstileWidget({ onToken, resetKey = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  // Khởi tạo một lần
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;

    let cancelled = false;

    ensureTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        if (widgetIdRef.current !== null) return;

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'light',
          callback: token => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));

    return () => {
      cancelled = true;
      try {
        if (widgetIdRef.current !== null && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current);
        }
      } catch {
        /* best-effort cleanup */
      }
      widgetIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Không cấu hình key → không render gì cả (dev-friendly)
  if (!TURNSTILE_SITE_KEY) return null;

  return <div ref={containerRef} style={{ minHeight: 65 }} aria-label="Kiểm tra bảo mật Cloudflare" />;
}
