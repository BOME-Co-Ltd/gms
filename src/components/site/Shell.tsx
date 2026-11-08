// Khung trang theo wireframe green v0.3.8 (ux-spec V26/V27/V31–V34): thanh trên, header logo, cờ ngôn ngữ, ngăn kéo,
// chân trang trắng, cụm nút nổi. Thứ tự DOM = tab = đọc.
import type React from 'react';
import { ROUTES } from '../../../contracts/routes.ts';
import { safeHref } from '../../../contracts/safe-url.ts';
import type { LoadedCompany, Locale } from '../../content/loader.ts';
import { formatPublicPhone } from '../../shared/contact/schema.ts';
import { BrandMark, GmsLogo, Icon, LogoSprite, ZaloMark } from './icons.tsx';
import { FOOTER_KEYS, MAIN_KEYS, MENU_LABELS, type StaticPageKey, SUB_KEYS } from './menu.ts';
import { ShellBehavior } from './ShellBehavior.tsx';

export type ShellCompany = LoadedCompany & { social: Array<{ url: string }> };

/** `Company.social[]` thô (content/company.yaml) → chỉ giữ URL qua safeHref; thiếu/sai dạng ⇒ [] (hàng Fanpage ẩn). */
export function parseSocial(raw: unknown): Array<{ url: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ url: string }> = [];
  for (const item of raw) {
    const r = safeHref((item as { url?: unknown } | null)?.url);
    if (r.ok) out.push({ url: r.href });
  }
  return out;
}

const T = {
  vi: {
    hotline: 'Đường dây nóng: ',
    hotlineShort: 'Đường dây nóng',
    topSub: 'Menu phụ',
    navMain: 'Menu chính',
    navDrawerMain: 'Menu chính (di động)',
    navDrawerSub: 'Menu phụ (di động)',
    langLabel: 'Đổi ngôn ngữ. Đang xem: ',
    langVi: 'Tiếng Việt',
    langEn: 'English',
    openMenu: 'Mở menu',
    closeMenu: 'Đóng menu',
    drawerTitle: 'Menu',
    toTop: 'Về đầu trang',
    zaloAria: 'Chat Zalo',
    msgAria: 'Nhắn tin Messenger (mở cửa sổ mới)',
    msgTitle: 'Nhắn tin Messenger',
    call: 'Gọi',
    newWin: '(mở cửa sổ mới)',
    quick: 'Liên hệ nhanh',
    skip: 'Bỏ qua, tới nội dung chính',
    brand: 'GMS Hưng Yên, về trang chủ',
    slogan: 'Giải pháp thông minh, Kiến tạo giá trị xanh',
    logo: 'Logo GMS',
    ft: {
      contact: 'Liên hệ',
      phone: 'Điện thoại: ',
      zalo: 'Zalo: ',
      fanpage: 'Fanpage: ',
      address: 'Địa chỉ: ',
      taxId: 'Mã số thuế: ',
      navLabel: 'Liên kết chân trang',
      newTab: '(mở tab mới)',
      rights: 'Tất cả các quyền được bảo lưu.',
    },
  },
  en: {
    hotline: 'Hotline: ',
    hotlineShort: 'Hotline',
    topSub: 'Secondary menu',
    navMain: 'Main menu',
    navDrawerMain: 'Main menu (mobile)',
    navDrawerSub: 'Secondary menu (mobile)',
    langLabel: 'Change language. Viewing: ',
    langVi: 'Tiếng Việt',
    langEn: 'English',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    drawerTitle: 'Menu',
    toTop: 'Back to top',
    zaloAria: 'Chat on Zalo',
    msgAria: 'Message on Messenger (opens in a new window)',
    msgTitle: 'Message on Messenger',
    call: 'Call',
    newWin: '(opens in a new window)',
    quick: 'Quick contact',
    skip: 'Skip to main content',
    brand: 'GMS Hung Yen, back to home',
    slogan: 'Smart solutions, Creating green value',
    logo: 'GMS logo',
    ft: {
      contact: 'Contact',
      phone: 'Phone: ',
      zalo: 'Zalo: ',
      fanpage: 'Fanpage: ',
      address: 'Address: ',
      taxId: 'Tax ID: ',
      navLabel: 'Footer links',
      newTab: '(opens in a new tab)',
      rights: 'All rights reserved.',
    },
  },
} as const;

