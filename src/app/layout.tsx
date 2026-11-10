import type { Metadata } from 'next';
import type React from 'react';
import '../styles/site.css';

// Biểu tượng dùng chung mọi trang; title/description/canonical/hreflang/robots/og do từng trang khai (siteMetadata).
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: '/brand/logo-gms-mark.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/favicon.ico',
    apple: '/brand/logo-gms-mark.svg',
  },
};

// Thêm lớp `js`; từ lần vào thứ hai trong cùng tab thêm `no-intro` để hoạt ảnh mở đầu của hero không chạy lại mỗi trang.
const INLINE_BOOT =
  "var d=document.documentElement;d.classList.add('js');try{if(sessionStorage.getItem('gms-intro'))d.classList.add('no-intro');else sessionStorage.setItem('gms-intro','1')}catch(e){}";

// Phông chữ dùng ở mọi trang (đường dẫn trùng @font-face trong site.css).
const FONT_PRELOADS = [
  '/fonts/be-vietnam-pro-latin-400-normal.woff2',
  '/fonts/be-vietnam-pro-vietnamese-400-normal.woff2',
  '/fonts/be-vietnam-pro-latin-700-normal.woff2',
  '/fonts/be-vietnam-pro-vietnamese-700-normal.woff2',
];

// lang="vi" mặc định; trang /en/** được sửa thành "en" ở bước hậu kỳ build (src/components/site/build/verify.ts).
// Script nhỏ thêm lớp `js` trước khi vẽ để trạng thái đầu của hiệu ứng không nhấp nháy.
export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: chuỗi hằng cố định; truyền bằng children thì React escape dấu nháy làm vỡ script. */}
        <script dangerouslySetInnerHTML={{ __html: INLINE_BOOT }} />
        {FONT_PRELOADS.map((href) => (
          <link key={href} rel="preload" as="font" type="font/woff2" href={href} crossOrigin="anonymous" />
        ))}
      </head>
      <body id="top" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
