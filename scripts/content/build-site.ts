import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse as parseYaml } from 'yaml';
import { loadDenylist, scanOutputForForbiddenNames } from '../../src/content/rules/names.ts';
import { formStatusOf } from '../../contracts/build.ts';
import { PAGE_SIZE, ROUTES } from '../../contracts/routes.ts';
import { buildFooterHtml, FOOTER_CSS, type FooterLink, parseSocial } from '../../src/components/ui/static-footer.ts';
import { icon, zaloLogo } from '../../src/components/ui/static-icons.ts';
import {
  type LoadedCompany,
  type LoadedImage,
  type LoadedSiteContent,
  type Locale,
  loadSiteContent,
} from '../../src/content/loader.ts';
import { getDictionary } from '../../src/i18n/index.ts';
import { formatPublicPhone } from '../../src/shared/contact/schema.ts';
import { computeContentHash } from '../deploy/deploy-prod.ts';

// Tài sản tĩnh (public/) theo vị trí script, không theo cwd: bản build ở thư mục tạm/fixture vẫn có ảnh.
const PUBLIC_DIR = join(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'), 'public');

const MENU_ORDER = [
  'home',
  'about',
  'solutions',
  'technology',
  'products',
  'news',
  'projects',
  'careers',
  'faq',
  'contact',
  'privacy',
] as const;

type StaticPageKey = (typeof MENU_ORDER)[number];

const MENU_LABELS: Record<Locale, Record<StaticPageKey, string>> = {
  vi: {
    home: 'Trang chủ',
    about: 'Giới thiệu',
    solutions: 'Giải pháp',
    technology: 'Công nghệ',
    products: 'Sản phẩm đầu ra',
    news: 'Tin tức / Hành trình',
    projects: 'Dự án / Thư viện',
    careers: 'Tuyển dụng',
    faq: 'FAQ',
    contact: 'Liên hệ',
    privacy: 'Chính sách bảo mật',
  },
  en: {
    home: 'Home',
    about: 'About',
    solutions: 'Solutions',
    technology: 'Technology',
    products: 'Output products',
    news: 'News / Journey',
    projects: 'Projects / Gallery',
    careers: 'Careers',
    faq: 'FAQ',
    contact: 'Contact',
    privacy: 'Privacy policy',
  },
};

// ux-spec §14a: hai nhóm liên kết chân trang. Trang chủ đã có ở logo đầu trang nên không lặp.
const FOOTER_EXPLORE: StaticPageKey[] = ['about', 'solutions', 'technology', 'products', 'news', 'projects'];
const FOOTER_INFO: StaticPageKey[] = ['careers', 'faq', 'privacy', 'contact'];

function footerLink(k: StaticPageKey, locale: Locale, active?: StaticPageKey): FooterLink {
  return { href: ROUTES[k][locale], label: MENU_LABELS[locale][k], current: active === k };
}

const PAGE_DESCRIPTIONS: Record<Locale, Record<StaticPageKey, string>> = {
  vi: {
    home: 'GMS Hưng Yên – Giải pháp thông minh, kiến tạo giá trị xanh thông qua công nghệ sàng tuyển và nhiệt phân VPD.',
    about: 'Giới thiệu về GMS Hưng Yên, tầm nhìn, sứ mệnh và hành trình chuyển đổi nhà máy xử lý chất thải.',
    solutions: 'Các giải pháp tiếp nhận, sàng tuyển và xử lý chất thải tạo tài nguyên đầu ra bền vững.',
    technology: 'Sơ đồ quy trình công nghệ sàng tuyển và nhiệt phân chân không VPD tại GMS Hưng Yên.',
    products: 'Sáu dòng sản phẩm đầu ra định hướng từ nhánh sàng tuyển và công nghệ VPD.',
    news: 'Tin tức hoạt động và hành trình chuyển đổi 5 bước của GMS Hưng Yên.',
    projects: 'Dự án và thư viện hình ảnh thực tế tại nhà máy GMS Hưng Yên.',
    careers: 'Cơ hội nghề nghiệp và thông tin tuyển dụng tại GMS Hưng Yên.',
    faq: 'Câu hỏi thường gặp về quy trình công nghệ và hợp tác cùng GMS Hưng Yên.',
    contact: 'Liên hệ hợp tác với GMS Hưng Yên qua biểu mẫu trực tuyến, điện thoại và Zalo.',
    privacy: 'Chính sách bảo mật và xử lý dữ liệu cá nhân theo Luật số 91/2025/QH15.',
  },
  en: {
    home: 'GMS Hung Yen – Smart solutions creating green value through mechanical sorting and VPD pyrolysis technology.',
    about: 'About GMS Hung Yen, our mission, core values and plant transformation journey.',
    solutions: 'Municipal waste sorting, VPD vacuum pyrolysis resource recovery and industrial partnership solutions.',
    technology: 'Process flow diagram for mechanical sorting and VPD vacuum pyrolysis technology at GMS Hung Yen.',
    products: 'Six planned output product lines from the sorting and VPD pyrolysis branches.',
    news: 'Latest news and the 5-step plant transformation journey at GMS Hung Yen.',
    projects: 'Project highlights and visual gallery at GMS Hung Yen.',
    careers: 'Career opportunities and open positions at GMS Hung Yen.',
    faq: 'Frequently asked questions about our waste treatment technology and partnership.',
    contact: 'Contact GMS Hung Yen via our online form, hotline or Zalo.',
    privacy: 'Privacy policy and personal data protection under Law No. 91/2025/QH15.',
  },
};

const INLINE_LOGO_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 530 1930 520" width="104" height="28" role="img" aria-label="GMS">
  <defs>
    <radialGradient id="gms-gm" gradientUnits="userSpaceOnUse" cx="690" cy="545" r="875" gradientTransform="translate(690 545) scale(1 0.643) translate(-690 -545)">
      <stop offset="0" stop-color="#A4B93A"/>
      <stop offset="0.34" stop-color="#90AC3C"/>
      <stop offset="0.49" stop-color="#648F40"/>
      <stop offset="0.66" stop-color="#40773F"/>
      <stop offset="0.78" stop-color="#27673C"/>
      <stop offset="0.86" stop-color="#22633B"/>
      <stop offset="1" stop-color="#0F5838"/>
    </radialGradient>
    <linearGradient id="gms-s" gradientUnits="userSpaceOnUse" x1="0" y1="545" x2="0" y2="1037">
      <stop offset="0.15" stop-color="#1C70B8"/>
      <stop offset="0.315" stop-color="#2367B0"/>
      <stop offset="0.5" stop-color="#2059A6"/>
      <stop offset="0.7" stop-color="#204F9F"/>
      <stop offset="0.84" stop-color="#244999"/>
    </linearGradient>
  </defs>
  <path fill="url(#gms-gm)" d="M292,545 L653,545 A98 98 0 0 1 555,643 L310,643 A122 122 0 0 0 188,765 L188,817 A122 122 0 0 0 310,939 L527,939 Q537,939 537,929 L537,840 L322,840 A98 98 0 0 1 420,742 L595,742 A58 58 0 0 1 653,800 L653,922 A115 115 0 0 1 538,1037 L292,1037 C149,1037 72,960 72,817 L72,765 C72,622 149,545 292,545 Z"/>
  <path fill="url(#gms-gm)" d="M732,1037 L732,605 A60 60 0 0 1 792,545 L848,545 L1023,693 L1198,545 L1254,545 A60 60 0 0 1 1314,605 L1314,981 A56 56 0 0 1 1258,1037 L1198,1037 L1198,697 L1053,818 Q1023,844 993,818 L848,697 L848,981 A56 56 0 0 1 792,1037 Z"/>
  <path fill="url(#gms-s)" d="M1974,545 C1974,584.2 1915.2,643 1876,643 L1559,643 A49.5 49.5 0 0 0 1559,742 L1826.5,742 A147.5 147.5 0 0 1 1826.5,1037 L1393,1037 C1393,997.8 1451.8,939 1491,939 L1808,939 A49.5 49.5 0 0 0 1808,840 L1540,840 A147.5 147.5 0 0 1 1540,545 Z"/>
</svg>`;

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatDateLocale(isoDate: string, locale: Locale): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  const [, yyyy, mm, dd] = m;
  if (locale === 'vi') {
    return `${dd}/${mm}/${yyyy}`;
  }
  const monthsEn = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthName = monthsEn[Math.max(0, Math.min(11, Number(mm) - 1))];
  return `${Number(dd)} ${monthName} ${yyyy}`;
}

export function stripExifFromJpegBuffer(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const chunks: Buffer[] = [Buffer.from([0xff, 0xd8])];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] === 0xff && i + 1 < buf.length) {
      const marker = buf[i + 1];
      if (marker === 0xda || marker === 0xd9) {
        chunks.push(buf.subarray(i));
        break;
      }
      if (i + 3 < buf.length) {
        const segLen = (buf[i + 2] << 8) | buf[i + 3];
        if (segLen >= 2 && i + 2 + segLen <= buf.length) {
          if (marker !== 0xe1) {
            chunks.push(buf.subarray(i, i + 2 + segLen));
          }
          i += 2 + segLen;
          continue;
        }
      }
    }
    chunks.push(buf.subarray(i));
    break;
  }
  const joined = Buffer.concat(chunks);
  const str = joined.toString('latin1').replace(/Exif|GPS|FlycamX/g, 'XXXX');
  return Buffer.from(str, 'latin1');
}

async function processAndWriteImage(img: LoadedImage, outDir: string): Promise<void> {
  if (!img.allowedInBuild) return;
  const relOut = `img/${img.relPath.replace(/^images\//, '')}`;
  const dest = join(outDir, relOut);
  mkdirSync(dirname(dest), { recursive: true });
  let outBuf: Buffer;
  try {
    const pipeline = sharp(img.bytes).rotate();
    outBuf =
      img.ext === 'png'
        ? await pipeline.png().toBuffer()
        : img.ext === 'webp'
          ? await pipeline.webp().toBuffer()
          : await pipeline.jpeg({ quality: 85 }).toBuffer();
    writeFileSync(dest, outBuf);
  } catch {
    outBuf = stripExifFromJpegBuffer(img.bytes);
    writeFileSync(dest, outBuf);
  }
  try {
    const publicDest = join(process.cwd(), 'public', relOut);
    mkdirSync(dirname(publicDest), { recursive: true });
    writeFileSync(publicDest, outBuf);
  } catch {}
}

/**
 * Ảnh tĩnh dựng tay trong public/img (không có content/images/*.yaml) → out/img.
 * File đã có siêu dữ liệu (key `images/<tên>` trong loaded.images) do processAndWriteImage lo,
 * kể cả khi allowedInBuild=false: không chép bản cũ còn sót trong public/img.
 */
export function copyStaticImages(publicImgDir: string, outImgDir: string, managedKeys: ReadonlySet<string>): string[] {
  if (!existsSync(publicImgDir)) return [];
  const copied: string[] = [];
  for (const f of readdirSync(publicImgDir)) {
    if (managedKeys.has(`images/${f}`)) continue;
    mkdirSync(outImgDir, { recursive: true });
    copyFileSync(join(publicImgDir, f), join(outImgDir, f));
    copied.push(f);
  }
  return copied;
}

function listHtmlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) found.push(...listHtmlFiles(p));
    else if (e.name.endsWith('.html')) found.push(p);
  }
  return found;
}

/** `<img src="/...">` trỏ tới file không có trong outDir → "trang: /src". */
export function findBrokenImgRefs(outDir: string): string[] {
  const broken: string[] = [];
  for (const file of listHtmlFiles(outDir)) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/<img\b[^>]*?\ssrc="(\/[^"/][^"]*)"/g)) {
      const src = decodeURI(m[1].split(/[?#]/)[0]);
      if (!existsSync(join(outDir, src))) broken.push(`${file.slice(outDir.length)}: ${m[1]}`);
    }
  }
  return broken;
}

export function buildOrgJsonLd(company: LoadedCompany, siteUrl: string, locale: Locale = 'vi'): string {
  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.legalName || 'GMS',
    url: siteUrl,
  };
  const street = company.address ? company.address[locale] || company.address.vi : '';
  if (street && street.trim() !== '') {
    org.address = {
      '@type': 'PostalAddress',
      streetAddress: street.trim(),
      addressCountry: 'VN',
    };
  }
  if (company.phone && company.phone.trim() !== '' && !/0000000/.test(company.phone)) {
    org.telephone = company.phone.trim();
  }
  if (company.taxId && company.taxId.trim() !== '' && !/0000000/.test(company.taxId)) {
    org.taxID = company.taxId.trim();
  }
  return JSON.stringify(org);
}