function Flag({ kind }: { kind: 'vi' | 'en' }): React.ReactElement {
  if (kind === 'vi') {
    return (
      <svg className="flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false">
        <rect width="30" height="20" fill="#DA251D" />
        <path
          fill="#FFFF00"
          d="M15 4.2l1.35 4.15h4.37l-3.53 2.57 1.35 4.15L15 12.5l-3.54 2.57 1.35-4.15-3.53-2.57h4.37z"
        />
      </svg>
    );
  }
  return (
    <svg className="flag" viewBox="0 0 60 40" aria-hidden="true" focusable="false">
      <clipPath id="uk-c">
        <rect width="60" height="40" />
      </clipPath>
      <g clipPath="url(#uk-c)">
        <rect width="60" height="40" fill="#012169" />
        <path d="M0 0l60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
        <path d="M0 0l60 40M60 0L0 40" stroke="#C8102E" strokeWidth="3" />
        <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="12" />
        <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="7" />
      </g>
    </svg>
  );
}

function Links({
  keys,
  locale,
  active,
  testId,
}: {
  keys: StaticPageKey[];
  locale: Locale;
  active?: StaticPageKey;
  testId: boolean;
}) {
  return (
    <>
      {keys.map((k) => (
        <li key={k}>
          <a
            href={ROUTES[k][locale]}
            data-testid={testId ? 'nav-menu' : undefined}
            aria-current={active === k ? 'page' : undefined}
          >
            {MENU_LABELS[locale][k]}
          </a>
        </li>
      ))}
    </>
  );
}

