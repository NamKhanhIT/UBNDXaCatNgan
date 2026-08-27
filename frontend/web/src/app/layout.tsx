import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: 'Hệ thống Quản lý Công việc dành cho UBND Cấp Xã',
  description: 'Hệ thống số hóa quản trị công việc, đôn đốc chỉ đạo và đánh giá hiệu quả thực thi công vụ cấp xã',
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
    <html lang="vi" suppressHydrationWarning className={beVietnamPro.variable}>
      <head>
        <link rel="stylesheet" href="/vendor/font-awesome/css/all.min.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var appSetting = localStorage.getItem('ubnd_appearance_settings');
                if (appSetting) {
                  var p = JSON.parse(appSetting);
                  if (p.font) document.documentElement.setAttribute('data-font', p.font);
                  if (p.density) document.documentElement.setAttribute('data-density', p.density);
                  if (p.theme) document.documentElement.setAttribute('data-theme', p.theme);
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className={beVietnamPro.className}>{children}</body>
    </html>
  );
}
