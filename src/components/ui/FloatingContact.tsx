'use client';

import { MessageCircle, Phone } from 'lucide-react';
import type React from 'react';

export interface FloatingContactProps {
  phone?: string;
  phoneDisplay?: string;
  zaloUrl?: string;
  locale?: 'vi' | 'en';
}

export function FloatingContact({
  phone = '+84987998370',
  phoneDisplay = '098 799 83 70',
  zaloUrl = 'https://zalo.me/0987998370',
  locale = 'vi',
}: FloatingContactProps): React.ReactElement {
  const isVi = locale === 'vi';

  return (
    <aside
      className="floating-contact-group fixed bottom-6 right-6 z-50 flex flex-col gap-3.5 items-end select-none pointer-events-auto"
      aria-label={isVi ? 'Liên hệ nhanh' : 'Quick contact'}
    >
      {/* Nút Chat Zalo: Nút tròn lớn, icon & chữ Zalo rõ nét, hover phóng to */}
      <a
        href={zaloUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-circle-btn floating-btn-zalo relative flex items-center justify-center w-[58px] h-[58px] rounded-full bg-[#0068ff] text-white shadow-2xl hover:scale-115 hover:shadow-[0_12px_28px_rgba(0,104,255,0.45)] transition-all duration-300 no-underline cursor-pointer"
        aria-label={`Chat Zalo: ${phoneDisplay}`}
        title={`Chat Zalo: ${phoneDisplay}`}
      >
        <span className="floating-pulse absolute inset-0 rounded-full border-2 border-[#0068ff] pointer-events-none" />
        <MessageCircle size={28} strokeWidth={1.8} className="relative z-10" aria-hidden="true" focusable="false" />
      </a>

      {/* Nút Gọi Hotline: Nút tròn lớn, icon điện thoại rõ nét, hover phóng to */}
      <a
        href={`tel:${phone}`}
        className="floating-circle-btn floating-btn-phone relative flex items-center justify-center w-[58px] h-[58px] rounded-full bg-gradient-to-br from-[#1b7a4b] to-[#0f5838] text-white shadow-2xl hover:scale-115 hover:shadow-[0_12px_28px_rgba(15,88,56,0.45)] transition-all duration-300 no-underline cursor-pointer"
        aria-label={`Hotline: ${phoneDisplay}`}
        title={`Hotline: ${phoneDisplay}`}
      >
        <span className="floating-pulse absolute inset-0 rounded-full border-2 border-[#1b7a4b] pointer-events-none" />
        <Phone size={26} strokeWidth={1.8} className="relative z-10" aria-hidden="true" focusable="false" />
      </a>
    </aside>
  );
}
