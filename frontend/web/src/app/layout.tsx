import './globals.css';
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: 'UBND Xã Cát Ngạn - Quản Lý Công Việc & Đánh Giá Năng Lực',
  description: 'Hệ thống số hóa quản trị công việc, đôn đốc chỉ đạo và đánh giá công suất nhân sự UBND Xã Cát Ngạn',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/vendor/font-awesome/css/all.min.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for (let registration of registrations) {
                    registration.unregister();
                  }
                });
              }
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
