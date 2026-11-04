import type React from 'react';

export interface FooterProps {
  locale: 'vi' | 'en';
  brandName: string;
  slogan: string;
  address?: string;
  phone?: string;
  phoneDisplay?: string;
  zalo?: string;
  taxId?: string;
  privacyHref: string;
  privacyLabel: string;
  contactHref: string;
  contactLabel: string;
}

export function Footer({
  locale,
  brandName,
  slogan,
  address,
  phone,
  phoneDisplay,
  zalo,
  taxId,
  privacyHref,
  privacyLabel,
  contactHref,
  contactLabel,
}: FooterProps): React.ReactElement {
  const isVi = locale === 'vi';

  return (
    <footer className="site-footer on-dark bg-[#0a3e27] text-white pt-12 pb-8 border-t-2 border-[#1b7a4b]/30" data-testid="footer">
      <div className="container mx-auto max-w-[1200px] px-4">
        <div className="footer-grid grid gap-8 md:grid-cols-2 lg:grid-cols-4 pb-8 border-b border-white/15">
          {/* Cột 1: Thông tin thương hiệu */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <img src="/brand/logo-gms-mark.svg" alt={brandName} width={100} height={28} className="brightness-0 invert h-7 w-auto" />
            </div>
            <p className="font-bold text-white text-base leading-snug">
              <strong>{brandName}</strong>
            </p>
            <p className="text-white/80 text-sm leading-relaxed">{slogan}</p>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#1b7a4b]/40 text-emerald-200 border border-emerald-500/20">
                🌿 {isVi ? 'Công nghệ sạch tuần hoàn' : 'Clean circular technology'}
              </span>
            </div>
          </div>

          {/* Cột 2: Trụ sở & Kênh liên hệ */}
          <div className="space-y-2.5 text-sm">
            <h4 className="text-emerald-300 font-bold uppercase tracking-wider text-xs mb-3">
              {isVi ? 'Thông tin liên hệ' : 'Contact Information'}
            </h4>
            {address ? (
              <p className="text-white/90 leading-relaxed">
                <strong className="text-white">📍 {isVi ? 'Địa chỉ' : 'Address'}:</strong> {address}
              </p>
            ) : null}
            {phone ? (
              <p className="text-white/90">
                <strong className="text-white">📞 {isVi ? 'Điện thoại' : 'Phone'}:</strong>{' '}
                <a href={`tel:${phone}`} className="text-emerald-300 hover:text-white font-semibold underline underline-offset-2 transition-colors">
                  {phoneDisplay ?? phone}
                </a>
              </p>
            ) : null}
            {zalo ? (
              <p className="text-white/90">
                <strong className="text-white">💬 Zalo:</strong>{' '}
                <a href={zalo} rel="noopener noreferrer" target="_blank" className="text-emerald-300 hover:text-white underline underline-offset-2 transition-colors">
                  {zalo}
                </a>
              </p>
            ) : null}
            {taxId ? (
              <p data-testid="tax-id" className="text-white/90">
                <strong className="text-white">🏛️ {isVi ? 'Mã số thuế' : 'Tax ID'}:</strong> {taxId}
              </p>
            ) : null}
          </div>

          {/* Cột 3: Liên kết nhanh */}
          <div className="space-y-2 text-sm">
            <h4 className="text-emerald-300 font-bold uppercase tracking-wider text-xs mb-3">
              {isVi ? 'Liên kết chính' : 'Quick Links'}
            </h4>
            <ul className="space-y-1.5 list-none p-0 m-0">
              <li>
                <a href={isVi ? '/' : '/en'} className="text-white/80 hover:text-white hover:underline transition-colors">
                  {isVi ? 'Trang chủ' : 'Home'}
                </a>
              </li>
              <li>
                <a href={isVi ? '/gioi-thieu' : '/en/about'} className="text-white/80 hover:text-white hover:underline transition-colors">
                  {isVi ? 'Giới thiệu GMS' : 'About GMS'}
                </a>
              </li>
              <li>
                <a href={isVi ? '/cong-nghe' : '/en/technology'} className="text-white/80 hover:text-white hover:underline transition-colors">
                  {isVi ? 'Công nghệ VPD' : 'VPD Technology'}
                </a>
              </li>
              <li>
                <a href={isVi ? '/san-pham-dau-ra' : '/en/products'} className="text-white/80 hover:text-white hover:underline transition-colors">
                  {isVi ? 'Sản phẩm đầu ra' : 'Output Products'}
                </a>
              </li>
              <li>
                <a href={contactHref} className="text-white/80 hover:text-white hover:underline transition-colors">
                  {contactLabel}
                </a>
              </li>
            </ul>
          </div>

          {/* Cột 4: Tiêu chuẩn & Pháp lý */}
          <div className="space-y-2 text-sm">
            <h4 className="text-emerald-300 font-bold uppercase tracking-wider text-xs mb-3">
              {isVi ? 'Tiêu chuẩn & Pháp lý' : 'Compliance & Legal'}
            </h4>
            <p className="text-white/80 text-xs leading-relaxed">
              {isVi
                ? 'Nhà máy tuân thủ quy chuẩn kỹ thuật môi trường quốc gia và Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15.'
                : 'Compliant with national environmental emission standards and Personal Data Protection Law.'}
            </p>
            <div className="pt-2">
              <a
                href={privacyHref}
                className="inline-flex items-center gap-1 text-emerald-300 hover:text-white font-semibold underline underline-offset-2 transition-colors text-sm"
              >
                🔒 {privacyLabel}
              </a>
            </div>
          </div>
        </div>

        {/* Dòng bản quyền dưới cùng */}
        <div className="footer-bottom flex flex-wrap items-center justify-between gap-4 pt-6 text-xs text-white/70">
          <p className="m-0">
            © 2026 {brandName}. {isVi ? 'Tất cả các quyền được bảo lưu.' : 'All rights reserved.'}
          </p>
        </div>
      </div>
    </footer>
  );
}
