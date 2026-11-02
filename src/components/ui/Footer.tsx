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
    <footer className="site-footer on-dark bg-[#0F5838] py-10 text-white" data-testid="footer">
      <div className="container mx-auto max-w-[1200px] px-4">
        <div className="footer-grid grid gap-6 md:grid-cols-3">
          <div>
            <p className="font-bold text-white">
              <strong>{brandName}</strong>
            </p>
            <p className="text-white/90">{slogan}</p>
          </div>
          <div>
            {address ? (
              <p>
                <strong>{isVi ? 'Địa chỉ' : 'Address'}:</strong> {address}
              </p>
            ) : null}
            {phone ? (
              <p>
                <strong>{isVi ? 'Điện thoại' : 'Phone'}:</strong>{' '}
                <a href={`tel:${phone}`} className="text-white underline">
                  {phoneDisplay ?? phone}
                </a>
              </p>
            ) : null}
            {zalo ? (
              <p>
                <strong>Zalo:</strong>{' '}
                <a href={zalo} rel="noopener noreferrer" className="text-white underline">
                  {zalo}
                </a>
              </p>
            ) : null}
            {taxId ? (
              <p data-testid="tax-id">
                <strong>{isVi ? 'Mã số thuế' : 'Tax ID'}:</strong> {taxId}
              </p>
            ) : null}
          </div>
          <div>
            <p>
              <a href={privacyHref} className="text-white underline">
                {privacyLabel}
              </a>{' '}
              ·{' '}
              <a href={contactHref} className="text-white underline">
                {contactLabel}
              </a>
            </p>
          </div>
        </div>
        <div className="footer-bottom mt-6 border-t border-white/20 pt-4 text-sm text-white/80">
          <p>© 2026 {brandName}</p>
        </div>
      </div>
    </footer>
  );
}