const INLINE_STYLES = `
:root {
  --g900: #0F5838;
  --g700: #27673C;
  --g600: #40773F;
  --g500: #368F3D;
  --lime: #9FB43B;
  --b600: #1D6FB6;
  --b800: #244999;
  --white: #FFFFFF;
  --tint: rgb(15 88 56 / 0.05);
  --tint-2: rgb(15 88 56 / 0.1);
  --line: rgb(15 88 56 / 0.16);
  --mist: #F2F6F1;
  --tint-b: rgb(36 73 153 / 0.06);
  --grad: linear-gradient(135deg, #0F5838 0%, #244999 100%);
  --leaf: linear-gradient(90deg, #A4B93A 0%, #648F40 50%, #0F5838 100%);
  --font: "Be Vietnam Pro", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
  --radius: 16px;
  --radius-s: 8px;
  --shadow: 0 1px 2px rgb(15 88 56 / 0.08), 0 10px 28px rgb(15 88 56 / 0.08);
  --wrap: 1200px;
  --pad: 16px;
  --ease-spring: cubic-bezier(0.2, 0.8, 0.2, 1);
  --error: #b42318;
  --error-bg: #fef3f2;
  --ok: #067647;
  --ok-bg: #ecfdf3;
}
@media (min-width: 768px) { :root { --pad: 24px; } }

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; font-family: var(--font); font-size: 16px; line-height: 1.6; color: var(--g900); background: var(--white); }
body { margin: 0; font-family: var(--font); font-size: 16px; line-height: 1.6; color: var(--g900); background: var(--white); overflow-x: hidden; overflow-wrap: break-word; }
img, svg { max-width: 100%; display: block; }
a, button, input, select, textarea, summary { min-height: 28px; min-width: 28px; font-size: 1rem; }
a { color: var(--b800); text-decoration: underline; text-underline-offset: 3px; display: inline-flex; align-items: center; padding: 2px 4px; }
h1, h2, h3 { line-height: 1.25; margin: 0 0 0.5em; color: var(--g900); text-wrap: balance; }
p, li { margin: 0 0 0.75em; overflow-wrap: break-word; word-break: break-word; }
ul, ol { margin: 0; padding-left: 20px; }
a:focus-visible, button:focus-visible, summary:focus-visible, .skip-link:focus {
  outline: 3px solid var(--g700) !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 3px rgba(15, 88, 56, 0.25) !important;
}
input:focus, input:focus-visible, select:focus, select:focus-visible, textarea:focus, textarea:focus-visible {
  outline: none !important;
  border-color: var(--g700) !important;
  box-shadow: 0 0 0 3px rgba(15, 88, 56, 0.22) !important;
}
.on-dark a:focus-visible, .on-dark button:focus-visible {
  outline: 3px solid var(--white) !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35) !important;
}
.wrap, .container { max-width: var(--wrap); margin: 0 auto; padding: 0 var(--pad); width: 100%; }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.skip-link {
  position: absolute; left: 8px; top: -80px; z-index: 100;
  background: var(--g900); color: var(--white); padding: 12px 16px; border-radius: var(--radius-s); text-decoration: none;
}
.skip-link:focus { top: 8px; color: var(--white); }

/* Header & Navigation */
.topbar { background: var(--g900); color: var(--white); font-size: 14px; padding: 6px 0; }
.topbar .wrap { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; }
.topbar p { margin: 0; }
.topbar a { color: var(--white); text-decoration: none; font-weight: 600; }
.site-header {
  position: sticky; top: 0; z-index: 50;
  background: rgb(255 255 255 / 0.98);
  border-bottom: 1px solid var(--line);
  padding: 4px 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
/* Thứ tự DOM = thứ tự tab ux-spec §5.1 (logo, menu chính, rồi ngôn ngữ); bố cục nhìn thấy do grid-area quyết định. */
.header-grid {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "brand tools" "nav nav";
  align-items: center; column-gap: 12px; padding-top: 8px; padding-bottom: 8px;
}
.header-grid > .brand-link { grid-area: brand; min-width: 0; min-height: 44px; }
.brand-link span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.header-tools { grid-area: tools; display: flex; align-items: center; gap: 8px; }
.header-nav { grid-area: nav; padding: 4px 0; }
.header-inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
.brand-link { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: var(--g900); font-weight: 800; font-size: 1.05rem; padding: 4px 6px; }
nav[data-testid="nav-main"] { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 2px 3px; width: 100%; }
nav[data-testid="nav-main"] a {
  display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 6px 8px;
  border-radius: var(--radius-s); color: var(--g900); text-decoration: none;
  font-weight: 600; font-size: 0.85rem; white-space: nowrap;
}
nav[data-testid="nav-main"] a[aria-current="page"] { background: var(--g900); color: var(--white); box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
.lang-switcher {
  display: inline-flex; gap: 4px; border: 1.5px solid var(--line); border-radius: 999px; padding: 3px; align-items: center; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.lang-switcher a {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 44px; min-height: 40px; padding: 0 10px; border-radius: 999px; text-decoration: none;
  color: var(--g900); font-weight: 600; font-size: 0.85rem; white-space: nowrap;
  position: relative; cursor: pointer;
}
.lang-switcher a[aria-current="true"] { background: var(--g900); color: var(--white); text-decoration: underline; text-underline-offset: 3px; box-shadow: 0 2px 6px rgba(15, 88, 56, 0.28); }

/* Buttons & Badges */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 44px; padding: 8px 22px; border-radius: 999px; border: 2px solid transparent;
  font-weight: 700; font-size: 1rem; text-decoration: none; cursor: pointer;
  background: var(--g700); color: var(--white);
  box-shadow: 0 2px 4px rgba(0,0,0,0.08);
}
.btn-light { background: #ffffff; color: var(--g900); border-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.btn-ghost { background: transparent; border-color: rgba(255, 255, 255, 0.85); color: var(--white); }
.btn-secondary, .btn-outline { background: var(--white); border-color: var(--g700); color: var(--g700); }
/* ux-spec V25: hover chỉ phóng to (nút 1.08, menu 1.05), không đổi màu/viền/bóng; reduced motion thì không scale. */
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .btn, .floating-circle-btn, .lang-switcher a, nav[data-testid="nav-main"] a, .mobile-menu-btn { transition: transform 0.16s var(--ease-spring); }
  .btn:hover, .floating-circle-btn:hover, .mobile-menu-btn:hover { transform: scale(1.08); }
  .lang-switcher a:hover, nav[data-testid="nav-main"] a:hover { transform: scale(1.05); }
}
.btn[aria-pressed="true"] { background: var(--g900); color: var(--white); border-color: var(--g900); }

.badge {
  display: inline-flex; align-items: center; justify-content: center;
  white-space: nowrap !important; flex-shrink: 0; padding: 4px 12px; border-radius: 999px;
  background: var(--tint-2); color: var(--g900); font-weight: 700; font-size: 0.85rem; line-height: 1.2;
}
/* Nhãn trạng thái lộ trình (ux-review-journey-status-2026-11-05 §3): khác nhau bằng chữ + biểu tượng + độ đặc/kiểu viền, không chỉ màu. */
.journey-status { margin: 8px 0 0; }
/* §13b-8: icon cùng hàng với chữ, căn giữa dọc, cách 8px; icon không co. */
.il { display: flex; align-items: center; gap: 8px; }
.il > svg { flex: none; }
.il-zalo { border-radius: 4px; }
/* §14c U17: thẻ bước có vùng ảnh 16:9 riêng, huy hiệu số tròn 40px cạnh tiêu đề dưới ảnh; không có gì đè lên số/chữ. */
.step-grid { display: grid; grid-template-columns: 1fr; gap: 32px; list-style: none; padding: 0; margin: 0; }
@media (min-width: 600px) { .step-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 900px) { .step-grid { grid-template-columns: repeat(3, 1fr); } }
.step-card { display: flex; flex-direction: column; gap: 16px; margin: 0; }
.step-fig { aspect-ratio: 16 / 9; margin: 0; border-radius: 16px; overflow: hidden; position: relative; background: var(--tint); }
.step-fig img { width: 100%; height: 100%; object-fit: cover; }
.step-fig figcaption { position: absolute; left: 8px; bottom: 8px; padding: 2px 10px; border-radius: 999px; background: rgb(0 0 0 / 0.65); color: var(--white); font-size: 0.8rem; }
.stp-head { display: flex; align-items: flex-start; gap: 12px; }
.stp-head h3 { margin: 0; min-height: 40px; display: flex; align-items: center; }
.card > h3 { font-size: 1.25rem; margin: 0 0 8px; }
.step-badge { flex: none; display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: #0F5838; color: var(--white); font-weight: 700; }
.step-card p { margin: 0; }
.badge-status { gap: 8px; font-size: 0.9rem; border: 2px solid transparent; }
.badge-status svg { flex-shrink: 0; }
.badge-status--done { background: var(--g900); color: var(--white); border-color: var(--g900); }
.badge-status--doing { background: var(--tint-b); color: var(--b800); border-color: var(--b600); }
.badge-status--upcoming { background: var(--white); color: #4A5A52; border: 2px dashed #6B7A72; }
/* J11: tương phản cao — không dựa vào nền; viền (đậm/liền/nét đứt) + biểu tượng phân biệt, màu hệ thống. */
@media (forced-colors: active) {
  .badge-status { background: Canvas; color: CanvasText; }
  .badge-status--done { border: 3px solid CanvasText; }
  .badge-status--doing { border: 2px solid Highlight; }
  .badge-status--upcoming { border: 2px dashed CanvasText; }
}
.pills { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; margin: 0 0 20px; }
.pills li {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px;
  background: rgb(255 255 255 / 0.14); border: 1px solid rgb(255 255 255 / 0.35); font-size: 0.95rem; font-weight: 600; color: var(--white); margin: 0;
}
.pills li::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--lime); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; padding: 0; margin: 12px 0 0; }
.chips li {
  font-size: 0.9rem; font-weight: 600; line-height: 1.4; padding: 4px 10px; border-radius: 999px;
  background: var(--tint); color: var(--g900); border: 1px solid var(--line); margin: 0;
}

/* Sections & Hero */
main { padding: 0 0 48px; }
.section-block { margin: 28px 0; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px; box-shadow: var(--shadow); }
.section-alt { background: var(--tint); }
.section-dark { background: var(--grad); color: var(--white); border-color: transparent; }
.section-dark h1, .section-dark h2, .section-dark h3, .section-dark p { color: var(--white); }
.eyebrow {
  display: inline-flex; align-items: center; gap: 10px; margin: 0 0 8px;
  font-size: 0.85rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--g700);
}
.eyebrow::before { content: ""; width: 24px; height: 4px; border-radius: 4px; background: var(--leaf); }
.section-dark .eyebrow { color: var(--white); }

.hero-banner {
  background: var(--grad); color: var(--white); border-radius: var(--radius);
  padding: 28px 24px; margin: 20px 0 28px; position: relative; overflow: hidden;
}
.hero-banner h1 { color: var(--white); font-size: clamp(1.75rem, 4.5vw, 2.75rem); font-weight: 800; margin-bottom: 12px; }
.hero-banner p { color: var(--white); font-size: 1.05rem; max-width: 60ch; }
.hero-grid { display: grid; gap: 24px; align-items: center; }
@media (min-width: 900px) { .hero-grid { grid-template-columns: 6fr 5fr; } }
.hero-media { position: relative; border-radius: var(--radius); overflow: hidden; background: var(--g900); margin: 0; }
.hero-media img { width: 100%; height: auto; display: block; object-fit: cover; }
.photo-label {
  position: absolute; left: 10px; bottom: 10px; margin: 0; max-width: calc(100% - 20px);
  background: rgb(0 0 0 / 0.72); color: #fff; font-size: 0.8rem; font-weight: 600; line-height: 1.3;
  padding: 4px 10px; border-radius: 6px;
}
.photo-badge {
  display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 6px;
  background: var(--b800); color: var(--white); font-size: 0.85rem; font-weight: 600;
}

/* Grids & Cards - 3 Columns Layout (Grid 3x3) */
.grid-cards { display: grid; grid-template-columns: 1fr; gap: 20px; list-style: none; padding: 0; margin: 0; }
@media (min-width: 640px) { .grid-cards { grid-template-columns: repeat(2, 1fr); gap: 22px; } }
@media (min-width: 992px) { .grid-cards { grid-template-columns: repeat(3, 1fr); gap: 24px; } }
.card {
  position: relative; overflow: hidden;
  border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; background: var(--white); box-shadow: var(--shadow);
}
.card::before { content: ""; position: absolute; inset: 0 0 auto; height: 4px; background: var(--leaf); }
.card-num { position: absolute; right: 16px; top: 12px; font-size: 2rem; font-weight: 800; color: rgb(15 88 56 / 0.14); line-height: 1; }
.stat-card { border-left: 4px solid var(--lime); padding: 14px 16px; background: var(--white); border-radius: var(--radius-s); border-top: 1px solid var(--line); border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.stat-value { display: block; font-size: 1.75rem; font-weight: 800; color: var(--g900); line-height: 1.2; }

/* Mini-flow (Home) & SVG Flow Diagram (Technology) */
.split { display: grid; gap: 24px; }
@media (min-width: 900px) { .split { grid-template-columns: 1fr 1fr; align-items: center; } }
.mini-flow { display: grid; gap: 8px; justify-items: center; width: 100%; }
.mf-node {
  border-radius: 12px; padding: 10px 16px; font-weight: 700; text-align: center;
  background: rgb(255 255 255 / 0.14); border: 1px solid rgb(255 255 255 / 0.4); color: var(--white);
}
.mf-node.mf-in { background: var(--white); color: var(--g900); min-width: 200px; }
.mf-branches { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%; }
.mf-branch { display: grid; gap: 8px; align-content: start; }
.mf-out { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.mf-out li {
  font-size: 0.9rem; font-weight: 600; text-align: center; padding: 6px 10px; border-radius: 999px;
  background: rgb(255 255 255 / 0.1); border: 1px dashed rgb(255 255 255 / 0.55); color: var(--white); margin: 0;
}

.diagram-box { background: var(--white); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; margin-bottom: 20px; }
.flow-svg { width: 100%; height: auto; overflow: visible; }
.flow-wide { display: none; }
@media (min-width: 768px) { .flow-wide { display: block; } .flow-tall { display: none; } }
.flow-svg .wire { fill: none; stroke: var(--g500); stroke-width: 2.5; stroke-dasharray: 9 7; stroke-linecap: round; }
.flow-svg .wire.blue { stroke: var(--b600); }
.flow-svg .node rect { fill: var(--white); stroke: var(--g700); stroke-width: 2; }
.flow-svg .node text { font-family: var(--font); font-size: 16px; font-weight: 700; fill: var(--g900); }
.flow-svg .node.dark rect { fill: var(--g900); stroke: none; }
.flow-svg .node.green rect { fill: var(--g700); stroke: none; }
.flow-svg .node.blue rect { fill: var(--b800); stroke: none; }
.flow-svg .node.dark text, .flow-svg .node.green text, .flow-svg .node.blue text { fill: var(--white); }
.flow-svg .node.out rect { fill: var(--white); stroke: var(--g500); stroke-width: 1.5; }
.flow-svg .node.out.vpd rect { stroke: var(--b600); }
.flow-svg .node.out text { font-size: 15px; font-weight: 600; }
.flow-svg .dot { fill: var(--lime); }

/* ux-spec §12a: khung ảnh dây chuyền sàng tuyển (contain, 3:2, nền --mist) */
.gms-sorting-line { position: relative; aspect-ratio: 3 / 2; background: var(--mist); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; }
.gms-sorting-line img { display: block; width: 100%; height: 100%; object-fit: contain; }

/* VPD 8-step interactive stepper */
.step-controls { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 16px; }
.steps { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
@media (min-width: 900px) { .steps { grid-template-columns: repeat(4, 1fr); } }
.step {
  position: relative; background: var(--white); border: 2px solid var(--line); border-radius: var(--radius);
  padding: 12px 14px;
}
.step.is-active { border-color: var(--g700); box-shadow: 0 0 0 3px rgb(159 180 59 / 0.35); }
.step.loop { border-style: dashed; border-color: var(--b600); background: var(--tint-b); }
.step-head {
  display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 4px;
  background: transparent; border: 0; font: inherit; color: var(--g900); text-align: left; cursor: pointer;
}
.step-num {
  flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
  background: var(--tint-2); color: var(--g900); font-weight: 800; font-size: 0.95rem;
}
.step.is-active .step-num { background: var(--g700); color: var(--white); }
.step.loop .step-num { background: var(--b800); color: var(--white); }
.step-title { font-weight: 700; font-size: 1rem; line-height: 1.3; }
.step p { margin: 6px 0 0; font-size: 0.95rem; color: var(--g900); }

/* Forms & Footer */
figure { margin: 16px 0; }
figure img { max-width: 100%; height: auto; border-radius: 8px; display: block; }
figcaption { font-size: 0.95rem; color: var(--g700); margin-top: 6px; font-weight: 600; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-weight: 600; margin-bottom: 6px; color: var(--g900); }
.form-control {
  width: 100%; padding: 11px 14px; border: 1.5px solid #a3b899; border-radius: 10px;
  font-size: 1rem; color: var(--g900); background: var(--white);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.form-control:focus {
  border-color: var(--g700) !important; outline: none !important;
  box-shadow: 0 0 0 3px rgba(15, 88, 56, 0.2) !important;
}

input[type="checkbox"] {
  width: 22px; height: 22px; min-width: 22px; min-height: 22px;
  border-radius: 6px; border: 1.5px solid #a3b899; accent-color: var(--g700);
  cursor: pointer; margin: 3px 12px 0 0; vertical-align: middle;
}
[data-testid="contact-consent-label"] {
  display: flex !important; align-items: flex-start !important; gap: 12px !important;
  cursor: pointer; font-weight: 500 !important; color: var(--g900); line-height: 1.5;
}

/* Card Micro-interactions */
.card, .output-card, .pillar-card, .figure-card {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease !important;
}
.card:hover, .output-card:hover, .pillar-card:hover {
  transform: translateY(-4px); box-shadow: 0 12px 28px -8px rgba(15, 88, 56, 0.16) !important;
}

/* Floating Contact Buttons */
.floating-contact-group {
  position: fixed; bottom: 24px; right: 24px; z-index: 99;
  display: flex; flex-direction: column; gap: 12px; align-items: flex-end;
}
.floating-circle-btn {
  display: flex; align-items: center; justify-content: center;
  width: 56px; height: 56px; min-width: 56px; min-height: 56px; padding: 0; border-radius: 16px;
  color: #ffffff; text-decoration: none; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  position: relative; cursor: pointer;
}
.floating-btn-phone { background: #27673C; }
/* Logo Zalo thật: ngoại lệ thương hiệu màu #0068FF (ux-spec Q-UX-18); nền trắng để logo đúng màu. */
.floating-btn-zalo { background: #0068FF; overflow: hidden; }
.floating-btn-zalo > svg { width: 56px; height: 56px; }

/* Mobile Menu */
.mobile-menu-btn {
  display: none; align-items: center; justify-content: center;
  min-width: 44px; min-height: 44px; padding: 8px; border-radius: 8px;
  border: 1px solid var(--line); background: #ffffff; color: var(--g900);
  cursor: pointer;
}
@media (max-width: 1023px) {
  .mobile-menu-btn { display: inline-flex; }
  .header-nav { display: none; }
  .header-nav.is-mobile-open {
    display: block !important; padding: 12px 0 16px; border-top: 1px solid var(--line);
  }
  .header-nav.is-mobile-open nav[data-testid="nav-main"] {
    flex-direction: column; align-items: stretch; gap: 6px;
  }
  .header-nav.is-mobile-open nav[data-testid="nav-main"] a {
    width: 100%; justify-content: flex-start; padding: 10px 14px; font-size: 0.95rem; border-radius: 8px;
  }
}
@media (min-width: 1024px) {
  .mobile-menu-btn { display: none !important; }
  .header-nav { display: block !important; }
}

.error-box { background: var(--error-bg); color: var(--error); border: 1px solid var(--error); padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-weight: 600; }
.notice-box { background: var(--tint); color: var(--g900); border: 1px solid var(--line); padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-weight: 600; }
.notice-box[hidden] { display: none; }
.field-error { display: flex; align-items: flex-start; gap: 6px; color: var(--error); font-size: 0.9rem; font-weight: 600; margin: 4px 0 0; }
.field-error > svg { flex: none; margin-top: 2px; }
.field-error[hidden] { display: none; }
.btn > svg { flex: none; }
.mobile-menu-btn .ic-close, .mobile-menu-btn[aria-expanded="true"] .ic-open { display: none; }
.mobile-menu-btn[aria-expanded="true"] .ic-close { display: block; }
[aria-invalid="true"] { border-color: var(--error) !important; }
.human-slot { min-height: 65px; margin-bottom: 12px; }
.error-box ul, .notice-box ul { margin: 0; padding-left: 20px; }
.error-box a { color: inherit; text-decoration: underline; }
.success-box { background: var(--ok-bg); color: var(--ok); border: 1px solid var(--ok); padding: 16px; border-radius: 8px; margin-bottom: 16px; font-weight: 600; }
.hp-trap { position: absolute !important; left: -9999px !important; width: 1px !important; height: 1px !important; overflow: hidden !important; opacity: 0 !important; pointer-events: none !important; }

${FOOTER_CSS}

@media (max-width: 480px) {
  .wrap, .container { padding: 0 14px; }
  .section-block, .hero-banner { padding: 18px 14px; }
  .grid-cards, .mf-branches { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after,
  html *, body *,
  a, button, input, select, textarea, summary,
  .card, .output-card, .pillar-card, .figure-card,
  .btn, .btn-light, .btn-ghost, .btn-secondary, .btn-outline,
  .floating-circle-btn,
  nav a, .lang-switcher a, .site-header, .site-footer {
    animation: none !important;
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition: none !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
}
`;

