// Chân trang U10 cho bản build tĩnh (ux-spec §14a). Thuần chuỗi HTML, không fetch/env (FE-ATOMIC).
// Thứ tự DOM = tab = đọc: Thương hiệu → Liên hệ → Khám phá → Thông tin → bản quyền. Trường trống ⇒ ẩn hàng.
import { safeHref } from '../../../contracts/safe-url.ts';
import { icon } from './static-icons.ts';

type FooterLocale = 'vi' | 'en';

export type FooterLink = { href: string; label: string; current?: boolean };

export type FooterInput = {
  locale: FooterLocale;
  /** Company.legalName: một chuỗi, hiện đúng nguyên văn ở cả vi và en. */
  legalName: string;
  slogan: string;
  year: number;
  phone?: { href: string; text: string } | null;
  zalo?: { href: string; text: string } | null;
  fanpages?: Array<{ url: string }>;
  address?: string | null;
  taxId?: string | null;
  explore: FooterLink[];
  info: FooterLink[];
};

const TEXT = {
  vi: {
    contact: 'Liên hệ',
    explore: 'Khám phá',
    info: 'Thông tin',
    phone: 'Điện thoại',
    zalo: 'Zalo',
    fanpage: 'Fanpage',
    address: 'Địa chỉ',
    taxId: 'Mã số thuế',
    navLabel: 'Liên kết chân trang',
    newTab: '(mở tab mới)',
    rights: 'Tất cả các quyền được bảo lưu.',
  },
  en: {
    contact: 'Contact',
    explore: 'Explore',
    info: 'Information',
    phone: 'Phone',
    zalo: 'Zalo',
    fanpage: 'Fanpage',
    address: 'Address',
    taxId: 'Tax ID',
    navLabel: 'Footer links',
    newTab: '(opens in a new tab)',
    rights: 'All rights reserved.',
  },
} as const;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

/** facebook.com/gmshungyen thay cho https://www.facebook.com/gmshungyen/ */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '');
}

