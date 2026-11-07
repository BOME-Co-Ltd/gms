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

// lang="vi" mặc định; trang /en/** được sửa thành "en" ở bước hậu kỳ build (src/components/site/build/verify.ts).
// Script nhỏ thêm lớp `js` trước khi vẽ để trạng thái đầu của hiệu ứng không nhấp nháy.
export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: chuỗi hằng cố định; truyền bằng children thì React escape dấu nháy làm vỡ script. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body id="top" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
