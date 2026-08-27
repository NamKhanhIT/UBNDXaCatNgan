import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// BẢO MẬT (Audit H9): Route protection tầng server cho khu vực portal dựa trên cookie marker & session cookie
const LOGGED_IN_MARKER = 'ubnd_logged_in';
const BACKEND_ACCESS_COOKIE = 'access_token';
const BACKEND_REFRESH_COOKIE = 'refresh_token';

// BẢO MẬT (Audit H11/D4): Content-Security-Policy cho khu vực portal (cho phép Turnstile & tài nguyên an toàn)
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function middleware(request: NextRequest) {
  // Có phiên nếu: (a) marker FE đặt khi login thành công (mobile/remote Bearer mode),
  // hoặc (b) backend đã cấp cookie httpOnly (desktop quay lại trình duyệt cũ)
  const hasFeMarker = Boolean(request.cookies.get(LOGGED_IN_MARKER)?.value);
  const hasBackendSession = Boolean(
    request.cookies.get(BACKEND_ACCESS_COOKIE)?.value ||
      request.cookies.get(BACKEND_REFRESH_COOKIE)?.value
  );

  if (!hasFeMarker && !hasBackendSession) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', CSP);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

export const config = {
  matcher: [
    // Toàn bộ khu vực portal sau đăng nhập
    '/portal/:path*',
  ],
};
