'use client';

import React from 'react';

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
        <svg className="w-9 h-9 relative z-10" viewBox="0 0 48 48">
          {/* Bong bóng chat Zalo màu trắng */}
          <path
            fill="#ffffff"
            d="M24 6C13.5 6 5 13.6 5 23c0 3.8 1.4 7.3 3.8 10.2L6.2 40.5a1.2 1.2 0 0 0 1.5 1.5l7.6-2.5C18 40.4 20.9 41 24 41c10.5 0 19-7.6 19-17S34.5 6 24 6z"
          />
          {/* Chữ Zalo màu xanh đậm sắc nét */}
          <text
            x="24"
            y="28"
            fontSize="14"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            textAnchor="middle"
            fill="#0068ff"
            letterSpacing="-0.5"
          >
            Zalo
          </text>
        </svg>
      </a>

      {/* Nút Gọi Hotline: Nút tròn lớn, icon điện thoại rõ nét, hover phóng to */}
      <a
        href={`tel:${phone}`}
        className="floating-circle-btn floating-btn-phone relative flex items-center justify-center w-[58px] h-[58px] rounded-full bg-gradient-to-br from-[#1b7a4b] to-[#0f5838] text-white shadow-2xl hover:scale-115 hover:shadow-[0_12px_28px_rgba(15,88,56,0.45)] transition-all duration-300 no-underline cursor-pointer"
        aria-label={`Hotline: ${phoneDisplay}`}
        title={`Hotline: ${phoneDisplay}`}
      >
        <span className="floating-pulse absolute inset-0 rounded-full border-2 border-[#1b7a4b] pointer-events-none" />
        <svg className="w-7 h-7 fill-white relative z-10" viewBox="0 0 24 24">
          <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
        </svg>
      </a>
    </aside>
  );
}
