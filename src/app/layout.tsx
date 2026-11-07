import type { Metadata } from 'next';
import type React from 'react';
import { INLINE_STYLES } from '../../scripts/content/build-site.ts';

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

// lang="vi" mặc định; trang /en/** được sửa thành "en" ở bước hậu kỳ build (postBuild, build-site.ts).
export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <style dangerouslySetInnerHTML={{ __html: INLINE_STYLES }} />
      </head>
      <body id="top" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
