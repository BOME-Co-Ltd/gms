// Chân trang U10 cho bản build tĩnh (ux-spec v0.5 §14a, V26 nền trắng theo wireframe green v0.3.8). Thuần chuỗi HTML, không fetch/env (FE-ATOMIC).
// Thứ tự DOM = tab = đọc: Thương hiệu → Liên hệ → Menu (một danh sách, 2 cột) → bản quyền. Trường trống ⇒ ẩn hàng.
import { safeHref } from '../../../contracts/safe-url.ts';
import { brandMark, gmsLogo, icon, zaloMark } from './static-icons.ts';

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
  /** Mục menu theo thứ tự hiện (menu chính rồi Tuyển dụng · FAQ · Chính sách · Liên hệ); gộp thành MỘT danh sách. */
  explore: FooterLink[];
  info: FooterLink[];
};

const TEXT = {
  vi: {
    contact: 'Liên hệ',
    phone: 'Điện thoại: ',
    zalo: 'Zalo: ',
    fanpage: 'Fanpage: ',
    address: 'Địa chỉ: ',
    taxId: 'Mã số thuế: ',
    zaloShown: 'Zalo',
    navLabel: 'Liên kết chân trang',
    newTab: '(mở tab mới)',
    rights: 'Tất cả các quyền được bảo lưu.',
  },
  en: {
    contact: 'Contact',
    phone: 'Phone: ',
    zalo: 'Zalo: ',
    fanpage: 'Fanpage: ',
    address: 'Address: ',
    taxId: 'Tax ID: ',
    zaloShown: 'Zalo',
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

/** Hàng liên hệ: ô icon 24px + chữ cùng hàng, căn giữa dọc (§13b-8). Nhãn chỉ có cho trình đọc màn hình. */
function row(opts: {
  iconHtml: string;
  label: string;
  valueHtml: string;
  href?: string;
  external?: boolean;
  tag?: 'span' | 'address';
}): string {
  const tag = opts.tag ?? 'span';
  const inner = `<span class="ft-ico">${opts.iconHtml}</span><${tag} class="ft-val"><span class="sr-only">${esc(opts.label)}</span>${opts.valueHtml}</${tag}>`;
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
    rows.push(
      row({ iconHtml: icon('phone'), label: t.phone, valueHtml: esc(input.phone.text), href: input.phone.href }),
    );
  }
  if (input.zalo) {
    rows.push(
      row({
        iconHtml: zaloMark({ size: 22 }),
        label: t.zalo,
        valueHtml: `<span>${t.zaloShown} ${esc(input.zalo.text)}</span>${sr(t.newTab)}`,
        href: input.zalo.href,
        external: true,
      }),
    );
  }
  for (const f of input.fanpages ?? []) {
    rows.push(
      row({
        iconHtml: brandMark('facebook'),
        label: t.fanpage,
        valueHtml: `${esc(displayUrl(f.url))}${sr(t.newTab)}`,
        href: f.url,
        external: true,
      }),
    );
  }
  if (input.address?.trim()) {
    rows.push(
      row({ iconHtml: icon('map-pin'), label: t.address, valueHtml: esc(input.address.trim()), tag: 'address' }),
    );
  }
  if (input.taxId?.trim()) {
    // data-testid="tax-id" ở <li>: ẩn thì mất cả dòng lẫn nhãn.
    rows.push(
      row({ iconHtml: icon('receipt-text'), label: t.taxId, valueHtml: esc(input.taxId.trim()) }).replace(
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
    ? `<section class="ft-contact" aria-labelledby="ft-contact-h"><h2 id="ft-contact-h" class="sr-only">${t.contact}</h2><ul>${rows}</ul></section>`
    : '';
  // Khung EN: tên pháp lý giữ nguyên chuỗi tiếng Việt, đánh dấu lang="vi".
  const nameAttr = input.locale === 'vi' ? '' : ' lang="vi"';
  const links = [...input.explore, ...input.info];
  const rowsPerCol = Math.max(1, Math.ceil(links.length / 2));
  return `<footer class="ft" data-testid="footer">
    <div class="ft-wrap">
      <div class="ft-grid">
        <div class="ft-brand">
          ${gmsLogo('ft-logo', input.locale === 'vi' ? 'Logo GMS' : 'GMS logo')}
          <p class="ft-name"${nameAttr}>${name}</p>
          <p class="ft-slogan">${esc(input.slogan)}</p>
        </div>
        ${contact}
        <nav class="ft-nav" aria-label="${t.navLabel}"><ul style="--rows:${rowsPerCol}">${linkList(links)}</ul></nav>
      </div>
      <div class="ft-bottom"><p>© ${input.year}. ${t.rights}</p></div>
    </div>
  </footer>`;
}

/** CSS chân trang NỀN TRẮNG theo wireframe v0.3.8 (.ft); điểm gãy 600/900 (ux-spec §14a). Hover chỉ phóng to (V25). */
export const FOOTER_CSS = `
.ft { background: #fff; color: var(--ink, #14221B); border-top: 1px solid var(--line); padding: 56px 0 24px; --ft-pad: 16px; --ft-muted: var(--muted, #4A5A52); font-size: 16px; line-height: 1.6; }
.ft-wrap { max-width: 1200px; margin: 0 auto; padding: 0 var(--ft-pad); }
.ft-grid { display: grid; gap: 40px; }
.ft a { color: var(--ink, #14221B); padding: 0; }
.ft ul { list-style: none; margin: 0; padding: 0; }
.ft li { margin: 0; }
.ft p { margin: 0; }
.ft-logo { display: block; height: 48px; width: auto; aspect-ratio: 1930/520; margin-bottom: 16px; }
.ft-name { margin: 0 0 8px; font-size: 18px; font-weight: 700; line-height: 1.4; color: var(--g900); }
.ft-slogan { max-width: 34ch; font-size: 14px; color: var(--ft-muted); }
.ft-contact ul { display: grid; gap: 4px; }
.ft-row { display: flex; align-items: center; gap: 12px; width: fit-content; max-width: calc(100% + 16px); min-height: 44px; padding: 6px 8px; margin: 0 -8px; border-radius: var(--radius-s); text-decoration: none; font-style: normal; font-size: 16px; line-height: 1.5; font-weight: 600; transform-origin: left center; transition: transform 0.16s var(--ease-spring); }
.ft-ico { flex: none; display: grid; place-items: center; width: 24px; height: 24px; color: var(--g900); }
.ft-ico svg { width: 24px; height: 24px; }
.ft-ico svg.zalo-mark, .ft-ico svg.fb-mark { width: 22px; height: 22px; }
.ft-ico svg.zalo-mark { border-radius: 5px; }
.ft-ico svg.fb-mark { fill: #0866FF; }
.ft-val { min-width: 0; overflow-wrap: anywhere; }
a.ft-row .ft-val { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; }
.ft-nav ul { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(var(--rows, 5), auto); grid-auto-flow: column; column-gap: 16px; }
.ft-link { display: flex; align-items: center; min-height: 44px; padding: 4px 8px; margin: 0 -8px; border-radius: var(--radius-s); text-decoration: none; font-size: 16px; line-height: 1.35; transform-origin: left center; transition: transform 0.16s var(--ease-spring); }
.ft-link[aria-current="page"] { font-weight: 700; box-shadow: inset 3px 0 0 var(--g900); padding-left: 14px; }
.ft-bottom { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 14px; color: var(--ft-muted); }
.ft :focus-visible { outline: 3px solid var(--g900); outline-offset: 2px; border-radius: var(--radius-s); }
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  a.ft-row:hover { transform: scale(1.04); }
  .ft-link:hover { transform: scale(1.05); }
}
@media (forced-colors: active) {
  .ft-ico { color: LinkText; }
  .ft-link[aria-current="page"] { border-left: 3px solid CanvasText; box-shadow: none; }
}
@media (min-width: 600px) {
  .ft { --ft-pad: 24px; padding-top: 64px; }
  .ft-grid { grid-template-columns: 1fr 1fr; gap: 48px 32px; }
  .ft-nav { grid-column: 1 / -1; }
}
@media (min-width: 900px) {
  .ft { padding-top: 72px; }
  .ft-grid { grid-template-columns: 1.1fr 1.2fr 1.3fr; gap: 48px; }
  .ft-nav { grid-column: auto; }
}
`;
