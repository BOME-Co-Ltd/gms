// M10 Chính sách bảo mật: khối thông tin bắt buộc (phiên bản, căn cứ pháp lý, bên kiểm soát, mục đích, quyền) + thân chính sách.
import type React from 'react';
import type { LoadedSiteContent, Locale } from '../../../content/loader.ts';
import { formatDateLocale } from '../menu.ts';
import { Html, pick, SubHero } from '../parts.tsx';

export function PrivacyPage({ content, locale }: { content: LoadedSiteContent; locale: Locale }): React.ReactElement {
  const isVi = locale === 'vi';
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const pol = content.policies[locale][0];
  const ver = pol?.version ?? '1.0';
  const eff = formatDateLocale(pol?.effectiveFrom ?? '2026-01-01', locale);
  const ctrl = content.company.legalName || 'Công ty Cổ phần Môi trường Năng lượng Xanh Hưng Yên';
  const reqEmail = content.company.privacyRequestEmail?.trim() ?? '';
  // Thiếu email nhận yêu cầu ⇒ không in liên kết mailto: rỗng hay dòng email trống.
  const mail = reqEmail ? <a href={`mailto:${reqEmail}`}>{reqEmail}</a> : null;
  return (
    <>
      <SubHero
        eyebrow={L('Bảo vệ dữ liệu cá nhân', 'Personal data protection')}
        title={L('Chính sách bảo mật dữ liệu cá nhân', 'Personal Data Privacy Policy')}
      />
      <section className="sec">
        <div className="wrap">
          <div className="art-col prose">
            {isVi ? (
              <>
                <p>
                  <strong>Phiên bản:</strong> {ver} — <strong>Ngày hiệu lực:</strong> {eff}
                </p>
                <p>
                  <strong>Căn cứ pháp lý:</strong> Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định
                  356/2025/NĐ-CP.
                </p>
                <p>
                  <strong>Bên kiểm soát dữ liệu:</strong> {ctrl}.
                </p>
                <p>
                  <strong>Mục đích xử lý:</strong> Tiếp nhận, liên hệ lại và trả lời yêu cầu của người gửi từ biểu mẫu
                  liên hệ.
                </p>
                <p>
                  <strong>Ai được xem / truy cập:</strong> Bộ phận phụ trách liên hệ của {ctrl} và nhà cung cấp hạ tầng
                  kỹ thuật Cloudflare.
                </p>
                <p>
                  <strong>Quyền của chủ thể dữ liệu:</strong> Bạn có quyền yêu cầu xem, sửa, xoá dữ liệu cá nhân hoặc
                  rút lại đồng ý bất cứ lúc nào{' '}
                  {mail ? (
                    <>bằng cách gửi yêu cầu tới địa chỉ email nhận yêu cầu về dữ liệu: {mail}.</>
                  ) : (
                    'bằng cách liên hệ với bên kiểm soát dữ liệu qua các kênh nêu ở trang Liên hệ.'
                  )}
                </p>
              </>
            ) : (
              <>
                <p>
                  <strong>Version:</strong> {ver} — <strong>Effective date:</strong> {eff}
                </p>
                <p>
                  <strong>Legal basis:</strong> Personal Data Protection Law No. 91/2025/QH15 and Decree 356/2025/ND-CP.
                </p>
                <p>
                  <strong>Data controller:</strong> {ctrl}.
                </p>
                <p>
                  <strong>Purpose of processing:</strong> Receiving, contacting and responding to inquiries submitted
                  via the contact form.
                </p>
                <p>
                  <strong>Who can access:</strong> Authorized staff at {ctrl} and technical processor Cloudflare.
                </p>
                <p>
                  <strong>Your rights:</strong> You have the right to access, rectify or request deletion / erasure of
                  your personal data, or withdraw your consent at any time by{' '}
                  {mail ? (
                    <>contacting: {mail}.</>
                  ) : (
                    'contacting the data controller through the channels listed on the Contact page.'
                  )}
                </p>
              </>
            )}
            <Html html={pol?.bodyHtml ?? ''} />
          </div>
        </div>
      </section>
    </>
  );
}