export function fbName(company: ShellCompany): string | undefined {
  return company.social.map((s) => s.url.match(/facebook\.com\/([^/?#]+)/i)?.[1]).find((n): n is string => Boolean(n));
}

export function SiteHeader({
  locale,
  viPath,
  enPath,
  company,
  active,
}: {
  locale: Locale;
  viPath: string;
  enPath: string;
  company: ShellCompany;
  active?: StaticPageKey;
}): React.ReactElement {
  const t = T[locale];
  const phoneRaw = company.phone?.trim() ?? '';
  const phoneShown = phoneRaw ? formatPublicPhone(phoneRaw, locale) : '';
  const viCur = locale === 'vi';
  return (
    <>
      <LogoSprite />
      <a href="#noi-dung" className="skip-link" data-testid="nav-menu">
        {t.skip}
      </a>
      <div className="top">
        <div className="wrap">
          {phoneRaw ? (
            <a href={`tel:${phoneRaw}`} data-testid="nav-menu">
              <Icon name="phone" className="ico" />
              {t.hotline}
              {phoneShown}
            </a>
          ) : (
            <span />
          )}
          <nav aria-label={t.topSub}>
            <ul>
              <Links keys={SUB_KEYS} locale={locale} active={active} testId />
            </ul>
          </nav>
        </div>
      </div>
      <header className="hdr">
        <div className="wrap">
          <a className="brand" href={ROUTES.home[locale]} aria-label={t.brand} data-testid="nav-menu">
            <GmsLogo className="logo-gms" />
          </a>
          <nav className="nav" data-testid="nav-main" aria-label={t.navMain}>
            <ul>
              <Links keys={MAIN_KEYS} locale={locale} active={active} testId />
            </ul>
          </nav>
          <div className="hdr-end">
            <nav
              className="lang"
              data-testid="lang-switcher"
              aria-label={`${t.langLabel}${viCur ? t.langVi : t.langEn}`}
            >
              <span className="lang-pill" aria-hidden="true" />
              <a
                href={viPath}
                hrefLang="vi"
                lang="vi"
                aria-label={t.langVi}
                title={t.langVi}
                aria-current={viCur ? 'true' : undefined}
              >
                <Flag kind="vi" />
              </a>
              <a
                href={enPath}
                hrefLang="en"
                lang="en"
                aria-label={t.langEn}
                title={t.langEn}
                aria-current={viCur ? undefined : 'true'}
              >
                <Flag kind="en" />
              </a>
            </nav>
            <button className="menu-btn" id="menu-btn" type="button" aria-controls="drawer" aria-expanded="false">
              <Icon name="menu" size={24} className="ico" />
              <span className="t">{t.openMenu}</span>
            </button>
          </div>
        </div>
      </header>
      <div className="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" hidden>
        <div className="drawer-bg" aria-hidden="true" />
        <div className="drawer-panel">
          <div className="drawer-top">
            <span id="drawer-title">{t.drawerTitle}</span>
            <button className="close-btn" id="menu-close" type="button">
              <Icon name="x" className="ico" />
              {t.closeMenu}
            </button>
          </div>
          <nav aria-label={t.navDrawerMain}>
            <ul className="d-main">
              <Links keys={MAIN_KEYS} locale={locale} active={active} testId={false} />
            </ul>
          </nav>
          <nav aria-label={t.navDrawerSub}>
            <ul className="d-sub">
              <Links keys={SUB_KEYS} locale={locale} active={active} testId={false} />
            </ul>
          </nav>
          {phoneRaw ? (
            <div className="d-hot">
              <span>{t.hotlineShort}</span>
              <a href={`tel:${phoneRaw}`}>
                <Icon name="phone" size={24} className="ico" />
                {phoneShown}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function FtRow({
  icon,
  label,
  href,
  external,
  address,
  testId,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  external?: boolean;
  address?: boolean;
  testId?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const Val = address ? 'address' : 'span';
  const inner = (
    <>
      <span className="ft-ico">{icon}</span>
      <Val className="ft-val">
        <span className="sr-only">{label}</span>
        {children}
      </Val>
    </>
  );
  return (
    <li data-testid={testId}>
      {href ? (
        <a className="ft-row" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {inner}
        </a>
      ) : (
        <div className="ft-row">{inner}</div>
      )}
    </li>
  );
}

export function SiteFooter({
  locale,
  company,
  active,
}: {
  locale: Locale;
  company: ShellCompany;
  active?: StaticPageKey;
}): React.ReactElement {
  const t = T[locale];
  const f = t.ft;
  const name = company.legalName || (locale === 'vi' ? 'GMS Hưng Yên' : 'GMS Hung Yen');
  const phoneRaw = company.phone?.trim() ?? '';
  const zaloRaw = company.zalo?.trim() ?? '';
  const phoneShown = phoneRaw ? formatPublicPhone(phoneRaw, locale) : '';
  const address = company.address?.[locale]?.trim() ?? '';
  const taxId = company.taxId?.trim() ?? '';
  const hasContact = Boolean(phoneRaw || zaloRaw || company.social.length > 0 || address || taxId);
  const rowsPerCol = Math.max(1, Math.ceil(FOOTER_KEYS.length / 2));
  const newTab = <span className="sr-only"> {f.newTab}</span>;
  return (
    <footer className="ft" data-testid="footer">
      <div className="ft-wrap">
        <div className="ft-grid">
          <div className="ft-brand">
            <GmsLogo className="ft-logo" label={t.logo} />
            <p className="ft-name" lang={locale === 'vi' ? undefined : 'vi'}>
              {name}
            </p>
            <p className="ft-slogan">{t.slogan}</p>
          </div>
          {hasContact ? (
            <section className="ft-contact" aria-labelledby="ft-contact-h">
              <h2 id="ft-contact-h" className="sr-only">
                {f.contact}
              </h2>
              <ul>
                {phoneRaw ? (
                  <FtRow icon={<Icon name="phone" />} label={f.phone} href={`tel:${phoneRaw}`}>
                    {phoneShown}
                  </FtRow>
                ) : null}
                {zaloRaw ? (
                  <FtRow icon={<ZaloMark size={22} />} label={f.zalo} href={zaloRaw} external>
                    <span>Zalo {phoneShown || zaloRaw.replace(/^https?:\/\//i, '')}</span>
                    {newTab}
                  </FtRow>
                ) : null}
                {company.social.map((s) => (
                  <FtRow key={s.url} icon={<BrandMark name="facebook" />} label={f.fanpage} href={s.url} external>
                    {s.url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '')}
                    {newTab}
                  </FtRow>
                ))}
                {address ? (
                  <FtRow icon={<Icon name="map-pin" />} label={f.address} address>
                    {address}
                  </FtRow>
                ) : null}
                {taxId ? (
                  <FtRow icon={<Icon name="receipt-text" />} label={f.taxId} testId="tax-id">
                    {taxId}
                  </FtRow>
                ) : null}
              </ul>
            </section>
          ) : null}
          <nav className="ft-nav" aria-label={f.navLabel}>
            <ul style={{ '--rows': rowsPerCol } as React.CSSProperties}>
              {FOOTER_KEYS.map((k) => (
                <li key={k}>
                  <a className="ft-link" href={ROUTES[k][locale]} aria-current={active === k ? 'page' : undefined}>
                    {MENU_LABELS[locale][k]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="ft-bottom">
          <p>
            © {new Date().getFullYear()}. {f.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Cụm nút nổi góc phải dưới: về đầu trang · Zalo · Messenger · Gọi (V31–V32). */
export function SiteFabs({ locale, company }: { locale: Locale; company: ShellCompany }): React.ReactElement {
  const t = T[locale];
  const phoneRaw = company.phone?.trim() ?? '';
  const zaloRaw = company.zalo?.trim() ?? '';
  const phoneShown = phoneRaw ? formatPublicPhone(phoneRaw, locale) : '';
  // Messenger: suy từ fanpage facebook.com/<tên> ⇒ m.me/<tên> [giả định, chờ khách xác nhận, wireframe ghi cùng điều này].
  const fb = fbName(company);
  return (
    <fieldset className="fabs floating-contact-group" aria-label={t.quick} data-testid="floating-contact">
      <a className="fab to-top" href="#top" aria-label={t.toTop} title={t.toTop} data-testid="back-to-top">
        <Icon name="arrow-up" size={26} strokeWidth={2} className="ico" />
      </a>
      {zaloRaw ? (
        <a
          className="fab fab-zalo floating-circle-btn"
          href={zaloRaw}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t.zaloAria}${phoneShown ? ` ${phoneShown}` : ''} ${t.newWin}`}
          title={t.zaloAria}
          data-testid="fab-zalo"
        >
          <ZaloMark size={36} />
        </a>
      ) : null}
      {fb ? (
        <a
          className="fab fab-msg floating-circle-btn"
          href={`https://m.me/${fb}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.msgAria}
          title={t.msgTitle}
          data-testid="fab-messenger"
        >
          <BrandMark name="messenger" />
        </a>
      ) : null}
      {phoneRaw ? (
        <a
          className="fab fab-tel floating-circle-btn"
          href={`tel:${phoneRaw}`}
          aria-label={`${t.call} ${phoneShown}`}
          title={`${t.call} ${phoneShown}`}
          data-testid="fab-call"
        >
          <Icon name="phone" size={26} strokeWidth={2} className="ico" />
        </a>
      ) : null}
    </fieldset>
  );
}

/** Khung đầy đủ quanh `<main>`. `children` là nội dung `<main>` (đã gồm hero). */
export function SiteFrame({
  locale,
  viPath,
  enPath,
  company,
  active,
  children,
}: {
  locale: Locale;
  viPath: string;
  enPath: string;
  company: ShellCompany;
  active?: StaticPageKey;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <SiteHeader locale={locale} viPath={viPath} enPath={enPath} company={company} active={active} />
      <main id="noi-dung" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter locale={locale} company={company} active={active} />
      <SiteFabs locale={locale} company={company} />
      <ShellBehavior />
    </>
  );
}