function row(opts: {
  ic: Parameters<typeof icon>[0];
  label: string;
  valueHtml: string;
  href?: string;
  external?: boolean;
  tag?: 'span' | 'address';
}): string {
  const tag = opts.tag ?? 'span';
  const inner = `${icon(opts.ic)}<span class="ft-text"><span class="ft-label">${esc(opts.label)}</span><${tag} class="ft-value">${opts.valueHtml}</${tag}></span>`;
  if (!opts.href) return `<li><div class="ft-row">${inner}</div></li>`;
  const ext = opts.external ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<li><a class="ft-row" href="${esc(opts.href)}"${ext}>${inner}</a></li>`;
}

function linkList(links: FooterLink[]): string {
  return links
    .map(
      (l) =>
        `<li><a class="ft-link" href="${esc(l.href)}"${l.current ? ' aria-current="page"' : ''}>${esc(l.label)}</a></li>`,
    )
    .join('');
}

/** Các hàng liên hệ có dữ liệu; rỗng ⇒ '' (cả khối "Liên hệ" bị bỏ). */
export function buildContactRowsHtml(input: FooterInput): string {
  const t = TEXT[input.locale];
  const sr = (s: string) => `<span class="sr-only"> ${s}</span>`;
  const rows: string[] = [];
  if (input.phone) {
    rows.push(row({ ic: 'phone', label: t.phone, valueHtml: esc(input.phone.text), href: input.phone.href }));
  }
  if (input.zalo) {
    rows.push(
      row({
        ic: 'message-circle',
        label: t.zalo,
        valueHtml: `${esc(input.zalo.text)}${sr(t.newTab)}`,
        href: input.zalo.href,
        external: true,
      }),
    );
  }
  for (const f of input.fanpages ?? []) {
    rows.push(
      row({
        ic: 'external-link',
        label: t.fanpage,
        valueHtml: `${esc(displayUrl(f.url))}${sr(t.newTab)}`,
        href: f.url,
        external: true,
      }),
    );
  }
  if (input.address?.trim()) {
    rows.push(row({ ic: 'map-pin', label: t.address, valueHtml: esc(input.address.trim()), tag: 'address' }));
  }
  if (input.taxId?.trim()) {
    // data-testid="tax-id" ở <li>: ẩn thì mất cả dòng lẫn nhãn.
    rows.push(
      row({ ic: 'receipt-text', label: t.taxId, valueHtml: esc(input.taxId.trim()) }).replace(
        '<li>',
        '<li data-testid="tax-id">',
      ),
    );
  }
  return rows.join('');
}

export function buildFooterHtml(input: FooterInput): string {
  const t = TEXT[input.locale];
  const name = esc(input.legalName);
  const rows = buildContactRowsHtml(input);
  const contact = rows
    ? `<section class="ft-contact" aria-labelledby="ft-contact-h"><h2 id="ft-contact-h">${t.contact}</h2><ul>${rows}</ul></section>`
    : '';
  // Khung EN: tên pháp lý giữ nguyên chuỗi tiếng Việt, đánh dấu lang="vi".
  const nameAttr = input.locale === 'vi' ? '' : ' lang="vi"';
  const rightsName = input.locale === 'vi' ? name : `<span lang="vi">${name}</span>`;
  return `<footer class="ft on-dark" data-testid="footer">
    <div class="ft-wrap">
      <div class="ft-grid">
        <div class="ft-brand">
          <span class="ft-logo" aria-hidden="true">GMS</span>
          <p class="ft-name"${nameAttr}>${name}</p>
          <p class="ft-slogan">${esc(input.slogan)}</p>
        </div>
        ${contact}
        <nav class="ft-nav" aria-label="${t.navLabel}">
          <div><h2>${t.explore}</h2><ul>${linkList(input.explore)}</ul></div>
          <div><h2>${t.info}</h2><ul>${linkList(input.info)}</ul></div>
        </nav>
      </div>
      <div class="ft-bottom"><p>© ${input.year} ${rightsName}. ${t.rights}</p></div>
    </div>
  </footer>`;
}

/** CSS chân trang; điểm gãy 600/900 (ux-spec §14a). Token --g900 --lime --white --radius-s từ :root của build-site. */
export const FOOTER_CSS = `
.ft { background: var(--g900); color: var(--white); padding: 40px 0 24px; margin-top: 40px; --ft-pad: 16px; --ft-muted: #DCE8E2; }
.ft-wrap { max-width: 1200px; margin: 0 auto; padding: 0 var(--ft-pad); }
.ft-grid { display: grid; gap: 32px; }
.ft a, .ft a:hover { color: var(--white); }
.ft h2 { margin: 0 0 12px; color: var(--white); font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; line-height: 1.3; }
.ft h2::after { content: ""; display: block; width: 28px; height: 3px; margin-top: 8px; border-radius: 3px; background: var(--lime); }
.ft ul { list-style: none; margin: 0; padding: 0; }
.ft-logo { display: inline-grid; place-items: center; min-width: 72px; height: 56px; padding: 0 14px; margin-bottom: 14px; border-radius: 12px; background: var(--white); color: var(--g900); font-weight: 800; letter-spacing: 0.04em; }
.ft-name { margin: 0 0 6px; font-size: 18px; font-weight: 700; line-height: 1.35; color: var(--white); }
.ft-slogan { margin: 0; max-width: 34ch; color: var(--ft-muted); }
.ft-row { display: flex; align-items: flex-start; gap: 12px; min-height: 44px; padding: 8px; margin: 0 -8px; border-radius: var(--radius-s); text-decoration: none; }
a.ft-row:hover { background: rgb(255 255 255 / 0.1); }
a.ft-row:hover .ft-value { text-decoration-thickness: 2px; }
.ft-row > svg { flex: none; width: 20px; height: 20px; margin-top: 2px; color: var(--lime); }
.ft-text { display: grid; min-width: 0; }
.ft-label { font-size: 14px; line-height: 1.4; color: var(--ft-muted); }
.ft-value { font-size: 16px; font-weight: 600; line-height: 1.5; font-style: normal; overflow-wrap: anywhere; }
a.ft-row .ft-value { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.ft-nav { display: grid; gap: 24px; }
.ft-link { display: flex; align-items: center; min-height: 44px; padding: 4px 8px; margin: 0 -8px; border-radius: var(--radius-s); text-decoration: none; font-size: 16px; line-height: 1.35; }
.ft-link:hover { background: rgb(255 255 255 / 0.1); text-decoration: underline; text-underline-offset: 3px; }
.ft-link[aria-current="page"] { font-weight: 700; box-shadow: inset 3px 0 0 var(--lime); padding-left: 14px; }
.ft-bottom { margin-top: 32px; padding-top: 16px; border-top: 1px solid rgb(255 255 255 / 0.25); font-size: 14px; color: var(--ft-muted); }
.ft-bottom p { margin: 0; }
.ft :focus-visible { outline: 3px solid var(--white); outline-offset: 2px; border-radius: var(--radius-s); }
@media (forced-colors: active) {
  .ft-row > svg { color: LinkText; }
  .ft-link[aria-current="page"] { border-left: 3px solid CanvasText; box-shadow: none; }
}
@media (min-width: 600px) {
  .ft { --ft-pad: 24px; padding-top: 48px; }
  .ft-grid { grid-template-columns: 1fr 1fr; gap: 40px 32px; }
  .ft-nav { grid-column: 1 / -1; grid-template-columns: 1fr 1fr; gap: 32px; }
}
@media (min-width: 900px) {
  .ft { padding-top: 56px; }
  .ft-grid { grid-template-columns: 1.15fr 1.15fr 1.7fr; gap: 40px; }
  .ft-nav { grid-column: auto; gap: 24px; }
}
`;
