// BẢNG ĐƯỜNG DẪN — MỘT NƠI DUY NHẤT. Nguồn: 02-design/contracts/routes.ts (architect, lượt 5; CO-01 10/11/2026: 10 trang). Đổi slug = sửa ở đây.
export type Locale = 'vi' | 'en';
export type PageKey =
  | 'home'
  | 'about'
  | 'technology'
  | 'products'
  | 'news'
  | 'projects'
  | 'careers'
  | 'faq'
  | 'contact'
  | 'privacy';

const TABLE: Record<PageKey, Record<Locale, string>> = {
  home: { vi: '/', en: '/en' },
  about: { vi: '/gioi-thieu', en: '/en/about' },
  technology: { vi: '/cong-nghe', en: '/en/technology' },
  products: { vi: '/san-pham-dau-ra', en: '/en/products' },
  news: { vi: '/tin-tuc', en: '/en/news' },
  projects: { vi: '/du-an-thu-vien', en: '/en/projects-library' },
  careers: { vi: '/tuyen-dung', en: '/en/careers' },
  faq: { vi: '/faq', en: '/en/faq' },
  contact: { vi: '/lien-he', en: '/en/contact' },
  privacy: { vi: '/chinh-sach-bao-mat', en: '/en/privacy-policy' },
};

export const PAGE_KEYS = Object.keys(TABLE) as PageKey[];
export const path = (key: PageKey, locale: Locale = 'vi') => TABLE[key][locale];
export const detailPath = (key: 'news' | 'projects' | 'careers', slug: string, locale: Locale = 'vi') =>
  `${TABLE[key][locale].replace(/\/$/, '')}/${slug}`;
// Phân trang Tin là ĐOẠN ĐƯỜNG DẪN (không query); trang 1 chỉ ở /tin-tuc.
export const newsPage = (n: number, locale: Locale = 'vi') =>
  `${TABLE.news[locale]}/${locale === 'vi' ? 'trang' : 'page'}/${n}`;
export const PAGE_SIZE = 12;

export const API_CONTACT = '/api/contact';
export const API_CONTACT_HEALTH = '/api/contact/health';

// Nhãn trang tiếng Việt (thư báo ghi "trang nơi gửi" bằng tên trang).
export const PAGE_LABEL_VI: Record<PageKey, string> = {
  home: 'Trang chủ',
  about: 'Giới thiệu',
  technology: 'Công nghệ',
  products: 'Sản phẩm đầu ra',
  news: 'Tin tức',
  projects: 'Dự án / Thư viện',
  careers: 'Tuyển dụng',
  faq: 'FAQ',
  contact: 'Liên hệ',
  privacy: 'Chính sách bảo mật',
};

// ---- Trang đã gỡ (CO-01, 10/11/2026): trang Giải pháp gộp vào Công nghệ. Nguồn: contracts/routes.ts RETIRED_PAGE_REDIRECTS
// và seo-technical.feature v0.8.1. Viết THẲNG từ .feature (không import từ src) để test không tự chấm bài.
export type RetiredRedirect = { from: string; to: string; toPath: string; anchor: string; locale: Locale };
export const RETIRED_REDIRECTS: readonly RetiredRedirect[] = [
  { from: '/giai-phap', to: '/cong-nghe#giai-phap', toPath: '/cong-nghe', anchor: 'giai-phap', locale: 'vi' },
  { from: '/giai-phap/', to: '/cong-nghe#giai-phap', toPath: '/cong-nghe', anchor: 'giai-phap', locale: 'vi' },
  {
    from: '/en/solutions',
    to: '/en/technology#solutions',
    toPath: '/en/technology',
    anchor: 'solutions',
    locale: 'en',
  },
  {
    from: '/en/solutions/',
    to: '/en/technology#solutions',
    toPath: '/en/technology',
    anchor: 'solutions',
    locale: 'en',
  },
];
// Khớp "/giai-phap" hoặc "/en/solutions" khi ký tự sau KHÔNG thuộc [a-z0-9_.~-] (không bắt "/giai-phap-moi", "#giai-phap").
export const RETIRED_PATH_RE = /\/(?:giai-phap|en\/solutions)(?![a-z0-9_.~-])/;
// Mã lỗi build (contracts/routes.ts RETIRED_PAGE_ERROR).
export const RETIRED_ERR = {
  redirectMissing: 'RETIRED_REDIRECT_MISSING',
  anchorMissing: 'RETIRED_ANCHOR_MISSING',
  pathInOutput: 'RETIRED_PATH_IN_OUTPUT',
  slugReserved: 'RETIRED_SLUG_RESERVED',
} as const;
// Khối Giải pháp trên trang Công nghệ: neo theo locale.
export const SOLUTIONS_ANCHOR: Record<Locale, string> = { vi: 'giai-phap', en: 'solutions' };
// Nhãn menu ngắn (prd v0.8.1; chỉ bản vi do admin chốt) → trang đích + H1/tên trang lấy từ tiêu đề trang, không từ nhãn.
export const SHORT_MENU_LABELS_VI = [
  { label: 'Ứng dụng', where: 'top', page: 'products' as PageKey, h1: 'Sản phẩm đầu ra' },
  { label: 'Dự án', where: 'main', page: 'projects' as PageKey, h1: 'Dự án / Thư viện' },
  { label: 'Tin tức', where: 'main', page: 'news' as PageKey, h1: 'Tin tức / Hành trình' },
] as const;
// Menu chính 5 mục (layout-and-language.feature) và thanh trên cùng 5 mục (ux-spec V43/XQ-2); chân trang 9 mục.
export const MAIN_MENU: PageKey[] = ['home', 'about', 'technology', 'projects', 'news'];
export const TOP_MENU: PageKey[] = ['products', 'careers', 'faq', 'privacy', 'contact'];
export const FOOTER_MENU: PageKey[] = [
  'about',
  'technology',
  'products',
  'projects',
  'news',
  'careers',
  'faq',
  'privacy',
  'contact',
];
