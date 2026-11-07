// Danh sách trang tĩnh, nhãn menu, mô tả meta (prd.md §4 S1: 11 trang). Dùng chung khung trang, metadata và kiểm đầu ra.
import type { Locale } from '../../content/loader.ts';

export const MENU_ORDER = [
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

export type StaticPageKey = (typeof MENU_ORDER)[number];

export const MENU_LABELS: Record<Locale, Record<StaticPageKey, string>> = {
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

// ux-spec V26: menu chính 7 mục; menu phụ 4 mục (thứ tự theo wireframe: Tuyển dụng · FAQ · Chính sách bảo mật · Liên hệ).
export const MAIN_KEYS: StaticPageKey[] = ['home', 'about', 'solutions', 'technology', 'products', 'news', 'projects'];
export const SUB_KEYS: StaticPageKey[] = ['careers', 'faq', 'privacy', 'contact'];

// ux-spec §14a: hai nhóm liên kết chân trang. Trang chủ đã có ở logo đầu trang nên không lặp.
export const FOOTER_KEYS: StaticPageKey[] = [
  'about',
  'solutions',
  'technology',
  'products',
  'news',
  'projects',
  'careers',
  'faq',
  'privacy',
  'contact',
];

export const PAGE_DESCRIPTIONS: Record<Locale, Record<StaticPageKey, string>> = {
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

export function formatDateLocale(isoDate: string, locale: Locale): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  const [, yyyy, mm, dd] = m;
  if (locale === 'vi') return `${dd}/${mm}/${yyyy}`;
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
