// BẢNG ĐƯỜNG DẪN — MỘT NƠI DUY NHẤT. Nguồn: 02-design/contracts/routes.ts (architect, lượt 5). Đổi slug = sửa ở đây.
export type Locale = 'vi' | 'en';
export type PageKey =
  | 'home' | 'about' | 'solutions' | 'technology' | 'products' | 'news' | 'projects' | 'careers' | 'faq' | 'contact' | 'privacy';

const TABLE: Record<PageKey, Record<Locale, string>> = {
  home: { vi: '/', en: '/en' },
  about: { vi: '/gioi-thieu', en: '/en/about' },
  solutions: { vi: '/giai-phap', en: '/en/solutions' },
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
export const newsPage = (n: number, locale: Locale = 'vi') => `${TABLE.news[locale]}/${locale === 'vi' ? 'trang' : 'page'}/${n}`;
export const PAGE_SIZE = 12;

export const API_CONTACT = '/api/contact';
export const API_CONTACT_HEALTH = '/api/contact/health';

// Nhãn trang tiếng Việt (thư báo ghi "trang nơi gửi" bằng tên trang).
export const PAGE_LABEL_VI: Record<PageKey, string> = {
  home: 'Trang chủ', about: 'Giới thiệu', solutions: 'Giải pháp', technology: 'Công nghệ', products: 'Sản phẩm đầu ra',
  news: 'Tin tức', projects: 'Dự án / Thư viện', careers: 'Tuyển dụng', faq: 'FAQ', contact: 'Liên hệ', privacy: 'Chính sách bảo mật',
};
