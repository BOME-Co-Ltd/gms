// Bảng route song ngữ + mã trả về + chiến lược render. Nguồn: seo-requirements.md (slug, canonical,
// hreflang, 404/410, noindex trang rỗng), layout-and-language.feature, news-and-journey.feature. Slug cố định
// theo V-SEO gợi ý; đổi slug trang cố định = đổi file này (D7) + 301 trong next.config.ts redirects() (devops,
// design.md §6e). redirect-map.md chỉ dành cho URL web cũ (nếu có).
import { z } from "zod";
import type { Locale } from "./api";

export const RenderMode = z.enum(["static"]); // lượt 5: bỏ isr-tag, dynamic-noindex (không máy chủ ứng dụng). // isr-tag: tĩnh, làm mới theo tag khi CMS đổi + revalidate 60
export const PageKey = z.enum([
  "home", "about", "solutions", "technology", "products", "news", "newsPage", "newsDetail",
  "projects", "projectDetail", "careers", "careerDetail", "faq", "contact", "privacy",
]);
export type PageKey = z.infer<typeof PageKey>;

type Route = { vi: string; en: string; render: z.infer<typeof RenderMode>; tags: string[] };

// vi không tiền tố; en tiền tố /en. ":slug" = trường slug theo locale trong CMS; ":n" = số trang ≥ 2.
export const ROUTES: Record<PageKey, Route> = {
  home: { vi: "/", en: "/en", render: "static", tags: ["news", "figures", "company", "page:home"] },
  about: { vi: "/gioi-thieu", en: "/en/about", render: "static", tags: ["page:about", "partners", "company"] },
  solutions: { vi: "/giai-phap", en: "/en/solutions", render: "static", tags: ["page:solutions"] },
  technology: { vi: "/cong-nghe", en: "/en/technology", render: "static", tags: ["page:technology", "figures"] },
  products: { vi: "/san-pham-dau-ra", en: "/en/products", render: "static", tags: ["page:products", "outputLines"] },
  news: { vi: "/tin-tuc", en: "/en/news", render: "static", tags: ["news"] },
  newsPage: { vi: "/tin-tuc/trang/:n", en: "/en/news/page/:n", render: "static", tags: ["news"] },
  newsDetail: { vi: "/tin-tuc/:slug", en: "/en/news/:slug", render: "static", tags: ["news"] },
  projects: { vi: "/du-an-thu-vien", en: "/en/projects-library", render: "static", tags: ["projects"] },
  projectDetail: { vi: "/du-an-thu-vien/:slug", en: "/en/projects-library/:slug", render: "static", tags: ["projects"] },
  careers: { vi: "/tuyen-dung", en: "/en/careers", render: "static", tags: ["jobs"] },
  careerDetail: { vi: "/tuyen-dung/:slug", en: "/en/careers/:slug", render: "static", tags: ["jobs"] },
  faq: { vi: "/faq", en: "/en/faq", render: "static", tags: ["faq"] },
  contact: { vi: "/lien-he", en: "/en/contact", render: "static", tags: ["company", "policy"] },
  privacy: { vi: "/chinh-sach-bao-mat", en: "/en/privacy-policy", render: "static", tags: ["policy", "company"] },
};

// Trang danh sách có thể rỗng ⇒ 200 + noindex + ngoài sitemap (seo-requirements).
export const EMPTY_LIST_NOINDEX: PageKey[] = ["projects", "careers", "faq"];

// Phân trang Tin là ĐOẠN ĐƯỜNG DẪN, không query: đọc searchParams làm route thành động (mất ISR).
// Trang 1 chỉ ở ROUTES.news (/tin-tuc/trang/1 ⇒ 404, tránh trùng nội dung). n ≥ 2: canonical tự trỏ,
// không vào sitemap; n ngoài khoảng hoặc không phải số nguyên ⇒ 404. Slug Tin cấm trùng đoạn phân trang.
export const PAGINATION_SEGMENT: Record<Locale, string> = { vi: "trang", en: "page" };
export const RESERVED_NEWS_SLUGS: Record<Locale, string[]> = { vi: ["trang"], en: ["page"] };
export const PAGE_SIZE = 12;

// Mã trả về cho URL chi tiết theo trạng thái tài liệu. Mọi trạng thái không còn xuất bản ⇒ 404 (không 410):
// App Router không trả được 410 từ trang khi không dùng middleware/proxy.ts (design.md §6e, [chưa kiểm]);
// seo-requirements §3.4 cho phép phương án lùi này; .feature chấp nhận "404 hoặc 410".
export const DetailStatus = z.enum(["published", "unpublished_after_publish", "expired_job", "never_published"]);
export const DETAIL_HTTP: Record<z.infer<typeof DetailStatus>, 200 | 404> = {
  published: 200,
  unpublished_after_publish: 404,
  expired_job: 404, // validThrough ≤ now (Asia/Ho_Chi_Minh), không cần thao tác CMS; job jobExpiry làm mới tag "jobs"
  never_published: 404,
};

// Lượt 5: mọi route là "static" (output:"export"; tags giữ để biết trang phụ thuộc nội dung nào, không còn ISR).
// Trang hệ thống ngoài bảng: /sitemap.xml, /robots.txt (sinh lúc build), /404.html, /og/<key>.png (sinh lúc build).
// Đường duy nhất qua Worker: /api/* (api.ts CONTACT_ENDPOINT, CONTACT_HEALTH_ENDPOINT) — X-Robots-Tag noindex.
// Bỏ /admin, /xac-minh-dang-nhap, /lang, /api/jobs/run. Đổi ngôn ngữ = liên kết tĩnh tới bản kia của chính trang.
export const SYSTEM_NOINDEX_PATHS = ["/api/"] as const;
export const OG_IMAGE = { width: 1200, height: 630, maxBytes: 300 * 1024, types: ["image/png", "image/jpeg"] } as const;
