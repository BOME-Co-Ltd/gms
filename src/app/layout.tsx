import type { Metadata } from 'next';
import type React from 'react';
import '../styles/globals.css';
import { FloatingContact } from '../components/ui/FloatingContact.tsx';

export const metadata: Metadata = {
  title: 'GMS Hưng Yên — Giải pháp thông minh, Kiến tạo giá trị xanh',
  description:
    'GMS Hưng Yên – Giải pháp thông minh, kiến tạo giá trị xanh thông qua công nghệ sàng tuyển và nhiệt phân VPD.',
  icons: {
    icon: [
      { url: '/brand/logo-gms-mark.svg', type: 'image/svg+xml' },
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/favicon.ico',
    apple: '/brand/logo-gms-mark.svg',
  },
  alternates: {
    canonical: 'https://gms.example.test/',
    languages: {
      vi: 'https://gms.example.test/',
      en: 'https://gms.example.test/en',
      'x-default': 'https://gms.example.test/',
    },
  },
  openGraph: {
    title: 'GMS Hưng Yên — Giải pháp thông minh, Kiến tạo giá trị xanh',
    description:
      'GMS Hưng Yên – Giải pháp thông minh, kiến tạo giá trị xanh thông qua công nghệ sàng tuyển và nhiệt phân VPD.',
    locale: 'vi_VN',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <FloatingContact />
      </body>
    </html>
  );
}
