// M8 Trang Liên hệ (wireframe contact.html): hero + liên hệ nhanh, thẻ form (U11) | kênh khác + bản đồ.
// Form đóng (F4) ⇒ không sinh mã nào nhắc tới form; chỉ còn khối thông báo + kênh thay thế.
import type React from 'react';
import { ROUTES } from '../../../../contracts/routes.ts';
import type { LoadedSiteContent, Locale } from '../../../content/loader.ts';
import { formatPublicPhone } from '../../../shared/contact/schema.ts';
import { ContactForm } from '../ContactForm.tsx';
import { Icon, MessengerBadge, ZaloMark } from '../icons.tsx';
import { MapBlock } from '../MapBlock.tsx';
import { PhotoBg, pick, Streaks } from '../parts.tsx';
import { fbName, type ShellCompany } from '../Shell.tsx';

export function ContactPage({
  content,
  locale,
  company,
  formOpen,
  hasRecipient,
}: {
  content: LoadedSiteContent;
  locale: Locale;
  company: ShellCompany;
  formOpen: boolean;
  hasRecipient: boolean;
}): React.ReactElement {
  const L = (vi: string, en: string) => pick(locale, vi, en);
  const hasLegalName = Boolean(company.legalName && company.legalName.trim() !== '');
  // FormStatus (build.ts §9): thiếu mail sẵn sàng / email yêu cầu riêng tư / mã số thuế ⇒ form tạm đóng (F4), build vẫn xanh
  const canRenderForm = formOpen && hasRecipient && hasLegalName;
  const phoneRaw = company.phone?.trim() ?? '';
  const phoneShown = phoneRaw ? formatPublicPhone(phoneRaw, locale) : '';
  const zaloRaw = company.zalo?.trim() ?? '';
  // Zalo hiển thị bằng số điện thoại (đuôi số của liên kết zalo.me/<số>), không bao giờ hiện URL thô.
  const zaloDigits = /(\d{9,11})\/?$/.exec(zaloRaw)?.[1] ?? '';
  const zaloShown = zaloDigits ? formatPublicPhone(zaloDigits, locale) : '';
  // V37: Messenger là kênh cố định m.me/gmshungyen, không phụ thuộc số điện thoại hay mục Facebook trong company.yaml.
  // shortcut: tên Page mặc định theo ux-spec V37 [giả định chưa kiểm Fanpage bật nhắn tin]; nâng cấp khi khách xác nhận.
  const fb = fbName(company) ?? 'gmshungyen';
  // shortcut: sitekey công khai đọc từ môi trường lúc build; thiếu ⇒ sitekey thử của Cloudflare (luôn qua, chỉ dùng cho local/staging).
  // Bản deploy_prod phải đặt TURNSTILE_SITE_KEY thật (XQ cho architect/devops: contract chưa nêu nguồn sitekey).
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim() || '1x00000000000000000000AA';
  const newTab = L(' (mở tab mới)', ' (opens in a new tab)');

  const mapPoint = company.mapPoint ?? null;
  const mapQuery = mapPoint ? encodeURIComponent(mapPoint.replace(/\s+/g, '')) : '';
  const polVer = content.policies[locale][0]?.version ?? '1.0';

  return (
    <>
      <section className="hero hero-sub on-dark has-photo" aria-labelledby="h1">
        <PhotoBg photo="plant" locale={locale} priority />
        <Streaks variant="sub" />
        <div className="wrap">
          <div className="fade">
            <h1 id="h1">{L('Liên hệ', 'Contact')}</h1>
            <p className="hero-lead">
              {L(
                'Bạn muốn hợp tác hoặc cần tư vấn? Hãy để lại thông tin, chúng tôi sẽ liên hệ lại.',
                'Want to partner with us or need advice? Leave your details and we will get back to you.',
              )}
            </p>
          </div>
          {phoneRaw || zaloRaw || fb ? (
            <ul className="jump fade" aria-label={L('Liên hệ nhanh', 'Quick contact')}>
              {phoneRaw ? (
                <li>
                  <a href={`tel:${phoneRaw}`}>
                    <Icon name="phone" className="ico" />
                    {L('Đường dây nóng: ', 'Hotline: ')}
                    {phoneShown}
                  </a>
                </li>
              ) : null}
              {zaloRaw ? (
                <li>
                  <a href={zaloRaw} target="_blank" rel="noopener noreferrer">
                    <ZaloMark size={20} />
                    {L('Nhắn Zalo', 'Message on Zalo')}
                    <span className="sr-only">{newTab}</span>
                  </a>
                </li>
              ) : null}
              {fb ? (
                <li>
                  <a href={`https://m.me/${fb}`} target="_blank" rel="noopener noreferrer">
                    <MessengerBadge />
                    {L('Nhắn Messenger', 'Message on Messenger')}
                    <span className="sr-only">{newTab}</span>
                  </a>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </section>
      <section
        className="sec sec-mist c-sec"
        aria-label={L('Form liên hệ và kênh liên hệ', 'Contact form and channels')}
      >
        <div className="wrap">
          <div className="c-grid">
            <div className="c-card" id="lien-he-form">
              <h2>{L('Gửi liên hệ cho GMS', 'Contact GMS')}</h2>
              {canRenderForm ? (
                <ContactForm
                  locale={locale}
                  policyVersion={polVer}
                  phoneRaw={phoneRaw}
                  phoneShown={phoneShown}
                  zaloRaw={zaloRaw}
                  messengerHref={`https://m.me/${fb}`}
                  siteKey={siteKey}
                  homeHref={ROUTES.home[locale]}
                  privacyHref={ROUTES.privacy[locale]}
                  legalName={company.legalName ?? ''}
                />
              ) : (
                <div className="f-off" data-testid="contact-form-disabled">
                  <p className="f-msg info" role="status">
                    <Icon name="info" size={18} />
                    <span>
                      {L(
                        'Form liên hệ tạm thời chưa mở. Bạn có thể liên hệ GMS qua các kênh dưới đây.',
                        'The contact form is temporarily unavailable. You can reach GMS through the channels below.',
                      )}
                    </span>
                  </p>
                  {phoneRaw || zaloRaw || fb ? (
                    <ul className="f-alt-l">
                      {phoneRaw ? (
                        <li>
                          <a className="btn-sec" href={`tel:${phoneRaw}`}>
                            <Icon name="phone" className="ico" />
                            {phoneShown}
                          </a>
                        </li>
                      ) : null}
                      {zaloRaw ? (
                        <li>
                          <a className="btn-sec" href={zaloRaw} rel="noopener noreferrer">
                            <ZaloMark size={20} className="il-zalo" />
                            Zalo
                          </a>
                        </li>
                      ) : null}
                      {fb ? (
                        <li>
                          <a className="btn-sec" href={`https://m.me/${fb}`} target="_blank" rel="noopener noreferrer">
                            <MessengerBadge />
                            Messenger
                          </a>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              )}
            </div>
            <aside className="nap">
              <div data-testid="contact-channels">
                <h2>{L('Kênh liên hệ khác', 'Other contact channels')}</h2>
                <ul className="ch-list">
                  {phoneRaw ? (
                    <li>
                      <a className="ch" href={`tel:${phoneRaw}`}>
                        <span className="ch-ico">
                          <Icon name="phone" />
                        </span>
                        <span className="ch-txt">
                          <span className="ch-lbl">{L('Điện thoại', 'Phone')}</span>
                          <span className="ch-val">{phoneShown}</span>
                        </span>
                      </a>
                    </li>
                  ) : null}
                  {zaloRaw ? (
                    <li>
                      <a className="ch" href={zaloRaw} target="_blank" rel="noopener noreferrer">
                        <span className="ch-ico">
                          <ZaloMark size={24} className="zalo-mark il-zalo" />
                        </span>
                        <span className="ch-txt">
                          <span className="ch-lbl">{L('Nhắn Zalo', 'Message on Zalo')}</span>
                          <span className="ch-val">
                            {zaloShown ? `Zalo ${zaloShown}` : 'Zalo'}
                            <span className="sr-only">{newTab}</span>
                          </span>
                        </span>
                      </a>
                    </li>
                  ) : null}
                  {fb ? (
                    <li>
                      <a className="ch" href={`https://m.me/${fb}`} target="_blank" rel="noopener noreferrer">
                        <span className="ch-ico">
                          <MessengerBadge />
                        </span>
                        <span className="ch-txt">
                          <span className="ch-lbl">{L('Nhắn Messenger', 'Message on Messenger')}</span>
                          <span className="ch-val">{`m.me/${fb}`}</span>
                        </span>
                        <span className="sr-only">{newTab}</span>
                      </a>
                    </li>
                  ) : null}
                  {company.address?.[locale] ? (
                    <li>
                      <div className="ch">
                        <span className="ch-ico">
                          <Icon name="map-pin" />
                        </span>
                        <span className="ch-txt">
                          <span className="ch-lbl">{L('Địa chỉ', 'Address')}</span>
                          <span className="ch-val">{company.address[locale]}</span>
                        </span>
                      </div>
                    </li>
                  ) : null}
                </ul>
              </div>
              {mapPoint ? (
                <MapBlock
                  locale={locale}
                  point={mapPoint}
                  query={mapQuery}
                  linkUrl={`https://maps.google.com/?q=${mapQuery}`}
                />
              ) : null}
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
