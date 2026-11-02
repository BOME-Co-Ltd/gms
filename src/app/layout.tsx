import type { Metadata } from 'next';
import type React from 'react';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'GMS Hưng Yên — Giải pháp thông minh, Kiến tạo giá trị xanh',
  description:
    'GMS Hưng Yên – Giải pháp thông minh, kiến tạo giá trị xanh thông qua công nghệ sàng tuyển và nhiệt phân VPD.',
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
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