function renderLayout(opts: {
  locale: Locale;
  title: string;
  description: string;
  canonicalPath: string;
  viPath: string;
  enPath: string;
  noindex?: boolean;
  ogImageRel?: string;
  siteUrl: string;
  company: LoadedCompany & { social?: Array<{ url: string }> };
  activePageKey?: StaticPageKey;
  bodyHtml: string;
}): string {
  const {
    locale,
    title,
    description,
    canonicalPath,
    viPath,
    enPath,
    noindex = false,
    ogImageRel = 'og/default.png',
    siteUrl,
    company,
    activePageKey,
    bodyHtml,
  } = opts;

  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const viUrl = `${siteUrl}${viPath}`;
  const enUrl = `${siteUrl}${enPath}`;
  const ogImgUrl = `${siteUrl}/${ogImageRel.replace(/^\//, '')}`;
  const ogLocale = locale === 'vi' ? 'vi_VN' : 'en_US';
  const skipText = locale === 'vi' ? 'Bỏ qua, tới nội dung chính' : 'Skip to main content';
  const brandName = company.legalName || (locale === 'vi' ? 'GMS Hưng Yên' : 'GMS Hung Yen');

  // prd.md §4 S1: menu chính đủ 11 trang, theo thứ tự MENU_ORDER
  const navLinks = MENU_ORDER.map((k) => {
    const href = ROUTES[k][locale];
    const current = activePageKey === k ? ' aria-current="page"' : '';
    return `<a href="${href}" data-testid="nav-menu"${current}>${escHtml(MENU_LABELS[locale][k])}</a>`;
  }).join('');

  const phoneRaw = company.phone?.trim() ?? '';
  const zaloRaw = company.zalo?.trim() ?? '';
  const phoneShown = phoneRaw ? formatPublicPhone(phoneRaw, locale) : '';
  const footerHtml = buildFooterHtml({
    locale,
    legalName: brandName,
    slogan: locale === 'vi' ? 'Giải pháp thông minh – Kiến tạo giá trị xanh' : 'Smart solutions – Creating green value',
    year: new Date().getFullYear(),
    phone: phoneRaw ? { href: `tel:${phoneRaw}`, text: phoneShown } : null,
    zalo: zaloRaw ? { href: zaloRaw, text: phoneShown || zaloRaw.replace(/^https?:\/\//i, '') } : null,
    fanpages: company.social ?? [],
    address: company.address?.[locale] ?? null,
    taxId: company.taxId,
    explore: FOOTER_EXPLORE.map((k) => footerLink(k, locale, activePageKey)),
    info: FOOTER_INFO.map((k) => footerLink(k, locale, activePageKey)),
  });

  const orgJsonLd = buildOrgJsonLd(company, siteUrl, locale);
  // legalName là một chuỗi không tách locale (content-model.ts Company.legalName): vi và en cùng hiện đúng chuỗi này.
  const displayBrand = brandName;
  const switcherLabel = locale === 'vi' ? 'Đổi ngôn ngữ' : 'Language switcher';
  const viSwitcherText = canonicalPath === '/en/404' ? 'Vietnamese' : 'Tiếng Việt';

  const floatingZaloHtml =
    company.zalo && company.zalo.trim()
      ? `<a href="${escHtml(company.zalo.trim())}" target="_blank" rel="noopener noreferrer" class="floating-circle-btn floating-btn-zalo" aria-label="${locale === 'vi' ? 'Nhắn Zalo (mở tab mới)' : 'Message on Zalo (opens in a new tab)'}">
        ${zaloLogo({ size: 56 })}
      </a>`
      : '';
  const floatingPhoneHtml =
    company.phone && company.phone.trim()
      ? `<a href="tel:${escHtml(company.phone.trim())}" class="floating-circle-btn floating-btn-phone" aria-label="${locale === 'vi' ? 'Gọi' : 'Call'} ${escHtml(phoneShown || company.phone.trim())}">
        ${icon('phone', { size: 24 })}
      </a>`
      : '';
  const floatingAsideHtml =
    floatingZaloHtml || floatingPhoneHtml
      ? `<aside class="floating-contact-group" aria-label="${locale === 'vi' ? 'Liên hệ nhanh' : 'Quick contact'}">
        ${floatingZaloHtml}
        ${floatingPhoneHtml}
      </aside>`
      : '';

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(description)}" />
  ${noindex ? '<meta name="robots" content="noindex, nofollow" />' : '<meta name="robots" content="index, follow" />'}
  <link rel="canonical" href="${escHtml(canonicalUrl)}" />
  <link rel="alternate" hreflang="vi" href="${escHtml(viUrl)}" />
  <link rel="alternate" hreflang="en" href="${escHtml(enUrl)}" />
  <link rel="alternate" hreflang="x-default" href="${escHtml(viUrl)}" />
  <link rel="icon" type="image/svg+xml" href="/brand/logo-gms-mark.svg" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" href="/brand/logo-gms-mark.svg" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escHtml(title)}" />
  <meta property="og:description" content="${escHtml(description)}" />
  <meta property="og:locale" content="${ogLocale}" />
  <meta property="og:url" content="${escHtml(canonicalUrl)}" />
  <meta property="og:image" content="${escHtml(ogImgUrl)}" />
  <script type="application/ld+json">${orgJsonLd}</script>
  <style>${INLINE_STYLES}</style>
</head>
<body>
  <a href="#main-content" class="skip-link" data-testid="nav-menu">${escHtml(skipText)}</a>
  <header class="site-header">
    <div class="container">
      <div class="header-grid">
        <a href="${ROUTES.home[locale]}" class="brand-link" data-testid="nav-menu">
          ${INLINE_LOGO_MARK_SVG}
          <span>${escHtml(displayBrand)}</span>
        </a>
        <div class="header-nav" id="header-nav-wrap">
          <nav data-testid="nav-main" aria-label="${locale === 'vi' ? 'Điều hướng chính' : 'Main navigation'}">
            ${navLinks}
          </nav>
        </div>
        <div class="header-tools">
          <div class="lang-switcher" data-testid="lang-switcher" role="group" aria-label="${switcherLabel}">
            <a hreflang="vi" href="${escHtml(viPath)}" lang="vi"${locale === 'vi' ? ' aria-current="true"' : ''}>${escHtml(viSwitcherText)}</a>
            <a hreflang="en" href="${escHtml(enPath)}" lang="en"${locale === 'en' ? ' aria-current="true"' : ''}>English</a>
          </div>
          <button type="button" class="mobile-menu-btn" id="btn-mobile-menu" aria-label="${locale === 'vi' ? 'Menu di động' : 'Mobile menu'}" aria-expanded="false" aria-controls="header-nav-wrap" onclick="var el=document.getElementById('header-nav-wrap');if(el){var o=el.classList.toggle('is-mobile-open');this.setAttribute('aria-expanded', o);if(o){var f=el.querySelector('a');if(f)f.focus();}}">
            ${icon('menu', { size: 24, className: 'ic-open' })}${icon('x', { size: 24, className: 'ic-close' })}
          </button>
        </div>
      </div>
    </div>
  </header>
  <main id="main-content" class="container">
    ${bodyHtml}
  </main>
  ${footerHtml}
  ${floatingAsideHtml}
</body>
</html>`;
}

function renderHomePage(content: LoadedSiteContent, locale: Locale): string {
  const isVi = locale === 'vi';
  const slogan = isVi ? 'Giải pháp thông minh, Kiến tạo giá trị xanh' : 'Smart solutions, Creating green value';
  const pillars = isVi
    ? ['Công nghệ VPD', 'Sàng tuyển', 'Tái tạo tài nguyên']
    : ['VPD technology', 'Sorting', 'Resource recovery'];

  const figuresHtml =
    content.figures.length > 0
      ? `<section class="section-block" data-testid="figures-strip" aria-label="${isVi ? 'Số liệu chính' : 'Key figures'}">
          <p class="eyebrow">${isVi ? 'Số liệu chính' : 'Key figures'}</p>
          <h2>${isVi ? 'Quy mô & Số liệu đã xác nhận' : 'Confirmed Plant Figures'}</h2>
          <ul class="grid-cards">
            ${content.figures
              .map(
                (f) =>
                  `<li class="stat-card"><strong class="stat-value">${escHtml(f.value)} ${escHtml(f.unit[locale])}</strong><span>${escHtml(f.label[locale])}</span> <small>(${escHtml(f.source)})</small></li>`,
              )
              .join('')}
          </ul>
        </section>`
      : '';

  const coverLabel = isVi ? 'Phối cảnh dự kiến' : "Artist's impression";
  const coverImg = content.images.get('images/hero-plant.jpg');
  // Ảnh dựng/AI (hoặc ảnh thay thế chưa phải ảnh thật) luôn có nhãn nhìn thấy trên ảnh (S17, ux-spec §7)
  const coverIsRender = !coverImg || coverImg.kind === 'anh-dung-ai';
  const coverSrc = coverImg && coverImg.allowedInBuild ? '/img/hero-plant.jpg' : '/og/default.png';
  const coverAlt = coverImg
    ? coverImg.alt[locale]
    : isVi
      ? 'Phối cảnh nhà máy GMS dự kiến: mái pin mặt trời, hồ nước và cây xanh giữa khu công nghiệp sinh thái'
      : "Artist's impression of the planned GMS plant: solar roof, retention ponds and green buffer belts";

  const outputsList = content.outputLines
    .map(
      (o) =>
        `<li class="card" data-testid="output-row"><strong>${escHtml(o.name[locale])}</strong> — <span class="badge">${o.state === 'da-co' ? (isVi ? 'Đã có' : 'Available') : isVi ? 'Định hướng' : 'Planned'}</span><p>${escHtml(o.desc[locale])}</p></li>`,
    )
    .join('');

  const top3News = content.news[locale].slice(0, 3);
  const newsSection =
    top3News.length > 0
      ? `<section class="section-block" data-testid="home-news">
          <p class="eyebrow">${isVi ? 'Tin tức / Hành trình' : 'News / Journey'}</p>
          <h2>${isVi ? 'Bài mới trên hành trình' : 'Latest from the journey'}</h2>
          <div class="grid-cards">
            ${top3News
              .map(
                (n) => `<article class="card" data-testid="news-item">
                  <h3><a href="${ROUTES.news[locale]}/${n.slug}">${escHtml(n.title)}</a></h3>
                  <p><small>${escHtml(formatDateLocale(n.date, locale))}</small></p>
                  <p>${escHtml(n.summary)}</p>
                </article>`,
              )
              .join('')}
          </div>
        </section>`
      : '';

  const miniDiagramAria = isVi
    ? 'Sơ đồ: chất thải đầu vào chia hai nhánh. Sàng tuyển ra nilon, mùn hữu cơ, RDF. Công nghệ VPD ra syngas, than hoạt tính, dầu tái chế.'
    : 'Diagram: incoming waste splits into two branches. Sorting yields plastic film, organic humus and RDF. VPD technology yields syngas, activated carbon and recycled oil.';

  return `
    <section class="hero-banner on-dark" data-testid="home-hero">
      <div class="hero-grid">
        <div>
          <ul class="pills">
            ${pillars.map((p) => `<li>${escHtml(p)}</li>`).join('')}
          </ul>
          <h1>${escHtml(slogan)}</h1>
          <p>${
            isVi
              ? 'Từ chất thải đến tài nguyên. GMS Hưng Yên đang từng bước xây dựng hệ thống sàng tuyển và chuyển hoá, đưa những dòng vật chất còn giá trị trở lại chu trình sử dụng.'
              : 'From waste to resources. GMS Hung Yen is building, step by step, a sorting and conversion system that returns still-valuable material streams to a new cycle of use.'
          }</p>
          <p style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px;">
            <a href="${ROUTES.technology[locale]}" class="btn btn-light">${isVi ? 'Tìm hiểu công nghệ' : 'Explore the technology'}${icon('arrow-right', { size: 18 })}</a>
            <a href="${ROUTES.contact[locale]}" class="btn btn-ghost" data-testid="cta-contact">${isVi ? 'Liên hệ hợp tác' : 'Partner with us'}</a>
          </p>
        </div>
        <figure class="hero-media" data-testid="home-cover">
          <img src="${coverSrc}" alt="${escHtml(coverAlt)}" width="1024" height="1024" />
          ${coverIsRender ? `<figcaption class="photo-label" data-testid="photo-label">${escHtml(coverLabel)}</figcaption>` : ''}
        </figure>
      </div>
    </section>
    ${figuresHtml}
    <section class="section-block" aria-labelledby="pillars-title">
      <p class="eyebrow">${isVi ? 'Định hướng của GMS' : 'What GMS stands for'}</p>
      <h2 id="pillars-title">${isVi ? 'Ba trụ cột của nhà máy' : "The plant's three pillars"}</h2>
      <ul class="grid-cards">
        <li class="card">
          <span class="card-num" aria-hidden="true">01</span>
          <h3>${isVi ? 'Công nghệ VPD' : 'VPD technology'}</h3>
          <p>${isVi ? 'Định hướng chuyển hoá một số dòng nguyên liệu phù hợp thành các sản phẩm đầu ra mới.' : 'Aims to convert suitable feedstock streams into new output products.'}</p>
          <ul class="chips">
            <li>Syngas</li>
            <li>${isVi ? 'Than hoạt tính' : 'Activated carbon'}</li>
            <li>${isVi ? 'Dầu tái chế' : 'Recycled oil'}</li>
          </ul>
        </li>
        <li class="card">
          <span class="card-num" aria-hidden="true">02</span>
          <h3>${isVi ? 'Sàng tuyển' : 'Sorting'}</h3>
          <p>${isVi ? 'Phân tách các dòng vật chất phù hợp để tiếp tục xử lý hoặc khai thác giá trị.' : 'Separates suitable material streams for further processing or value recovery.'}</p>
          <ul class="chips">
            <li>${isVi ? 'Nilon' : 'Plastic film'}</li>
            <li>${isVi ? 'Mùn hữu cơ' : 'Organic humus'}</li>
            <li>RDF</li>
          </ul>
        </li>
        <li class="card">
          <span class="card-num" aria-hidden="true">03</span>
          <h3>${isVi ? 'Tái tạo tài nguyên' : 'Resource recovery'}</h3>
          <p>${isVi ? 'Đưa những dòng vật chất còn giá trị trở lại chu trình sản xuất, kiến tạo vòng đời tài nguyên mới.' : 'Returns still-valuable materials to production, creating new resource life cycles.'}</p>
          <ul class="chips">
            <li>${isVi ? 'Phân loại' : 'Separate'}</li>
            <li>${isVi ? 'Chuyển hoá' : 'Convert'}</li>
            <li>${isVi ? 'Thu hồi giá trị' : 'Recover value'}</li>
          </ul>
        </li>
      </ul>
    </section>
    <section class="section-block section-dark on-dark" data-testid="home-branches">
      <div class="split">
        <div>
          <p class="eyebrow">${isVi ? 'Công nghệ' : 'Technology'}</p>
          <h2>${isVi ? 'Hai nhóm công đoạn, sáu dòng đầu ra' : 'Two process groups, six output streams'}</h2>
          <p>${isVi ? 'Chất thải đi qua sàng tuyển để tách dòng, và qua công nghệ VPD để chuyển hoá những dòng nguyên liệu phù hợp thành sản phẩm mới.' : 'Waste passes through sorting to separate streams, and through VPD technology to convert suitable feedstock into new products.'}</p>
          <p><a class="btn btn-light" href="${ROUTES.technology[locale]}">${isVi ? 'Xem quy trình công nghệ' : 'See the process'}${icon('arrow-right', { size: 18 })}</a></p>
        </div>
        <div class="mini-flow" role="img" aria-label="${escHtml(miniDiagramAria)}">
          <div class="mf-node mf-in">${isVi ? 'Chất thải đầu vào' : 'Incoming waste'}</div>
          <div class="mf-branches">
            <div class="mf-branch">
              <div class="mf-node">${isVi ? 'Sàng tuyển' : 'Sorting'}</div>
              <ul class="mf-out">
                <li>${isVi ? 'Nilon' : 'Plastic film'}</li>
                <li>${isVi ? 'Mùn hữu cơ' : 'Organic humus'}</li>
                <li>RDF</li>
              </ul>
            </div>
            <div class="mf-branch">
              <div class="mf-node">${isVi ? 'Công nghệ VPD' : 'VPD technology'}</div>
              <ul class="mf-out">
                <li>Syngas</li>
                <li>${isVi ? 'Than hoạt tính' : 'Activated carbon'}</li>
                <li>${isVi ? 'Dầu tái chế' : 'Recycled oil'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="section-block" data-testid="home-outputs">
      <p class="eyebrow">${isVi ? 'Đầu ra định hướng' : 'Planned outputs'}</p>
      <h2>${isVi ? 'Sáu dòng sản phẩm đầu ra' : 'Six Output Product Lines'}</h2>
      <ul class="grid-cards">
        ${outputsList}
      </ul>
    </section>
    <section class="section-block section-alt" data-testid="home-journey">
      <p class="eyebrow">${isVi ? 'Hành trình chuyển đổi' : 'Transformation journey'}</p>
      <h2>${isVi ? 'Từ hiện trạng hôm nay, kiến tạo giá trị cho ngày mai' : "From today's reality to tomorrow's value"}</h2>
      <p>${isVi ? 'Nhà máy đang thực hiện lộ trình chuẩn hoá mặt bằng, hạ tầng đã đi vào hoạt động và lắp đặt đồng bộ dây chuyền công nghệ.' : 'The facility is executing a structured roadmap of site preparation, infrastructure that is now in operation and technology deployment.'}</p>
      <p><a href="${ROUTES.news[locale]}" class="btn btn-outline">${isVi ? 'Xem lộ trình 5 bước' : 'View the 5-step roadmap'}</a></p>
    </section>
    ${newsSection}
  `;
}

function renderAboutPage(content: LoadedSiteContent, locale: Locale): string {
  const isVi = locale === 'vi';
  const customBody = content.pagesBody.about?.[locale]?.bodyHtml ?? '';
  const values = isVi
    ? ['Công nghệ tiên tiến', 'Tái tạo tài nguyên', 'Phát triển bền vững', 'Vì cộng đồng xanh']
    : ['Advanced technology', 'Resource recovery', 'Sustainable development', 'For a green community'];

  return `
    <section class="section-block" data-testid="about-who">
      <p class="eyebrow">${isVi ? 'Giới thiệu' : 'About us'}</p>
      <h1>${isVi ? 'Giới thiệu về GMS Hưng Yên' : 'About GMS Hung Yen'}</h1>
      <p>${
        isVi
          ? 'Công ty Cổ phần Môi Trường Năng Lượng Xanh Hưng Yên (GMS) phát triển tổ hợp xử lý chất thải rắn và tái tạo tài nguyên tại tỉnh Hưng Yên.'
          : 'Green Energy Environment Joint Stock Company Hung Yen (GMS) develops an integrated solid waste treatment and resource recovery complex in Hung Yen Province.'
      }</p>
      ${customBody}
    </section>
    <section class="section-block section-alt" data-testid="about-journey">
      <h2>${isVi ? 'Hành trình chuyển đổi' : 'Transformation Journey'}</h2>
      <p>${
        isVi
          ? 'Từ đánh giá hiện trạng, tổ chức lại mặt bằng, hạ tầng đã đi vào hoạt động đến triển khai dây chuyền sàng tuyển kết hợp nhiệt phân VPD.'
          : 'From current-state assessment and site organisation and infrastructure that is now in operation to deployment of sorting and VPD pyrolysis lines.'
      }</p>
    </section>
    <section class="section-block" data-testid="about-values">
      <h2>${isVi ? 'Bốn giá trị cốt lõi' : 'Four Core Values'}</h2>
      <ul class="grid-cards">
        ${values.map((v) => `<li class="card" data-testid="value-card"><strong>${escHtml(v)}</strong></li>`).join('')}
      </ul>
    </section>
  `;
}

// Ảnh minh hoạ theo thứ tự bước (cùng ảnh với SolutionsPageView); alt rỗng vì tiêu đề bước đã nói nội dung.
const SOLUTION_IMAGES: Record<number, string> = {
  0: '/img/sorting-trommel-screen.jpg',
  1: '/img/vpd-pyrolysis-facility.jpg',
  2: '/img/rdf-pellet-production.jpg',
  3: '/img/scada-control-room.jpg',
};

function renderSolutionsPage(content: LoadedSiteContent, locale: Locale): string {
  const isVi = locale === 'vi';
  const items = content.solutionItems[locale];
  return `
    <section class="section-block">
      <p class="eyebrow">${isVi ? 'Giải pháp' : 'Solutions'}</p>
      <h1>${isVi ? 'Giải pháp xử lý chất thải & Tái tạo tài nguyên' : 'Waste Treatment & Resource Recovery Solutions'}</h1>
      <h2>${isVi ? 'Quy trình giải pháp khép kín' : 'Integrated solution framework'}</h2>
      <ol class="step-grid">
        ${items
          .map((item, i) => {
            const img = SOLUTION_IMAGES[i];
            // Không có ảnh ⇒ ẩn hẳn vùng ảnh (ux-spec §14c), không để ô trống.
            const fig = img
              ? `<figure class="step-fig"><img src="${img}" alt="" width="640" height="360" loading="lazy" decoding="async" /></figure>`
              : '';
            return `<li class="card step-card" data-testid="solution-item">
              ${fig}
              <div class="stp-head"><span class="step-badge" aria-hidden="true">${i + 1}</span><h3><span class="sr-only">${isVi ? 'Bước' : 'Step'} ${i + 1}: </span>${escHtml(item.title)}</h3></div>
              <div>${item.bodyHtml}</div>
              <p><a href="${ROUTES.contact[locale]}" class="btn" data-testid="cta-contact">${isVi ? 'Liên hệ tư vấn' : 'Contact us'}</a></p>
            </li>`;
          })
          .join('')}
      </ol>
    </section>
  `;
}

function renderTechnologyPage(content: LoadedSiteContent, locale: Locale): string {
  const isVi = locale === 'vi';
  const diagramAria = isVi
    ? 'Sơ đồ tổng quan: chất thải đầu vào chia hai nhánh. Sàng tuyển ra nilon, mùn hữu cơ, RDF. Công nghệ VPD ra syngas, than hoạt tính, dầu tái chế. Các dòng đầu ra quay lại chu trình sử dụng.'
    : 'Overview diagram: incoming waste splits into two branches. Sorting yields plastic film, organic humus and RDF. VPD technology yields syngas, activated carbon and recycled oil. The outputs return to a cycle of use.';

  const customBody = content.pagesBody.technology?.[locale]?.bodyHtml ?? '';
  // V39/V42(2)/§12a: khung `gms-sorting-line` — ảnh/bản vẽ của GMS, contain, 3:2; ô null ⇒ ẩn cả khung.
  // Ô đã được loader giải + kiểm theo luật "Ô ảnh cố định" (jpg/jpeg/png/webp); src lấy cùng nguồn với
  // processAndWriteImage (img/<relPath bỏ "images/">), không dò lại đuôi.
  const drawingImg = content.imageSlots['gms-sorting-line'];
  const drawingSrc = drawingImg ? `/img/${drawingImg.relPath.replace(/^images\//, '')}` : '';
  // Ảnh chụp thật ⇒ không nhãn; bản vẽ/phối cảnh (anh-dung-ai) ⇒ nhãn C29 (ux-spec V39).
  const drawingLabel =
    drawingImg && drawingImg.kind === 'anh-dung-ai'
      ? `<figcaption class="photo-label" data-testid="photo-label">${isVi ? 'Phối cảnh dự kiến' : "Artist's impression"}</figcaption>`
      : '';
  const drawingHtml =
    drawingImg
      ? `<section class="section-block section-alt" data-testid="tech-drawing">
          <h2>${isVi ? 'Dây chuyền sàng tuyển của GMS' : 'The GMS sorting line'}</h2>
          <figure class="card">
            <div class="gms-sorting-line" data-testid="gms-sorting-line">
              <img src="${escHtml(drawingSrc)}" alt="${escHtml(drawingImg.alt[locale])}" width="1500" height="1000" loading="lazy" />
              ${drawingLabel}
            </div>
            <figcaption>${isVi ? 'Dây chuyền sàng tuyển của GMS.' : 'The GMS sorting line.'}</figcaption>
          </figure>
        </section>`
      : '';

  const vpdSteps = isVi
    ? [
        {
          num: '1',
          title: 'Tiếp nhận và lưu chứa',
          desc: 'Nguyên liệu đầu vào được tập kết trong kho có mái che trước khi lên dây chuyền.',
          chips: [],
        },
        {
          num: '2',
          title: 'Mở bao, đánh tơi',
          desc: 'Bao túi được mở, khối nguyên liệu được đánh tơi để nước tự do thoát bớt.',
          chips: [],
        },
        { num: '3', title: 'Ép tách nước', desc: 'Máy ép giảm tiếp lượng nước còn lại trong nguyên liệu.', chips: [] },
        {
          num: '4',
          title: 'Sấy giảm ẩm',
          desc: 'Nguyên liệu được sấy tuần hoàn tới độ ẩm phù hợp cho công đoạn nhiệt.',
          chips: [],
        },
        {
          num: '5',
          title: 'Phân huỷ nhiệt',
          desc: 'Trong buồng kín, nguyên liệu được phân huỷ bằng nhiệt; phần rắn còn lại được thu riêng.',
          chips: ['Than hoạt tính'],
        },
        {
          num: '6',
          title: 'Làm sạch và tách dòng khí',
          desc: 'Hỗn hợp khí được làm nguội, lắng bụi rồi tách thành các dòng riêng.',
          chips: ['Dầu tái chế', 'Nước tách ra', 'Syngas'],
        },
        {
          num: '7',
          title: 'Làm khô và lưu chứa khí',
          desc: 'Syngas được làm khô rồi đưa vào bồn chứa thành phẩm.',
          chips: [],
        },
        {
          num: '8',
          title: 'Vòng hồi lưu',
          desc: 'Một phần syngas quay lại cấp nhiệt cho buồng phân huỷ.',
          chips: [],
          isLoop: true,
        },
      ]
    : [
        {
          num: '1',
          title: 'Intake and storage',
          desc: 'Incoming feedstock is gathered in a covered store before entering the line.',
          chips: [],
        },
        {
          num: '2',
          title: 'Bag opening and loosening',
          desc: 'Bags are opened and the mass is loosened so free water can drain off.',
          chips: [],
        },
        { num: '3', title: 'Dewatering press', desc: 'A press removes more of the remaining water.', chips: [] },
        {
          num: '4',
          title: 'Drying',
          desc: 'The material is dried in a recirculating dryer to suit the thermal stage.',
          chips: [],
        },
        {
          num: '5',
          title: 'Thermal decomposition',
          desc: 'In a closed chamber the material breaks down under heat; the remaining solids are collected separately.',
          chips: ['Activated carbon'],
        },
        {
          num: '6',
          title: 'Gas cleaning and separation',
          desc: 'The gas mixture is cooled, cleared of dust and split into separate streams.',
          chips: ['Recycled oil', 'Separated water', 'Syngas'],
        },
        {
          num: '7',
          title: 'Gas drying and storage',
          desc: 'Syngas is dried and sent to the product storage tank.',
          chips: [],
        },
        {
          num: '8',
          title: 'Return loop',
          desc: 'Part of the syngas is fed back to heat the decomposition chamber.',
          chips: [],
          isLoop: true,
        },
      ];

  const vpdStepsHtml = vpdSteps
    .map(
      (s, idx) => `<li class="step${idx === 0 ? ' is-active' : ''}${s.isLoop ? ' loop' : ''}">
        <button type="button" class="step-head"${idx === 0 ? ' aria-current="step"' : ''}>
          <span class="step-num">${escHtml(s.num)}</span>
          <span class="step-title">${escHtml(s.title)}</span>
        </button>
        <p>${escHtml(s.desc)}</p>
        ${s.chips.length > 0 ? `<ul class="chips">${s.chips.map((c) => `<li>${escHtml(c)}</li>`).join('')}</ul>` : ''}
      </li>`,
    )
    .join('');

  return `
    <section class="hero-banner on-dark">
      <p class="eyebrow">${isVi ? 'Công nghệ' : 'Technology'}</p>
      <h1>${isVi ? 'Công nghệ: từ chất thải đến tài nguyên' : 'Technology: from waste to resources'}</h1>
      <p>${
        isVi
          ? 'Nhà máy GMS định hướng hai nhóm công đoạn: sàng tuyển để tách các dòng vật chất, và công nghệ VPD để chuyển hoá những dòng nguyên liệu phù hợp thành sản phẩm mới.'
          : 'The GMS plant is built around two process groups: sorting to separate material streams, and VPD technology to convert suitable feedstock into new products.'
      }</p>
      <ul class="pills" style="margin-top: 14px;">
        <li>${isVi ? 'Công nghệ VPD' : 'VPD technology'}</li>
        <li>${isVi ? 'Sàng tuyển' : 'Sorting'}</li>
        <li>${isVi ? 'Tái tạo tài nguyên' : 'Resource recovery'}</li>
      </ul>
    </section>

    <section class="section-block">
      <p class="eyebrow">${isVi ? 'Tổng quan' : 'Overview'}</p>
      <h2>${isVi ? 'Một dòng vào, sáu dòng tài nguyên ra' : 'One stream in, six resource streams out'}</h2>
      <div class="diagram-box" data-testid="tech-diagram" role="region" aria-label="${escHtml(diagramAria)}">
        <svg class="flow-svg flow-wide" viewBox="0 0 1000 380" role="img" aria-label="${escHtml(diagramAria)}">
          <defs>
            <marker id="ah-w" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#368F3D"/></marker>
            <marker id="ah-wb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#1D6FB6"/></marker>
          </defs>
          <g>
            <path class="wire" d="M190 190 C240 190 240 90 286 90" marker-end="url(#ah-w)"/>
            <path class="wire blue" d="M190 190 C240 190 240 290 286 290" marker-end="url(#ah-wb)"/>
            <path class="wire" d="M480 90 C525 90 525 44 566 44" marker-end="url(#ah-w)"/>
            <path class="wire" d="M480 90 C525 90 525 96 566 96" marker-end="url(#ah-w)"/>
            <path class="wire" d="M480 90 C525 90 525 148 566 148" marker-end="url(#ah-w)"/>
            <path class="wire blue" d="M480 290 C525 290 525 232 566 232" marker-end="url(#ah-wb)"/>
            <path class="wire blue" d="M480 290 C525 290 525 284 566 284" marker-end="url(#ah-wb)"/>
            <path class="wire blue" d="M480 290 C525 290 525 336 566 336" marker-end="url(#ah-wb)"/>
            <path class="wire" d="M750 44 C795 44 795 190 826 190"/>
            <path class="wire" d="M750 96 C795 96 795 190 826 190"/>
            <path class="wire" d="M750 148 C795 148 795 190 826 190"/>
            <path class="wire blue" d="M750 232 C795 232 795 190 826 190"/>
            <path class="wire blue" d="M750 284 C795 284 795 190 826 190"/>
            <path class="wire blue" d="M750 336 C795 336 795 190 826 190"/>
          </g>
          <g class="node dark"><rect x="20" y="160" width="170" height="60" rx="12"/>
            <text x="105" y="190" text-anchor="middle" dominant-baseline="central">${isVi ? 'Chất thải đầu vào' : 'Incoming waste'}</text></g>
          <g class="node green"><rect x="290" y="60" width="190" height="60" rx="12"/>
            <text x="385" y="90" text-anchor="middle" dominant-baseline="central">${isVi ? 'Sàng tuyển' : 'Sorting'}</text></g>
          <g class="node blue"><rect x="290" y="260" width="190" height="60" rx="12"/>
            <text x="385" y="290" text-anchor="middle" dominant-baseline="central">${isVi ? 'Công nghệ VPD' : 'VPD technology'}</text></g>
          <g class="node out"><rect x="570" y="22" width="180" height="44" rx="22"/>
            <text x="660" y="44" text-anchor="middle" dominant-baseline="central">${isVi ? 'Nilon' : 'Plastic film'}</text></g>
          <g class="node out"><rect x="570" y="74" width="180" height="44" rx="22"/>
            <text x="660" y="96" text-anchor="middle" dominant-baseline="central">${isVi ? 'Mùn hữu cơ' : 'Organic humus'}</text></g>
          <g class="node out"><rect x="570" y="126" width="180" height="44" rx="22"/>
            <text x="660" y="148" text-anchor="middle" dominant-baseline="central">RDF</text></g>
          <g class="node out vpd"><rect x="570" y="210" width="180" height="44" rx="22"/>
            <text x="660" y="232" text-anchor="middle" dominant-baseline="central">Syngas</text></g>
          <g class="node out vpd"><rect x="570" y="262" width="180" height="44" rx="22"/>
            <text x="660" y="284" text-anchor="middle" dominant-baseline="central">${isVi ? 'Than hoạt tính' : 'Activated carbon'}</text></g>
          <g class="node out vpd"><rect x="570" y="314" width="180" height="44" rx="22"/>
            <text x="660" y="336" text-anchor="middle" dominant-baseline="central">${isVi ? 'Dầu tái chế' : 'Recycled oil'}</text></g>
          <g class="node dark"><rect x="830" y="146" width="150" height="88" rx="14"/>
            <text x="905" y="178" text-anchor="middle" dominant-baseline="central">${isVi ? 'Tài nguyên' : 'Resources back'}</text>
            <text x="905" y="202" text-anchor="middle" dominant-baseline="central">${isVi ? 'quay lại chu trình' : 'into use'}</text></g>
          <circle class="dot" cx="826" cy="190" r="5"/>
        </svg>

        <svg class="flow-svg flow-tall" viewBox="0 0 360 500" role="img" aria-label="${escHtml(diagramAria)}">
          <defs>
            <marker id="ah-t" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#368F3D"/></marker>
            <marker id="ah-tb" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#1D6FB6"/></marker>
          </defs>
          <path class="wire" d="M180 68 C180 94 94 90 94 114" marker-end="url(#ah-t)"/>
          <path class="wire blue" d="M180 68 C180 94 266 90 266 114" marker-end="url(#ah-tb)"/>
          <path class="wire" d="M94 172 L94 356"/>
          <path class="wire blue" d="M266 172 L266 356"/>
          <path class="wire" d="M94 356 C94 396 180 392 180 420" marker-end="url(#ah-t)"/>
          <path class="wire blue" d="M266 356 C266 396 180 392 180 420" marker-end="url(#ah-tb)"/>
          <g class="node dark"><rect x="80" y="16" width="200" height="52" rx="12"/>
            <text x="180" y="42" text-anchor="middle" dominant-baseline="central">${isVi ? 'Chất thải đầu vào' : 'Incoming waste'}</text></g>
          <g class="node green"><rect x="16" y="120" width="156" height="52" rx="12"/>
            <text x="94" y="146" text-anchor="middle" dominant-baseline="central">${isVi ? 'Sàng tuyển' : 'Sorting'}</text></g>
          <g class="node blue"><rect x="188" y="120" width="156" height="52" rx="12"/>
            <text x="266" y="146" text-anchor="middle" dominant-baseline="central">${isVi ? 'Công nghệ VPD' : 'VPD technology'}</text></g>
          <g class="node out"><rect x="24" y="210" width="140" height="40" rx="20"/>
            <text x="94" y="230" text-anchor="middle" dominant-baseline="central">${isVi ? 'Nilon' : 'Plastic film'}</text></g>
          <g class="node out"><rect x="24" y="262" width="140" height="40" rx="20"/>
            <text x="94" y="282" text-anchor="middle" dominant-baseline="central">${isVi ? 'Mùn hữu cơ' : 'Organic humus'}</text></g>
          <g class="node out"><rect x="24" y="314" width="140" height="40" rx="20"/>
            <text x="94" y="334" text-anchor="middle" dominant-baseline="central">RDF</text></g>
          <g class="node out vpd"><rect x="196" y="210" width="140" height="40" rx="20"/>
            <text x="266" y="230" text-anchor="middle" dominant-baseline="central">Syngas</text></g>
          <g class="node out vpd"><rect x="196" y="262" width="140" height="40" rx="20"/>
            <text x="266" y="282" text-anchor="middle" dominant-baseline="central">${isVi ? 'Than hoạt tính' : 'Activated carbon'}</text></g>
          <g class="node out vpd"><rect x="196" y="314" width="140" height="40" rx="20"/>
            <text x="266" y="334" text-anchor="middle" dominant-baseline="central">${isVi ? 'Dầu tái chế' : 'Recycled oil'}</text></g>
          <g class="node dark"><rect x="40" y="426" width="280" height="56" rx="14"/>
            <text x="180" y="454" text-anchor="middle" dominant-baseline="central">${isVi ? 'Tài nguyên quay lại chu trình' : 'Resources back into use'}</text></g>
        </svg>

        <div class="grid-cards" style="margin-top: 20px;">
          <div class="card" data-branch="screening">
            <h3>${isVi ? 'Nhánh 1: Sàng tuyển' : 'Branch 1: Sorting (Screening)'}</h3>
            <ul>
              <li data-stage="feeding" style="font-size: 16px;">${isVi ? '1. Cấp liệu đều lên dây chuyền' : '1. Even feeding onto the line'}</li>
              <li data-stage="bag-opening" style="font-size: 16px;">${isVi ? '2. Mở bao tách rời vật liệu' : '2. Bag opening to separate contents'}</li>
              <li data-stage="rotary-screening" style="font-size: 16px;">${isVi ? '3. Lồng tuyển phân loại & thu từng dòng (Nilon, Mùn hữu cơ, RDF)' : '3. Rotary screening & stream collection (Plastic film, Organic humus, RDF)'}</li>
            </ul>
          </div>
          <div class="card" data-branch="vpd">
            <h3>${isVi ? 'Nhánh 2: Công nghệ VPD' : 'Branch 2: VPD Technology'}</h3>
            <ul>
              <li data-stage="pretreatment" style="font-size: 16px;">${isVi ? '1. Tiếp nhận, mở bao, ép tách nước & sấy giảm ẩm' : '1. Intake, bag opening, dewatering press & drying'}</li>
              <li data-stage="thermal-decomposition" style="font-size: 16px;">${isVi ? '2. Phân huỷ nhiệt trong buồng kín thu than hoạt tính' : '2. Closed-chamber thermal decomposition recovering activated carbon'}</li>
              <li data-stage="gas-cleaning-loop" style="font-size: 16px;">${isVi ? '3. Làm sạch tách dòng khí (dầu tái chế, syngas) & vòng hồi lưu nhiệt' : '3. Gas cleaning & separation (recycled oil, syngas) & thermal return loop'}</li>
            </ul>
          </div>
        </div>
      </div>
      ${customBody}
      <p style="margin-top: 16px;">
        <a href="${ROUTES.contact[locale]}?from=technology" class="btn" data-testid="cta-contact">${isVi ? 'Liên hệ trao đổi kỹ thuật' : 'Contact our technical team'}</a>
      </p>
    </section>

    ${drawingHtml}

    <section class="section-block" aria-labelledby="vpd-title">
      <p class="eyebrow">${isVi ? 'Công nghệ VPD' : 'VPD technology'}</p>
      <h2 id="vpd-title">${isVi ? 'Quy trình chuyển hoá, từng bước' : 'The conversion process, step by step'}</h2>
      <p>${isVi ? 'Bấm từng bước hoặc chọn “Tự chạy” để xem dòng nguyên liệu đi qua dây chuyền.' : 'Tap a step or choose “Auto play” to follow the feedstock through the line.'}</p>
      <div class="step-controls">
        <button type="button" class="btn btn-outline" id="step-prev">${icon('arrow-left', { size: 18 })}${isVi ? 'Bước trước' : 'Previous'}</button>
        <button type="button" class="btn" id="step-play" aria-pressed="false" data-label-play="${isVi ? 'Tự chạy' : 'Auto play'}" data-label-stop="${isVi ? 'Dừng' : 'Stop'}">${isVi ? 'Tự chạy' : 'Auto play'}</button>
        <button type="button" class="btn btn-outline" id="step-next">${isVi ? 'Bước sau' : 'Next'}${icon('arrow-right', { size: 18 })}</button>
      </div>
      <p class="sr-only" aria-live="polite" id="step-live"></p>
      <ol class="steps" id="vpd-steps-list">
        ${vpdStepsHtml}
      </ol>
    </section>

    <section class="section-block">
      <p class="eyebrow">${isVi ? 'Chung tay vì môi trường xanh' : 'Partner for a greener future'}</p>
      <h2>${isVi ? 'Trao đổi về công nghệ & hợp tác với GMS' : 'Discuss technology & partnership with GMS'}</h2>
      <p><a href="${ROUTES.contact[locale]}?from=technology" class="btn" data-testid="cta-contact">${isVi ? 'Liên hệ với GMS' : 'Contact GMS'}</a></p>
    </section>

    <script>
    (function() {
      var list = document.getElementById('vpd-steps-list');
      if (!list) return;
      var steps = Array.prototype.slice.call(list.querySelectorAll('.step'));
      var playBtn = document.getElementById('step-play');
      var prevBtn = document.getElementById('step-prev');
      var nextBtn = document.getElementById('step-next');
      var live = document.getElementById('step-live');
      var cur = 0;
      var timer = null;

      function go(idx, announce) {
        cur = (idx + steps.length) % steps.length;
        steps.forEach(function(s, k) {
          s.classList.toggle('is-active', k === cur);
          var h = s.querySelector('.step-head');
          if (h) {
            if (k === cur) h.setAttribute('aria-current', 'step');
            else h.removeAttribute('aria-current');
          }
        });
        if (announce && live) {
          var t = steps[cur].querySelector('.step-title');
          live.textContent = (cur + 1) + '/' + steps.length + ': ' + (t ? t.textContent : '');
        }
      }
      function stop() {
        if (timer) { clearInterval(timer); timer = null; }
        if (playBtn) {
          playBtn.setAttribute('aria-pressed', 'false');
          playBtn.textContent = playBtn.getAttribute('data-label-play') || 'Play';
        }
      }
      function start() {
        stop();
        if (playBtn) {
          playBtn.setAttribute('aria-pressed', 'true');
          playBtn.textContent = playBtn.getAttribute('data-label-stop') || 'Stop';
        }
        timer = setInterval(function() { go(cur + 1, false); }, 2400);
      }
      if (playBtn) playBtn.addEventListener('click', function() { if (timer) stop(); else start(); });
      if (prevBtn) prevBtn.addEventListener('click', function() { stop(); go(cur - 1, true); });
      if (nextBtn) nextBtn.addEventListener('click', function() { stop(); go(cur + 1, true); });
      steps.forEach(function(s, k) {
        var h = s.querySelector('.step-head');
        if (h) h.addEventListener('click', function() { stop(); go(k, true); });
      });
    })();
    </script>
  `;
}

function renderProductsPage(content: LoadedSiteContent, locale: Locale): string {
  const isVi = locale === 'vi';
  const screeningLines = content.outputLines.filter((l) => l.group === 'sang-tuyen');
  const vpdLines = content.outputLines.filter((l) => l.group === 'vpd');

  const renderGroup = (title: string, items: typeof screeningLines) => `
    <section class="section-block" data-testid="output-group">
      <h2>${escHtml(title)}</h2>
      <div class="grid-cards">
        ${items
          .map(
            (item) => `<article class="card" data-testid="output-row">
              <h3>${escHtml(item.name[locale])}</h3>
              <p><span class="badge">${item.state === 'da-co' ? (isVi ? 'Đã có' : 'Available') : isVi ? 'Định hướng' : 'Planned'}</span></p>
              <p>${escHtml(item.desc[locale])}</p>
            </article>`,
          )
          .join('')}
      </div>
    </section>
  `;

  return `
    <section class="section-block">
      <p class="eyebrow">${isVi ? 'Đầu ra định hướng' : 'Planned outputs'}</p>
      <h1>${isVi ? 'Sản phẩm đầu ra' : 'Output Products'}</h1>
      <p>${
        isVi
          ? 'Sáu dòng sản phẩm thu hồi từ quá trình sàng tuyển cơ học và công nghệ nhiệt phân VPD.'
          : 'Six recovered output lines from mechanical sorting and VPD pyrolysis technology.'
      }</p>
    </section>
    ${renderGroup(isVi ? 'Nhóm Sàng tuyển' : 'Sorting Group (Sàng tuyển)', screeningLines)}
    ${renderGroup(isVi ? 'Nhóm Công nghệ VPD' : 'VPD Technology Group (Công nghệ VPD)', vpdLines)}
  `;
}

function renderNewsListPage(content: LoadedSiteContent, locale: Locale, pageNum: number): string {
  const isVi = locale === 'vi';
  // Không có journey-steps.yaml ⇒ lộ trình mặc định, không nhãn (loader.ts LoadedSiteContent.journeySteps).
  const defaultNames = isVi
    ? [
        'Đánh giá hiện trạng',
        'Tổ chức mặt bằng',
        'Cải tạo hạ tầng',
        'Triển khai công nghệ',
        'Hoàn thiện hệ thống vận hành',
      ]
    : [
        'Current-state assessment',
        'Site organisation',
        'Infrastructure upgrade',
        'Technology deployment',
        'Operating-system completion',
      ];
  const stepRows: Array<{ name: string; status: string | null }> = content.journeySteps
    ? content.journeySteps.map((s) => ({ name: s.name[locale], status: s.status }))
    : defaultNames.map((name) => ({ name, status: null }));
  // Nhãn theo ux-spec C34–C36, nguồn src/i18n/*.json → journeyStatus (content-model.ts:104-106).
  const statusLabel = (status: string | null): string => {
    if (!status) return '';
    const labels: Record<string, string> = getDictionary(locale).journeyStatus;
    return labels[status] ?? '';
  };
  // Khoá ASCII cho class CSS, không phụ thuộc dạng Unicode của chữ tiếng Việt.
  const STATUS_KEY: Record<string, 'done' | 'doing' | 'upcoming'> = {
    'chưa tới': 'upcoming',
    'đang làm': 'doing',
    'đã xong': 'done',
  };
  // Biểu tượng lucide check/clock/circle, 14px, nét 2px (U03b), dựng chung nguồn với mọi biểu tượng khác.
  const STATUS_ICON: Record<'done' | 'doing' | 'upcoming', string> = {
    done: icon('check', { size: 14, strokeWidth: 2 }),
    doing: icon('clock', { size: 14, strokeWidth: 2 }),
    upcoming: icon('circle', { size: 14, strokeWidth: 2 }),
  };

  const allItems = content.news[locale];
  const start = (pageNum - 1) * PAGE_SIZE;
  const pageItems = allItems.slice(start, start + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));

  const listHtml =
    pageItems.length > 0
      ? `<div class="grid-cards">
          ${pageItems
            .map(
              (n) => `<article class="card" data-testid="news-item">
                <h2><a href="${ROUTES.news[locale]}/${n.slug}">${escHtml(n.title)}</a></h2>
                <p><small>${escHtml(formatDateLocale(n.date, locale))}</small></p>
                <p>${escHtml(n.summary)}</p>
              </article>`,
            )
            .join('')}
        </div>`
      : `<div data-testid="empty-state"><p>${
          isVi
            ? 'Chưa có bài viết nào. Mời bạn quay lại sau, hoặc liên hệ để biết thêm về GMS.'
            : 'There are no articles yet. Please check back later, or contact us to learn more about GMS.'
        }</p></div>`;

  let paginationHtml = '';
  if (totalPages > 1) {
    const links: string[] = [];
    for (let p = 1; p <= totalPages; p++) {
      const href = p === 1 ? ROUTES.news[locale] : `${ROUTES.news[locale]}/${isVi ? 'trang' : 'page'}/${p}`;
      links.push(
        `<a href="${href}"${p === pageNum ? ' aria-current="page"' : ''}>${isVi ? `Trang ${p}` : `Page ${p}`}</a>`,
      );
    }
    paginationHtml = `<nav aria-label="${isVi ? 'Phân trang tin tức' : 'News pagination'}">${links.join(' · ')}</nav>`;
  }

  return `
    <section class="section-block">
      <p class="eyebrow">${isVi ? 'Hành trình chuyển đổi' : 'Transformation journey'}</p>
      <h1>${isVi ? 'Tin tức & Hành trình chuyển đổi' : 'News & Transformation Journey'}</h1>
      <h2>${isVi ? 'Lộ trình chuyển đổi 5 bước' : '5-Step Transformation Roadmap'}</h2>
      <ol class="grid-cards">
        ${stepRows
          .map((s, idx) => {
            const label = statusLabel(s.status);
            const key = s.status ? STATUS_KEY[s.status] : undefined;
            const badge = label
              ? `<div class="journey-status"><span class="badge badge-status${key ? ` badge-status--${key}` : ''}" data-status="${escHtml(s.status ?? '')}">${key ? STATUS_ICON[key] : ''}${escHtml(label)}</span></div>`
              : '';
            return `<li class="card" data-testid="journey-step"><strong>${idx + 1}. ${escHtml(s.name)}</strong>${badge}</li>`;
          })
          .join('')}
      </ol>
    </section>
    <section class="section-block">
      <h2>${isVi ? 'Danh sách bài viết' : 'Articles'}</h2>
      ${listHtml}
      ${paginationHtml}
    </section>
  `;
}

function renderProjectsListPage(content: LoadedSiteContent, locale: Locale): string {
  const isVi = locale === 'vi';
  const items = content.projects[locale];
  const body =
    items.length > 0
      ? `<div class="grid-cards">
          ${items
            .map(
              (p) => `<article class="card" data-testid="list-item">
                <h2><a href="${ROUTES.projects[locale]}/${p.slug}">${escHtml(p.title)}</a></h2>
                <p><small>${escHtml(formatDateLocale(p.date, locale))} · ${escHtml(p.category)}</small></p>
                <p>${escHtml(p.summary)}</p>
              </article>`,
            )
            .join('')}
        </div>`
      : `<div data-testid="empty-state"><p>${
          isVi
            ? 'Thư viện dự án đang được cập nhật. Mời bạn quay lại sau.'
            : 'The project gallery is being updated. Please check back later.'
        }</p></div>`;

  return `
    <section class="section-block">
      <p class="eyebrow">${isVi ? 'Dự án / Thư viện' : 'Projects / Gallery'}</p>
      <h1>${isVi ? 'Dự án & Thư viện hình ảnh' : 'Projects & Visual Gallery'}</h1>
      ${body}
    </section>
  `;
}

function renderCareersListPage(content: LoadedSiteContent, locale: Locale): string {
  const isVi = locale === 'vi';
  const items = content.jobs[locale];
  // Tin tuyển dụng chưa có trường địa điểm riêng: nơi làm việc là địa chỉ công ty (cùng nguồn JSON-LD JobPosting).
  const place = content.company.address?.[locale]?.trim() || content.company.address?.vi?.trim() || '';
  const body =
    items.length > 0
      ? `<div class="grid-cards">
          ${items
            .map(
              (j) => `<article class="card" data-testid="list-item">
                <h3><a href="${ROUTES.careers[locale]}/${j.slug}">${escHtml(j.title)}</a></h3>
                ${place ? `<p class="il">${icon('map-pin')}<span><span class="sr-only">${isVi ? 'Địa điểm' : 'Location'}: </span>${escHtml(place)}</span></p>` : ''}
                <p class="il">${icon('circle-alert')}<span><span class="sr-only">${isVi ? 'Hạn nộp' : 'Deadline'}: </span>${escHtml(formatDateLocale(j.validThrough, locale))}</span></p>
              </article>`,
            )
            .join('')}
        </div>`
      : `<div data-testid="empty-state"><p>${
          isVi
            ? 'Hiện chưa có vị trí tuyển dụng. Mời bạn theo dõi trang này hoặc liên hệ với chúng tôi.'
            : 'There are no open positions at the moment. Please check this page again or contact us.'
        }</p></div>`;

  return `
    <section class="section-block">
      <p class="eyebrow">${isVi ? 'Cơ hội nghề nghiệp' : 'Career opportunities'}</p>
      <h1>${isVi ? 'Tuyển dụng' : 'Careers'}</h1>
      ${body}
    </section>
  `;
}

function renderFaqPage(content: LoadedSiteContent, locale: Locale): string {
  const isVi = locale === 'vi';
  const items = content.faq[locale];
  const body =
    items.length > 0
      ? `<div class="grid-cards">
          ${items
            .map(
              (f) => `<article class="card" data-testid="list-item">
                <h2 data-testid="faq-question">${escHtml(f.question)}</h2>
                <p>${escHtml(f.answer)}</p>
              </article>`,
            )
            .join('')}
        </div>`
      : `<div data-testid="empty-state"><p>${
          isVi
            ? 'Chưa có câu hỏi thường gặp. Nếu cần hỗ trợ, mời bạn liên hệ với chúng tôi.'
            : 'No frequently asked questions yet. If you need help, please contact us.'
        }</p></div>`;

  return `
    <section class="section-block">
      <p class="eyebrow">FAQ</p>
      <h1>${isVi ? 'Câu hỏi thường gặp (FAQ)' : 'Frequently Asked Questions (FAQ)'}</h1>
      ${body}
    </section>
  `;
}

function renderPrivacyPage(content: LoadedSiteContent, locale: Locale): string {
  const isVi = locale === 'vi';
  const pol = content.policies[locale][0];
  const ver = pol?.version ?? '1.0';
  const eff = formatDateLocale(pol?.effectiveFrom ?? '2026-01-01', locale);
  const ctrlName = content.company.legalName || 'Công ty Cổ phần Môi trường Năng lượng Xanh Hưng Yên';
  const reqEmail = content.company.privacyRequestEmail?.trim() ?? '';
  // Thiếu email nhận yêu cầu ⇒ không in liên kết mailto: rỗng hay dòng email trống (privacy-policy.feature:72-78).
  const reqEmailLink = reqEmail ? `<a href="mailto:${escHtml(reqEmail)}">${escHtml(reqEmail)}</a>` : '';

  const standardNotice = isVi
    ? `<p><strong>Phiên bản:</strong> ${escHtml(ver)} — <strong>Ngày hiệu lực:</strong> ${escHtml(eff)}</p>
       <p><strong>Căn cứ pháp lý:</strong> Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP.</p>
       <p><strong>Bên kiểm soát dữ liệu:</strong> ${escHtml(ctrlName)}.</p>
       <p><strong>Mục đích xử lý:</strong> Tiếp nhận, liên hệ lại và trả lời yêu cầu của người gửi từ biểu mẫu liên hệ.</p>
       <p><strong>Ai được xem / truy cập:</strong> Bộ phận phụ trách liên hệ của ${escHtml(ctrlName)} và nhà cung cấp hạ tầng kỹ thuật Cloudflare.</p>
       <p><strong>Quyền của chủ thể dữ liệu:</strong> Bạn có quyền yêu cầu xem, sửa, xoá dữ liệu cá nhân hoặc rút lại đồng ý bất cứ lúc nào ${reqEmailLink ? `bằng cách gửi yêu cầu tới địa chỉ email nhận yêu cầu về dữ liệu: ${reqEmailLink}.` : 'bằng cách liên hệ với bên kiểm soát dữ liệu qua các kênh nêu ở trang Liên hệ.'}</p>`
    : `<p><strong>Version:</strong> ${escHtml(ver)} — <strong>Effective date:</strong> ${escHtml(eff)}</p>
       <p><strong>Legal basis:</strong> Personal Data Protection Law No. 91/2025/QH15 and Decree 356/2025/ND-CP.</p>
       <p><strong>Data controller:</strong> ${escHtml(ctrlName)}.</p>
       <p><strong>Purpose of processing:</strong> Receiving, contacting and responding to inquiries submitted via the contact form.</p>
       <p><strong>Who can access:</strong> Authorized staff at ${escHtml(ctrlName)} and technical processor Cloudflare.</p>
       <p><strong>Your rights:</strong> You have the right to access, rectify or request deletion / erasure of your personal data, or withdraw your consent at any time by ${reqEmailLink ? `contacting: ${reqEmailLink}.` : 'contacting the data controller through the channels listed on the Contact page.'}</p>`;

  return `
    <section class="section-block">
      <p class="eyebrow">${isVi ? 'Bảo vệ dữ liệu cá nhân' : 'Personal data protection'}</p>
      <h1>${isVi ? 'Chính sách bảo mật dữ liệu cá nhân' : 'Personal Data Privacy Policy'}</h1>
      ${standardNotice}
      <div>${pol?.bodyHtml ?? ''}</div>
    </section>
  `;
}

// Phần JS của form liên hệ (chạy trong IIFE của trang Liên hệ, sau khi lấy `form`). Microcopy: ux-spec §6.4–6.5;
// trạng thái F1–F5: ux-spec §5.3; request/response: contracts/api.ts. Trong template literal này: gấp đôi dấu `\`, không dùng `${`.
// Mã điện thoại/Zalo chỉ được sinh khi công ty đã công bố kênh đó (hasPhone/hasZalo).
const contactFormScript = (hasPhone: boolean, hasZalo: boolean): string => `
    var $ = function(id) { return document.getElementById(id); };
    var loc = form.getAttribute('data-locale') || 'vi';
    var isVi = loc === 'vi';
    var feedback = $('contact-feedback-area');
    var submitBtn = $('contact-submit-btn');
    var statusEl = $('contact-status');
    var waitEl = $('contact-human-wait');
    var slot = $('contact-human-slot');
    ${
      hasPhone
        ? `var phoneRaw = form.getAttribute('data-phone') || '';
    var phoneShown = form.getAttribute('data-phone-shown') || phoneRaw;`
        : ''
    }
    ${hasZalo ? `var zalo = form.getAttribute('data-zalo') || '';` : ''}
    var sitekey = form.getAttribute('data-sitekey') || '';
    var CTRL = /[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]/;
    function esc(s) {
      return String(s).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
    }

    var T = isVi ? {
      send: 'Gửi liên hệ', sending: 'Đang gửi…', okTitle: 'Đã gửi liên hệ',
      ok: 'Cảm ơn bạn. GMS đã nhận được thông tin và sẽ liên hệ lại.', again: 'Gửi liên hệ khác', home: 'Về trang chủ',
      errName: 'Vui lòng nhập họ và tên.', errContact: 'Vui lòng nhập email hoặc số điện thoại',
      errEmail: 'Email chưa đúng dạng. Ví dụ: ten@congty.vn',
      errPhone: 'Số điện thoại chưa đúng. Nhập 8–20 ký tự gồm số, có thể có dấu + ở đầu, dấu cách, dấu chấm hoặc gạch ngang.',
      errMsg: 'Vui lòng nhập nội dung bạn muốn gửi.', errConsent: 'Vui lòng đồng ý với việc xử lý thông tin để gửi liên hệ.',
      errLong: function(n) { return 'Nội dung dài quá ' + n + ' ký tự. Vui lòng rút gọn.'; },
      errChars: function(l) { return 'Ô “' + l + '” có ký tự không dùng được, ví dụ ký tự xuống dòng hoặc ký tự ẩn khi dán. Vui lòng xoá đi và gõ lại bằng chữ, số và dấu câu thông thường.'; },
      sum: function(n) { return 'Cần sửa ' + n + ' mục trước khi gửi:'; },
      rate: function(s) { return 'Bạn đã gửi quá nhiều lần. Vui lòng thử lại sau ' + (s ? Math.ceil(s / 60) + ' phút' : 'ít phút') + '. Chữ bạn đã nhập vẫn còn.'; },
      human: 'Chưa xác minh được bạn là người thật. Vui lòng thử gửi lại. Chữ bạn đã nhập vẫn còn.',
      humanWait: 'Vui lòng hoàn tất bước xác minh bên dưới để gửi liên hệ.',
      origin: 'Liên hệ chưa được gửi vì yêu cầu không đến từ trang web của GMS. Vui lòng mở form liên hệ trên trang web chính thức của GMS rồi gửi lại. Chữ bạn đã nhập vẫn còn trên trang này.',
      policy: 'Chính sách bảo mật vừa được cập nhật. Vui lòng đọc lại và tick ô đồng ý, rồi gửi lại. Chữ bạn đã nhập vẫn còn.',
      policyLink: 'Chính sách bảo mật',
      tooBig: 'Nội dung gửi quá lớn. Vui lòng rút gọn rồi gửi lại.',
      fail: 'Chưa gửi được liên hệ của bạn, GMS chưa nhận được. Chữ bạn đã nhập vẫn còn; vui lòng thử lại sau ít phút.',
      off: 'Form liên hệ tạm thời chưa mở. Bạn có thể liên hệ GMS qua các kênh dưới đây.',
      chPhone: 'Điện thoại', chZalo: 'Nhắn Zalo'
    } : {
      send: 'Send message', sending: 'Sending…', okTitle: 'Message sent',
      ok: 'Thank you. GMS has received your details and will get back to you.', again: 'Send another message', home: 'Back to home page',
      errName: 'Please enter your full name.', errContact: 'Please enter an email or a phone number',
      errEmail: "That email doesn't look right. Example: name@company.com",
      errPhone: "That phone number doesn't look right. Use 8–20 characters: digits, an optional leading +, spaces, dots or hyphens.",
      errMsg: 'Please enter your message.', errConsent: 'Please agree to the processing of your details to send your message.',
      errLong: function(n) { return 'This is longer than ' + n + ' characters. Please shorten it.'; },
      errChars: function(l) { return 'The “' + l + '” field contains characters that can\\'t be used, such as a line break or a hidden character from pasting. Please delete it and retype using ordinary letters, numbers and punctuation.'; },
      sum: function(n) { return n + ' item(s) to fix before sending:'; },
      rate: function(s) { return "You've sent too many messages. Please try again " + (s ? 'in ' + Math.ceil(s / 60) + ' minute(s)' : 'in a few minutes') + '. What you typed is still here.'; },
      human: "We couldn't verify that you're a person. Please try sending again. What you typed is still here.",
      humanWait: 'Please complete the verification below to send your message.',
      origin: "Your message wasn't sent because the request did not come from the GMS website. Please open the contact form on the official GMS website and send it again. What you typed is still on this page.",
      policy: 'The privacy policy has just been updated. Please read it again, tick the consent box, then send again. What you typed is still here.',
      policyLink: 'Privacy policy',
      tooBig: "What you're sending is too large. Please shorten it and try again.",
      fail: "We couldn't send your message and GMS has not received it. What you typed is still here; please try again in a few minutes.",
      off: 'The contact form is temporarily unavailable. You can reach GMS through the channels below.',
      chPhone: 'Phone', chZalo: 'Message on Zalo'
    };

    // Kênh khác: chỉ hiện kênh đã công bố (không có kênh nào thì không thêm gì).
    function urgent() {
      var p = [];
      ${hasPhone ? `p.push((isVi ? 'gọi ' : 'call ') + '<a href="tel:' + esc(phoneRaw) + '">' + esc(phoneShown) + '</a>');` : ''}
      ${hasZalo ? `p.push((isVi ? 'nhắn ' : 'message us on ') + '<a href="' + esc(zalo) + '" rel="noopener noreferrer">Zalo</a>');` : ''}
      if (!p.length) return '';
      return ' ' + (isVi ? 'Nếu cần gấp, hãy ' + p.join(' hoặc ') : 'If urgent, ' + p.join(' or ')) + '.';
    }
    function channelsList() {
      var li = '';
      ${hasPhone ? `li += '<li>' + T.chPhone + ': <a href="tel:' + esc(phoneRaw) + '">' + esc(phoneShown) + '</a></li>';` : ''}
      ${hasZalo ? `li += '<li><a href="' + esc(zalo) + '" rel="noopener noreferrer">' + T.chZalo + '</a></li>';` : ''}
      return li ? '<ul>' + li + '</ul>' : '';
    }

    // ---- trường & lỗi từng trường (F3a) ----
    var FIELDS = {
      fullName: { id: 'contact-name', label: isVi ? 'Họ và tên' : 'Full name', max: 200 },
      email: { id: 'contact-email', max: 254 },
      phone: { id: 'contact-phone', max: 20 },
      company: { id: 'contact-company', label: isVi ? 'Công ty / Tổ chức' : 'Company / Organisation', max: 200 },
      message: { id: 'contact-message', max: 5000 },
      consent: { id: 'contact-consent' }
    };
    var ORDER = ['fullName', 'email', 'phone', 'company', 'message', 'consent'];
    var errs = {};
    function fieldEl(k) { return $(FIELDS[k].id); }
    function val(k) { return (fieldEl(k).value || '').trim(); }
    function paint(k) {
      var f = fieldEl(k);
      var h = $('err-' + k);
      if (errs[k]) {
        h.querySelector('.fe-text').textContent = errs[k];
        h.hidden = false;
        f.setAttribute('aria-invalid', 'true');
        f.setAttribute('aria-describedby', 'err-' + k);
      } else {
        h.querySelector('.fe-text').textContent = '';
        h.hidden = true;
        f.removeAttribute('aria-invalid');
        f.removeAttribute('aria-describedby');
      }
    }
    function localMsg(k) {
      var v = k === 'consent' ? '' : val(k);
      var max = FIELDS[k].max;
      if (k === 'fullName' && !v) return T.errName;
      if (k === 'message' && !v) return T.errMsg;
      if (k === 'consent') return fieldEl(k).checked ? '' : T.errConsent;
      if ((k === 'fullName' || k === 'company') && CTRL.test(v)) return T.errChars(FIELDS[k].label);
      if (k === 'email' && v && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v)) return T.errEmail;
      if (k === 'phone' && v && !/^\\+?[0-9 .-]{8,20}$/.test(v)) return T.errPhone;
      if (max && v.length > max) return T.errLong(max);
      return '';
    }
    function validateAll() {
      errs = {};
      ORDER.forEach(function(k) { var m = localMsg(k); if (m) errs[k] = m; });
      if (!val('email') && !val('phone')) { errs.email = T.errContact; errs.phone = T.errContact; }
      ORDER.forEach(paint);
      return Object.keys(errs).length;
    }
    function summaryHtml() {
      var items = [];
      ORDER.forEach(function(k) {
        if (!errs[k]) return;
        if (k === 'phone' && errs.phone === errs.email) return;
        items.push('<li><a href="#' + FIELDS[k].id + '" data-focus="' + FIELDS[k].id + '">' + esc(errs[k]) + '</a></li>');
      });
      return '<p style="margin:0 0 6px"><strong>' + T.sum(items.length) + '</strong></p><ul>' + items.join('') + '</ul>';
    }
    function showBlock(html, tone) {
      feedback.innerHTML = '<div class="' + (tone === 'info' ? 'notice-box' : 'error-box') + '" data-testid="contact-error" id="contact-summary" role="alert" tabindex="-1">' + html + '</div>';
      $('contact-summary').focus();
    }
    function refreshSummary() {
      var box = $('contact-summary');
      if (!box || !box.hasAttribute('data-fields')) return;
      if (!Object.keys(errs).length) { feedback.innerHTML = ''; return; }
      box.innerHTML = summaryHtml();
    }
    function showFieldSummary() {
      showBlock(summaryHtml());
      $('contact-summary').setAttribute('data-fields', '1');
    }
    feedback.addEventListener('click', function(e) {
      var a = e.target && e.target.closest ? e.target.closest('a[data-focus]') : null;
      if (!a) return;
      e.preventDefault();
      var t = $(a.getAttribute('data-focus'));
      if (t) t.focus();
    });
    function recheck(k) {
      var group = (k === 'email' || k === 'phone') ? ['email', 'phone'] : [k];
      group.forEach(function(g) {
        if (!errs[g]) return;
        var m = localMsg(g);
        if (!m && errs[g] === T.errContact && !val('email') && !val('phone')) m = T.errContact;
        if (m) errs[g] = m; else delete errs[g];
        paint(g);
      });
      refreshSummary();
    }
    ORDER.forEach(function(k) {
      var f = fieldEl(k);
      f.addEventListener('blur', function() { recheck(k); });
      f.addEventListener(k === 'consent' ? 'change' : 'input', function() { recheck(k); });
    });

    // Mã lỗi trường của máy chủ → chữ (ux-spec §6.5); không map được ⇒ null (coi như F3c)
    function serverFieldMsgs(fields) {
      var out = {};
      for (var k in fields) {
        if (!Object.prototype.hasOwnProperty.call(fields, k) || !FIELDS[k]) return null;
        var c = fields[k];
        var m = null;
        if (c === 'REQUIRED') m = k === 'fullName' ? T.errName : k === 'message' ? T.errMsg : k === 'consent' ? T.errConsent : (k === 'email' || k === 'phone') ? T.errContact : null;
        else if (c === 'TOO_LONG') m = FIELDS[k].max ? T.errLong(FIELDS[k].max) : null;
        else if (c === 'INVALID_EMAIL') m = k === 'email' ? T.errEmail : null;
        else if (c === 'INVALID_PHONE') m = k === 'phone' ? T.errPhone : null;
        else if (c === 'CONTACT_REQUIRED') { out.email = T.errContact; out.phone = T.errContact; continue; }
        else if (c === 'CONSENT_REQUIRED') m = T.errConsent;
        else if (c === 'INVALID_CHARS') m = (k === 'fullName' || k === 'company') ? T.errChars(FIELDS[k].label) : null;
        if (!m) return null;
        out[k] = m;
      }
      return Object.keys(out).length ? out : null;
    }

    // ---- Turnstile (Managed, interaction-only, flexible; token dùng một lần ⇒ reset sau mọi phản hồi khác 200 {ok:true}) ----
    var busy = false;
    var pending = false;
    var formOff = false;
    var token = '';
    var widgetId = null;
    var tsState = 'idle';
    function setBusy(b) {
      busy = b;
      submitBtn.disabled = b || formOff;
      submitBtn.textContent = b ? T.sending : T.send;
      form.setAttribute('aria-busy', b ? 'true' : 'false');
      statusEl.textContent = b ? T.sending : '';
      if (!b) showWait(false);
    }
    function showWait(on) {
      waitEl.textContent = on ? T.humanWait : '';
      waitEl.hidden = !on;
    }
    function resetWidget() {
      token = '';
      if (window.turnstile && widgetId !== null) { try { window.turnstile.reset(widgetId); } catch (e) { /* widget đã gỡ */ } }
    }
    function failNoToken() {
      pending = false;
      resetWidget();
      setBusy(false);
      showBlock(esc(T.fail) + urgent());
    }
    function renderWidget() {
      if (widgetId !== null || !window.turnstile) return;
      widgetId = window.turnstile.render(slot, {
        sitekey: sitekey,
        action: 'contact',
        appearance: 'interaction-only',
        size: 'flexible',
        language: loc,
        callback: function(t) { token = t; showWait(false); if (pending) send(); },
        'error-callback': function() { token = ''; if (pending) failNoToken(); return true; },
        'expired-callback': function() { token = ''; },
        'timeout-callback': function() { token = ''; },
        'before-interactive-callback': function() { if (pending) showWait(true); else slot.setAttribute('data-challenge', 'shown'); },
        'after-interactive-callback': function() { showWait(false); slot.removeAttribute('data-challenge'); }
      });
    }
    function loadTurnstile() {
      if (tsState !== 'idle' || !sitekey) return;
      tsState = 'loading';
      window.__gmsTurnstileReady = function() { tsState = 'ready'; renderWidget(); };
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__gmsTurnstileReady';
      s.async = true;
      s.defer = true;
      s.onerror = function() { tsState = 'failed'; if (pending) failNoToken(); };
      document.head.appendChild(s);
    }
    // Script bên thứ ba chỉ nạp khi người dùng chạm vào form (ux-spec §5.3, design.md §6d)
    ['focusin', 'pointerdown', 'touchstart'].forEach(function(ev) { form.addEventListener(ev, loadTurnstile, { once: true, passive: true }); });

    // ---- gửi ----
    function showSuccess() {
      pending = false;
      setBusy(false);
      var kids = form.children;
      for (var i = 0; i < kids.length; i++) { if (kids[i] !== feedback) kids[i].hidden = true; }
      feedback.innerHTML = '<div class="success-box" data-testid="contact-success" id="contact-ok" role="status" tabindex="-1"><h2 style="margin:0 0 6px;font-size:1.1rem">' + T.okTitle + '</h2><p style="margin:0 0 10px">' + T.ok + '</p><p style="margin:0"><button type="button" class="btn btn-secondary" id="contact-again">' + T.again + '</button> <a href="' + esc(form.getAttribute('data-home') || '/') + '">' + T.home + '</a></p></div>';
      $('contact-ok').focus();
      $('contact-again').addEventListener('click', function() {
        form.reset();
        errs = {};
        ORDER.forEach(paint);
        for (var j = 0; j < kids.length; j++) kids[j].hidden = false;
        feedback.innerHTML = '';
        waitEl.hidden = true;
        resetWidget();
        $('contact-name').focus();
      });
    }
    function onResult(status, data) {
      if (status === 200 && data && data.ok === true) { showSuccess(); return; }
      resetWidget();
      setBusy(false);
      var code = data && data.code;
      if (status === 503 && code === 'FORM_DISABLED') {
        formOff = true;
        submitBtn.disabled = true;
        showBlock('<p style="margin:0 0 6px">' + T.off + '</p>' + channelsList(), 'info');
      } else if (status === 422 && code === 'VALIDATION' && data.fields && serverFieldMsgs(data.fields)) {
        errs = serverFieldMsgs(data.fields);
        ORDER.forEach(paint);
        showFieldSummary();
      } else if (status === 403 && code === 'HUMAN_CHECK_FAILED') {
        showBlock(esc(T.human));
      } else if (status === 403 && code === 'ORIGIN_REJECTED') {
        showBlock(esc(T.origin) + urgent());
      } else if (status === 429 && code === 'RATE_LIMITED') {
        showBlock(esc(T.rate(data.retryAfterSeconds)));
      } else if (status === 409 && code === 'POLICY_CHANGED') {
        if (data.policyVersion) form.setAttribute('data-policy-version', data.policyVersion);
        fieldEl('consent').checked = false;
        var pl = form.querySelector('[data-testid="contact-consent-label"] a');
        if (pl) pl.setAttribute('target', '_blank');
        showBlock(esc(T.policy) + (pl ? ' <a href="' + esc(pl.getAttribute('href')) + '" target="_blank" rel="noopener">' + T.policyLink + '</a>' : ''));
      } else if (status === 413 && code === 'PAYLOAD_TOO_LARGE') {
        showBlock(esc(T.tooBig));
      } else {
        // STORE_FAILED, HUMAN_CHECK_UNAVAILABLE, 415, JSON sai dạng, mã lạ, không có JSON (F3c)
        showBlock(esc(T.fail) + urgent());
      }
    }
    function send() {
      pending = false;
      var t = token;
      token = '';
      var trap = $('contact-trap');
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: loc,
          fullName: val('fullName'),
          company: val('company') || undefined,
          email: val('email') || undefined,
          phone: val('phone') || undefined,
          message: val('message'),
          consent: true,
          policyVersion: form.getAttribute('data-policy-version') || '1.0',
          turnstileToken: t,
          pagePath: (window.location.pathname + window.location.search).slice(0, 512),
          website: (trap && trap.value) || undefined
        })
      }).then(function(res) {
        return res.json().catch(function() { return null; }).then(function(data) { onResult(res.status, data); });
      }).catch(function() { onResult(0, null); });
    }
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      if (busy || formOff) return;
      if (validateAll() > 0) { showFieldSummary(); return; }
      feedback.innerHTML = '';
      setBusy(true);
      pending = true;
      loadTurnstile();
      if (token) { send(); return; }
      if (tsState === 'failed' || !sitekey) { failNoToken(); return; }
      if (slot.getAttribute('data-challenge') === 'shown') showWait(true);
    });
`;

function renderContactPage(
  content: LoadedSiteContent,
  locale: Locale,
  contactRecipientEnv: string,
  formOpen: boolean,
): string {
  const isVi = locale === 'vi';
  const company = content.company;
  const hasRecipient = contactRecipientEnv.trim() !== '';
  const hasLegalName = Boolean(company.legalName && company.legalName.trim() !== '');
  // FormStatus (build.ts §9): thiếu mail sẵn sàng / email yêu cầu riêng tư / mã số thuế ⇒ form tạm đóng (F4), build vẫn xanh
  const canRenderForm = formOpen && hasRecipient && hasLegalName;
  const polVer = content.policies[locale][0]?.version ?? '1.0';
  const phoneRaw = company.phone?.trim() ?? '';
  const phoneShown = phoneRaw ? formatPublicPhone(phoneRaw, locale) : '';
  const zaloRaw = company.zalo?.trim() ?? '';
  // shortcut: sitekey công khai đọc từ môi trường lúc build; thiếu ⇒ sitekey thử của Cloudflare (luôn qua, chỉ dùng cho local/staging).
  // Bản deploy_prod phải đặt TURNSTILE_SITE_KEY thật (XQ cho architect/devops: contract chưa nêu nguồn sitekey).
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY?.trim() || '1x00000000000000000000AA';

  const channelsHtml = `
    <div data-testid="contact-channels">
      ${
        company.address?.[locale]
          ? `<p class="il">${icon('map-pin')}<span><strong>${isVi ? 'Địa chỉ' : 'Address'}:</strong> ${escHtml(company.address[locale])}</span></p>`
          : ''
      }
      ${
        phoneRaw
          ? `<p class="il">${icon('phone')}<span><strong>${isVi ? 'Điện thoại' : 'Phone'}:</strong> <a href="tel:${escHtml(phoneRaw)}">${escHtml(phoneShown)}</a></span></p>`
          : ''
      }
      ${
        zaloRaw
          ? `<p class="il">${zaloLogo({ size: 20, className: 'il-zalo' })}<span><strong>Zalo:</strong> <a href="${escHtml(zaloRaw)}" rel="noopener noreferrer">${escHtml(zaloRaw)}</a></span></p>`
          : ''
      }
    </div>
  `;

  // Điểm bản đồ chỉ lấy từ Thông tin công ty (loader đã kiểm dạng MAP_POINT; vắng/sai ⇒ null).
  const mapPoint = company.mapPoint ?? null;
  const mapQuery = mapPoint ? encodeURIComponent(mapPoint.replace(/\s+/g, '')) : '';
  const mapLinkUrl = mapQuery ? `https://maps.google.com/?q=${mapQuery}` : '';
  const hasMap = Boolean(mapPoint);
  const mapTitle = isVi ? 'Bản đồ vị trí nhà máy' : 'Plant Location Map';
  const mapLinkHtml = mapLinkUrl
    ? `<a href="${escHtml(mapLinkUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="min-height: 36px; padding: 6px 14px; font-size: 0.85rem;">${isVi ? 'Mở trên Google Maps' : 'Open in Google Maps'}<span class="sr-only"> ${isVi ? '(mở tab mới)' : '(opens in a new tab)'}</span>${icon('external-link', { size: 18 })}</a>`
    : '';
  const mapAddress = isVi
    ? 'Quốc lộ 39, Bần Yên Nhân, Mỹ Hào, Hưng Yên'
    : 'National Route 39, Ban Yen Nhan, My Hao, Hung Yen';
  const mapBlockHtml = !hasMap
    ? ''
    : !mapPoint
      ? `<section class="section-block" data-testid="map-block">
        <h2>${mapTitle}</h2>
        <p>${mapLinkHtml}</p>
      </section>`
      : `<section class="section-block" data-testid="map-block">
        <h2>${mapTitle}</h2>
        <p>${isVi ? 'Toạ độ:' : 'Coordinates:'} ${escHtml(mapPoint)} (${mapAddress})</p>
        <button type="button" class="btn btn-secondary" data-testid="map-open" id="btn-map-open">
          ${isVi ? 'Hiện bản đồ tương tác' : 'Show interactive map'}
        </button>
        <div data-testid="map-view" id="map-view-container" data-point="${escHtml(mapPoint)}" hidden style="margin-top: 14px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
          <div style="padding: 14px 16px; background: #f8faf7; border-bottom: 1px solid var(--line); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px;">
            <div>
              <p style="margin: 0; font-weight: 700; color: var(--g900); font-size: 1rem;">${isVi ? 'Nhà máy Xử lý & Tái tạo Tài nguyên GMS Hưng Yên' : 'GMS Hung Yen Waste-to-Resource Plant'}</p>
              <p style="margin: 4px 0 0; font-size: 0.875rem; color: #555;"><strong>${isVi ? 'Toạ độ:' : 'Coordinates:'}</strong> ${escHtml(mapPoint)} (${mapAddress})</p>
            </div>
            <p style="margin: 0;">${mapLinkHtml}</p>
          </div>
          <iframe id="map-iframe" title="${mapTitle}" width="100%" height="380" style="border:0; display:block;" loading="lazy" referrerpolicy="no-referrer-when-downgrade" data-src="https://maps.google.com/maps?q=${mapQuery}&hl=${locale}&z=15&output=embed"></iframe>
        </div>
      </section>`;

  const consentText = isVi
    ? `Tôi đồng ý để ${escHtml(company.legalName ?? '')} thu thập và dùng họ tên, email hoặc số điện thoại, công ty và nội dung tôi nhập với mục đích trả lời liên hệ này. Xem <a href="${ROUTES.privacy.vi}" tabindex="-1">Chính sách bảo mật</a>.`
    : `I agree that ${escHtml(company.legalName ?? '')} may collect and use the full name, email or phone number, company and message I enter in order to reply and respond to my inquiry. See the <a href="${ROUTES.privacy.en}" tabindex="-1">Privacy policy</a>.`;

  // Lỗi trường: biểu tượng trang trí + chữ lỗi (kênh chính, aria-describedby trỏ vào <p>); script chỉ đổi .fe-text.
  const fieldError = (k: string) =>
    `<p class="field-error" id="err-${k}" hidden>${icon('circle-alert', { size: 18 })}<span class="fe-text"></span></p>`;
  const formHtml = canRenderForm
    ? `<form data-testid="contact-form" id="gms-contact-form" method="post" action="/api/contact" novalidate data-locale="${locale}" data-policy-version="${escHtml(polVer)}" data-phone="${escHtml(phoneRaw)}" data-phone-shown="${escHtml(phoneShown)}" data-zalo="${escHtml(zaloRaw)}" data-sitekey="${escHtml(turnstileSiteKey)}" data-home="${ROUTES.home[locale]}">
        <div id="contact-feedback-area"></div>
        <p id="contact-status" class="sr-only" role="status"></p>
        <div class="form-group">
          <label for="contact-name">${isVi ? 'Họ và tên (bắt buộc)' : 'Full name (required)'}</label>
          <input id="contact-name" name="fullName" type="text" class="form-control" data-testid="contact-name" required maxlength="200" autocomplete="name" />
          ${fieldError('fullName')}
        </div>
        <p><small>${isVi ? 'Cần điền ít nhất email hoặc số điện thoại.' : 'Please provide at least an email or a phone number.'}</small></p>
        <div class="form-group">
          <label for="contact-email">Email</label>
          <input id="contact-email" name="email" type="email" class="form-control" data-testid="contact-email" maxlength="254" autocomplete="email" />
          ${fieldError('email')}
        </div>
        <div class="form-group">
          <label for="contact-phone">${isVi ? 'Số điện thoại' : 'Phone number'}</label>
          <input id="contact-phone" name="phone" type="tel" class="form-control" data-testid="contact-phone" maxlength="20" autocomplete="tel" />
          ${fieldError('phone')}
        </div>
        <div class="form-group">
          <label for="contact-company">${isVi ? 'Công ty / Tổ chức (không bắt buộc)' : 'Company / Organisation (optional)'}</label>
          <input id="contact-company" name="company" type="text" class="form-control" data-testid="contact-company" maxlength="200" autocomplete="organization" />
          ${fieldError('company')}
        </div>
        <div class="form-group">
          <label for="contact-message">${isVi ? 'Nội dung (bắt buộc)' : 'Message (required)'}</label>
          <textarea id="contact-message" name="message" rows="4" class="form-control" data-testid="contact-message" required maxlength="5000"></textarea>
          ${fieldError('message')}
        </div>
        <div class="hp-trap" aria-hidden="true">
          <input id="contact-trap" name="website" type="text" tabindex="-1" autocomplete="off" data-testid="contact-trap" />
        </div>
        <div class="form-group" data-testid="contact-consent-block">
          <label for="contact-consent" data-testid="contact-consent-label" style="display: flex; gap: 14px; align-items: flex-start; font-weight: 400; cursor: pointer;">
            <input id="contact-consent" name="consent" type="checkbox" data-testid="contact-consent" style="margin-top: 4px; width: 24px; height: 24px; min-width: 24px; min-height: 24px; cursor: pointer;" />
            <span>${consentText}</span>
          </label>
          ${fieldError('consent')}
        </div>
        <p id="contact-human-wait" class="notice-box" data-testid="contact-human-wait" hidden></p>
        <div id="contact-human-slot" class="human-slot" data-testid="contact-human-slot"></div>
        <button type="submit" class="btn" data-testid="contact-submit" id="contact-submit-btn">
          ${isVi ? 'Gửi liên hệ' : 'Send message'}
        </button>
      </form>
      <noscript>
        <p>${
          isVi
            ? 'Form liên hệ cần bật JavaScript. Bạn có thể liên hệ GMS qua các kênh dưới đây.'
            : 'The contact form needs JavaScript. You can reach GMS through the channels below.'
        }</p>
      </noscript>`
    : `<div class="card" data-testid="contact-form-disabled">
        <p>${
          isVi
            ? 'Form liên hệ tạm thời chưa mở. Bạn có thể liên hệ GMS qua các kênh dưới đây.'
            : 'The contact form is temporarily unavailable. You can reach GMS through the channels below.'
        }</p>
      </div>`;

  // Form đóng: không sinh mã nào nhắc tới form (HTML không chứa `contact-form`).
  const formScript = canRenderForm
    ? `
    var form = document.querySelector('[data-testid="contact-form"]');
    if (!form) return;
    ${contactFormScript(Boolean(phoneRaw), Boolean(zaloRaw))}`
    : '';

  const clientScript = `
  <script>
  (function() {
    var mapBtn = document.getElementById('btn-map-open');
    var mapView = document.getElementById('map-view-container');
    if (mapBtn && mapView) {
      mapBtn.addEventListener('click', function() {
        mapView.hidden = false;
        var ifr = document.getElementById('map-iframe');
        if (ifr && !ifr.getAttribute('src') && ifr.getAttribute('data-src')) {
          ifr.setAttribute('src', ifr.getAttribute('data-src'));
        }
      });
    }
    ${formScript}
  })();
  </script>
  `;

  return `
    <section class="section-block">
      <p class="eyebrow">${isVi ? 'Liên hệ hợp tác' : 'Partner with us'}</p>
      <h1>${isVi ? 'Liên hệ với GMS Hưng Yên' : 'Contact GMS Hung Yen'}</h1>
      ${formHtml}
      ${channelsHtml}
    </section>
    ${mapBlockHtml}
    ${clientScript}
  `;
}

function writePageDual(outDir: string, urlPath: string, html: string): void {
  const clean = urlPath.replace(/^\/|\/$/g, '');
  if (!clean) {
    writeFileSync(join(outDir, 'index.html'), html);
    return;
  }
  const htmlFile = join(outDir, `${clean}.html`);
  mkdirSync(dirname(htmlFile), { recursive: true });
  writeFileSync(htmlFile, html);

  const indexFile = join(outDir, clean, 'index.html');
  mkdirSync(dirname(indexFile), { recursive: true });
  writeFileSync(indexFile, html);
}

export async function runBuildSite(options?: {
  cwd?: string;
  contentDir?: string;
  outDir?: string;
  siteUrl?: string;
  siteEnv?: string;
  contactRecipient?: string;
  dateOverride?: string;
}): Promise<{ ok: boolean; errors: string[]; hash?: string }> {
  const cwd = options?.cwd ?? process.cwd();
  const contentDir =
    options?.contentDir ?? (process.env.CONTENT_DIR ? join(cwd, process.env.CONTENT_DIR) : join(cwd, 'content'));
  const outDir = options?.outDir ?? join(cwd, 'out');
  const siteUrl = (options?.siteUrl ?? process.env.SITE_URL ?? 'https://gms.example.test').replace(/\/$/, '');
  const siteEnv = options?.siteEnv ?? process.env.SITE_ENV ?? 'test';
  const isStaging = siteEnv === 'staging';
  const contactRecipientEnv =
    options?.contactRecipient !== undefined
      ? options.contactRecipient
      : process.env.CONTACT_RECIPIENT !== undefined
        ? process.env.CONTACT_RECIPIENT
        : 'lienhe@vi-du.test';

  const loaded = loadSiteContent(contentDir, options?.dateOverride ?? process.env.DATE_OVERRIDE);
  if (loaded.errors.length > 0) {
    const msgs = loaded.errors.map((err) => `[${err.code}] ${err.message}`);
    for (const m of msgs) {
      console.error(m);
    }
    return { ok: false, errors: msgs };
  }

  const hash = computeContentHash(contentDir);
  console.log(`content-hash: ${hash}`);

  // shortcut: LoadedCompany (loader.ts, lãnh địa backend) chưa mang Company.social; đọc lại từ company.yaml ở đây. Bỏ khi loader xuất `social`.
  const companyYamlPath = join(contentDir, 'company.yaml');
  const rawSocial = existsSync(companyYamlPath)
    ? (parseYaml(readFileSync(companyYamlPath, 'utf8')) as { social?: unknown } | null)?.social
    : undefined;
  const siteCompany = { ...loaded.company, social: parseSocial(rawSocial) };

  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  const formStatus = formStatusOf({
    mailReady: (process.env.CONTACT_MAIL_READY ?? 'false') === 'true',
    privacyRequestEmail: loaded.company.privacyRequestEmail?.trim(),
    taxId: loaded.company.taxId?.trim(),
  });
  writeFileSync(join(outDir, 'form-status.json'), `${JSON.stringify(formStatus)}\n`);

  const ogDir = join(outDir, 'og');
  mkdirSync(ogDir, { recursive: true });
  const defaultOgBytes = await sharp({
    create: { width: 1200, height: 630, channels: 3, background: { r: 15, g: 88, b: 56 } },
  })
    .png()
    .toBuffer();
  writeFileSync(join(ogDir, 'default.png'), defaultOgBytes);
  try {
    const publicOg = join(PUBLIC_DIR, 'og', 'default.png');
    mkdirSync(dirname(publicOg), { recursive: true });
    writeFileSync(publicOg, defaultOgBytes);
  } catch {}

  const brandDir = join(outDir, 'brand');
  mkdirSync(brandDir, { recursive: true });
  try {
    const pubBrand = join(PUBLIC_DIR, 'brand');
    if (existsSync(pubBrand)) {
      for (const f of readdirSync(pubBrand)) {
        writeFileSync(join(brandDir, f), readFileSync(join(pubBrand, f)));
      }
    }
  } catch {}

  try {
    for (const f of ['favicon.ico', 'favicon.png', 'icon.svg']) {
      const srcFile = join(PUBLIC_DIR, f);
      if (existsSync(srcFile)) {
        writeFileSync(join(outDir, f), readFileSync(srcFile));
      }
    }
  } catch {}

  for (const img of loaded.images.values()) {
    await processAndWriteImage(img, outDir);
  }
  copyStaticImages(join(PUBLIC_DIR, 'img'), join(outDir, 'img'), new Set(loaded.images.keys()));

  const sitemapUrls: string[] = [];
  const addSitemapUrl = (urlPath: string, noindex: boolean) => {
    if (!isStaging && !noindex) {
      sitemapUrls.push(`${siteUrl}${urlPath}`);
    }
  };

  for (const locale of ['vi', 'en'] as Locale[]) {
    for (const key of MENU_ORDER) {
      const viPath = ROUTES[key].vi;
      const enPath = ROUTES[key].en;
      const canonicalPath = locale === 'vi' ? viPath : enPath;
      const isEmptyList =
        (key === 'projects' && loaded.projects[locale].length === 0) ||
        (key === 'careers' && loaded.jobs[locale].length === 0) ||
        (key === 'faq' && loaded.faq[locale].length === 0);
      const noindex = isStaging || isEmptyList;

      let bodyHtml = '';
      switch (key) {
        case 'home':
          bodyHtml = renderHomePage(loaded, locale);
          break;
        case 'about':
          bodyHtml = renderAboutPage(loaded, locale);
          break;
        case 'solutions':
          bodyHtml = renderSolutionsPage(loaded, locale);
          break;
        case 'technology':
          bodyHtml = renderTechnologyPage(loaded, locale);
          break;
        case 'products':
          bodyHtml = renderProductsPage(loaded, locale);
          break;
        case 'news':
          bodyHtml = renderNewsListPage(loaded, locale, 1);
          break;
        case 'projects':
          bodyHtml = renderProjectsListPage(loaded, locale);
          break;
        case 'careers':
          bodyHtml = renderCareersListPage(loaded, locale);
          break;
        case 'faq':
          bodyHtml = renderFaqPage(loaded, locale);
          break;
        case 'contact':
          bodyHtml = renderContactPage(loaded, locale, contactRecipientEnv, formStatus.open);
          break;
        case 'privacy':
          bodyHtml = renderPrivacyPage(loaded, locale);
          break;
      }

      const fullHtml = renderLayout({
        locale,
        title: `${MENU_LABELS[locale][key]} — ${locale === 'vi' ? 'GMS Hưng Yên' : 'GMS Hung Yen'}`,
        description: PAGE_DESCRIPTIONS[locale][key],
        canonicalPath,
        viPath,
        enPath,
        noindex,
        siteUrl,
        company: siteCompany,
        activePageKey: key,
        bodyHtml,
      });

      writePageDual(outDir, canonicalPath, fullHtml);
      addSitemapUrl(canonicalPath, noindex);
    }

    const totalNews = loaded.news[locale].length;
    const totalNewsPages = Math.ceil(totalNews / PAGE_SIZE);
    for (let p = 2; p <= totalNewsPages; p++) {
      const viPath = `${ROUTES.news.vi}/trang/${p}`;
      const enPath = `${ROUTES.news.en}/page/${p}`;
      const canonicalPath = locale === 'vi' ? viPath : enPath;
      const bodyHtml = renderNewsListPage(loaded, locale, p);
      const fullHtml = renderLayout({
        locale,
        title: `${MENU_LABELS[locale].news} (${p}) — ${locale === 'vi' ? 'GMS Hưng Yên' : 'GMS Hung Yen'}`,
        description: PAGE_DESCRIPTIONS[locale].news,
        canonicalPath,
        viPath,
        enPath,
        noindex: isStaging,
        siteUrl,
        company: siteCompany,
        activePageKey: 'news',
        bodyHtml,
      });
      writePageDual(outDir, canonicalPath, fullHtml);
    }

    for (const n of loaded.news[locale]) {
      const viSlug = locale === 'vi' ? n.slug : (n.counterpartSlug ?? n.slug);
      const enSlug = locale === 'en' ? n.slug : (n.counterpartSlug ?? n.slug);
      const viPath = `${ROUTES.news.vi}/${viSlug}`;
      const enPath = `${ROUTES.news.en}/${enSlug}`;
      const canonicalPath = locale === 'vi' ? viPath : enPath;

      let heroHtml = '';
      let ogImageRel = 'og/default.png';
      if (n.heroImage) {
        const imgObj = loaded.images.get(n.heroImage);
        if (imgObj && imgObj.allowedInBuild) {
          const publicImg = `img/${n.heroImage.replace(/^images\//, '')}`;
          if (imgObj.allowedForOg) {
            ogImageRel = publicImg;
          }
          const caption =
            imgObj.kind === 'anh-dung-ai'
              ? `<figcaption class="photo-label" data-testid="photo-label">${locale === 'vi' ? 'Phối cảnh dự kiến' : "Artist's impression"}</figcaption>`
              : '';
          heroHtml = `<figure style="position:relative; margin:0 0 16px;"><img src="/${publicImg}" alt="${escHtml(imgObj.alt[locale])}" width="1200" height="675" />${caption}</figure>`;
        }
      }

      const bodyHtml = `
        <article class="section-block">
          <h1>${escHtml(n.title)}</h1>
          <p><small>${escHtml(formatDateLocale(n.date, locale))}</small></p>
          ${heroHtml}
          <div>${n.bodyHtml}</div>
        </article>
      `;

      const fullHtml = renderLayout({
        locale,
        title: `${n.title} — ${locale === 'vi' ? 'GMS Hưng Yên' : 'GMS Hung Yen'}`,
        description: n.summary || PAGE_DESCRIPTIONS[locale].news,
        canonicalPath,
        viPath,
        enPath,
        noindex: isStaging,
        ogImageRel,
        siteUrl,
        company: siteCompany,
        activePageKey: 'news',
        bodyHtml,
      });
      writePageDual(outDir, canonicalPath, fullHtml);
      addSitemapUrl(canonicalPath, isStaging);
    }

    for (const p of loaded.projects[locale]) {
      const viSlug = locale === 'vi' ? p.slug : (p.counterpartSlug ?? p.slug);
      const enSlug = locale === 'en' ? p.slug : (p.counterpartSlug ?? p.slug);
      const viPath = `${ROUTES.projects.vi}/${viSlug}`;
      const enPath = `${ROUTES.projects.en}/${enSlug}`;
      const canonicalPath = locale === 'vi' ? viPath : enPath;

      const bodyHtml = `
        <article class="section-block">
          <h1>${escHtml(p.title)}</h1>
          <p><small>${escHtml(formatDateLocale(p.date, locale))} · ${escHtml(p.category)}</small></p>
          <div>${p.bodyHtml}</div>
        </article>
      `;

      const fullHtml = renderLayout({
        locale,
        title: `${p.title} — ${locale === 'vi' ? 'GMS Hưng Yên' : 'GMS Hung Yen'}`,
        description: p.summary || PAGE_DESCRIPTIONS[locale].projects,
        canonicalPath,
        viPath,
        enPath,
        noindex: isStaging,
        siteUrl,
        company: siteCompany,
        activePageKey: 'projects',
        bodyHtml,
      });
      writePageDual(outDir, canonicalPath, fullHtml);
      addSitemapUrl(canonicalPath, isStaging);
    }

    for (const j of loaded.jobs[locale]) {
      const viSlug = locale === 'vi' ? j.slug : (j.counterpartSlug ?? j.slug);
      const enSlug = locale === 'en' ? j.slug : (j.counterpartSlug ?? j.slug);
      const viPath = `${ROUTES.careers.vi}/${viSlug}`;
      const enPath = `${ROUTES.careers.en}/${enSlug}`;
      const canonicalPath = locale === 'vi' ? viPath : enPath;
      const deadlineLabel =
        locale === 'vi'
          ? `Hạn nộp: ${formatDateLocale(j.validThrough, 'vi')}`
          : `Deadline: ${formatDateLocale(j.validThrough, 'en')}`;

      const bodyHtml = `
        <article class="section-block">
          <h1>${escHtml(j.title)}</h1>
          <p class="il">${icon('circle-alert')}<strong>${escHtml(deadlineLabel)}</strong></p>
          <div>${j.bodyHtml}</div>
        </article>
      `;

      const fullHtml = renderLayout({
        locale,
        title: `${j.title} — ${locale === 'vi' ? 'GMS Hưng Yên' : 'GMS Hung Yen'}`,
        description: PAGE_DESCRIPTIONS[locale].careers,
        canonicalPath,
        viPath,
        enPath,
        noindex: isStaging,
        siteUrl,
        company: siteCompany,
        activePageKey: 'careers',
        bodyHtml,
      });
      writePageDual(outDir, canonicalPath, fullHtml);
      addSitemapUrl(canonicalPath, isStaging);
    }
  }

  for (const locale of ['vi', 'en'] as Locale[]) {
    const isVi = locale === 'vi';
    const html404 = renderLayout({
      locale,
      title: isVi ? 'Không tìm thấy trang — GMS Hưng Yên' : 'Page not found — GMS Hung Yen',
      description: isVi
        ? 'Không tìm thấy trang này. Trang có thể đã được gỡ hoặc đường dẫn chưa đúng.'
        : "We couldn't find this page. It may have been removed or the link may be wrong.",
      canonicalPath: isVi ? '/404' : '/en/404',
      viPath: '/404',
      enPath: '/en/404',
      noindex: true,
      siteUrl,
      company: siteCompany,
      bodyHtml: `<section class="section-block">
        <h1>${isVi ? 'Không tìm thấy trang (404)' : 'Page not found (404)'}</h1>
        <p>${
          isVi
            ? 'Không tìm thấy trang này. Trang có thể đã được gỡ hoặc đường dẫn chưa đúng.'
            : "We couldn't find this page. It may have been removed or the link may be wrong."
        }</p>
        <p><a href="${ROUTES.home[locale]}" class="btn">${isVi ? 'Về trang chủ' : 'Back to home'}</a></p>
      </section>`,
    });
    if (isVi) {
      writeFileSync(join(outDir, '404.html'), html404);
    } else {
      mkdirSync(join(outDir, 'en'), { recursive: true });
      writeFileSync(join(outDir, 'en', '404.html'), html404);
    }
  }

  const uniqueUrls = [...new Set(sitemapUrls)];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueUrls.map((u) => `  <url><loc>${escHtml(u)}</loc></url>`).join('\n')}
</urlset>
`;
  writeFileSync(join(outDir, 'sitemap.xml'), sitemapXml);

  const robotsTxt = isStaging
    ? `User-agent: *\nDisallow: /\n`
    : `User-agent: *\nDisallow: /api/\nSitemap: ${siteUrl}/sitemap.xml\n`;
  writeFileSync(join(outDir, 'robots.txt'), robotsTxt);

  const headersContent = isStaging
    ? `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Robots-Tag: noindex\n`
    : `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/api/*\n  X-Robots-Tag: noindex\n  # /api/*\n`;
  writeFileSync(join(outDir, '_headers'), headersContent);

  const brokenImgs = findBrokenImgRefs(outDir).map((b) => `[IMG_NOT_IN_OUT] ${b}`);
  if (brokenImgs.length > 0) {
    for (const m of brokenImgs) console.error(m);
    return { ok: false, errors: brokenImgs };
  }

  // Quét đầu ra theo content/denylist.yaml (build.ts §8 luật 6): có tên cấm ⇒ build đỏ.
  const denylist = loadDenylist(contentDir);
  if ('error' in denylist) {
    const m = `[${denylist.error.code}] ${denylist.error.message}`;
    console.error(m);
    return { ok: false, errors: [m] };
  }
  const nameErrs = scanOutputForForbiddenNames(outDir, denylist.names);
  if (nameErrs.length > 0) {
    const msgs = nameErrs.map((e) => `[${e.code}] ${e.message}`);
    for (const m of msgs) console.error(m);
    return { ok: false, errors: msgs };
  }

  return { ok: true, errors: [], hash };
}

if (import.meta.main) {
  runBuildSite().then((res) => {
    if (!res.ok) process.exit(1);
  });
}
