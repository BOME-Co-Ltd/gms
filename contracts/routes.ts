// Bảng route song ngữ + mã trả về. Site tĩnh: Next `output: "export"` ⇒ HTML trong out/, phục vụ bởi Cloudflare
// Static Assets; chỉ /api/* qua Worker (design.md §1). Nguồn: seo-requirements.md (slug, canonical, hreflang, 404,
// noindex trang rỗng), layout-and-language.feature, news-and-journey.feature. Slug cố định theo V-SEO gợi ý; đổi slug
// trang cố định = đổi file này (D7) + 301 trong public/_redirects (devops, build.ts §6 REDIRECT_LINE).
// redirect-map.md chỉ dành cho URL web cũ (nếu có). Không middleware, không route handler, không redirect phía server Next.
// Trang đã gỡ khỏi bảng (CO-01, 10/11/2026: Giải pháp gộp vào Công nghệ) ⇒ RETIRED_PAGE_REDIRECTS cuối tệp.
import { z } from "zod";
import type { Locale } from "./api";

// Một chế độ duy nhất: HTML sinh lúc build. Nội dung đổi = commit + build + deploy; build hằng ngày lúc 00:05 giờ VN
// qua Deploy Hook (design.md §5b XQ-4). Chế độ làm mới theo tag/định kỳ của bản CMS đã bỏ (raw 31/10).
export const RenderMode = z.enum(["static"]);
export const PageKey = z.enum([
  "home", "about", "technology", "products", "news", "newsPage", "newsDetail",
  "projects", "projectDetail", "careers", "careerDetail", "faq", "contact", "privacy",
]);
export type PageKey = z.infer<typeof PageKey>;

type Route = { vi: string; en: string; render: z.infer<typeof RenderMode>; tags: string[] };

// vi không tiền tố; en tiền tố /en. ":slug" = trường `slug` trong frontmatter content/** (content-model.ts) theo
// locale; ":n" = số trang ≥ 2 (mỗi trang sinh sẵn một tệp HTML). `tags`: nội dung trang phụ thuộc (để loader biết
// trang nào cần build lại khi kiểm), không phải cơ chế làm mới.
export const ROUTES: Record<PageKey, Route> = {
  home: { vi: "/", en: "/en", render: "static", tags: ["news", "figures", "company", "page:home", "images"] }, // lượt 14 (V41 b): ô ảnh HOME_IMAGE_SLOTS
  about: { vi: "/gioi-thieu", en: "/en/about", render: "static", tags: ["page:about", "company"] },
  // CO-01 (10/11/2026): mục Giải pháp là một khối của trang Công nghệ (neo ở RETIRED_PAGE_REDIRECTS), không URL riêng.
  technology: { vi: "/cong-nghe", en: "/en/technology", render: "static", tags: ["page:technology", "figures", "images", "comparisonTables"] }, // lượt 13 (V38/V39): ô ảnh TECHNOLOGY_IMAGE_SLOTS
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

// Phân trang Tin là ĐOẠN ĐƯỜNG DẪN, không query: site tĩnh không đọc được query lúc phục vụ, mỗi trang là một tệp.
// Trang 1 chỉ ở ROUTES.news (/tin-tuc/trang/1 ⇒ 404, tránh trùng nội dung). n ≥ 2: canonical tự trỏ,
// không vào sitemap; n ngoài khoảng hoặc không phải số nguyên ⇒ 404. Slug Tin cấm trùng đoạn phân trang.
export const PAGINATION_SEGMENT: Record<Locale, string> = { vi: "trang", en: "page" };
export const RESERVED_NEWS_SLUGS: Record<Locale, string[]> = { vi: ["trang"], en: ["page"] };
export const PAGE_SIZE = 12;

// Mã trả về cho URL chi tiết theo trạng thái nội dung. Mọi trạng thái không còn đăng ⇒ 404 (không 410): mục đó
// không được sinh tệp HTML, Static Assets trả out/404.html kèm mã 404 (`not_found_handling: "404-page"`). Static
// Assets không trả được 410 cho đường không có tệp (design.md §1); seo-requirements §3.4 cho phép; .feature chấp
// nhận "404 hoặc 410".
export const DetailStatus = z.enum(["published", "unpublished_after_publish", "expired_job", "never_published"]);
export const DETAIL_HTTP: Record<z.infer<typeof DetailStatus>, 200 | 404> = {
  published: 200,
  unpublished_after_publish: 404, // `published: false` trong frontmatter ⇒ không sinh trang
  expired_job: 404, // validThrough < ngày build (Asia/Ho_Chi_Minh, build.ts BuildDate) ⇒ không sinh trang; build hằng ngày gỡ
  never_published: 404,
};

// Trang hệ thống ngoài bảng: /sitemap.xml, /robots.txt (sinh lúc build), /404.html, /og/<key>.png (sinh lúc build).
// Đường duy nhất qua Worker: /api/* (api.ts CONTACT_ENDPOINT, CONTACT_HEALTH_ENDPOINT) — X-Robots-Tag noindex.
// Bỏ /admin, /xac-minh-dang-nhap, /lang, /api/jobs/run. Đổi ngôn ngữ = liên kết tĩnh tới bản kia của chính trang.
export const SYSTEM_NOINDEX_PATHS = ["/api/"] as const;
export const OG_IMAGE = { width: 1200, height: 630, maxBytes: 300 * 1024, types: ["image/png", "image/jpeg"] } as const;

// ---- Trang đã gỡ: 301 một bước (CO-01, 10/11/2026) ----
// Nguồn: seo-requirements.md §2 "301 trang Giải pháp đã gộp" + K17; seo-technical.feature v0.8.1 :51, :54–103.
// Cơ chế (design.md §6e "301 trang đã gỡ"): 4 dòng TĨNH trong public/_redirects (devops), mỗi dòng đúng bằng
// retiredRedirectLine(r): không splat, không placeholder, đích tương đối, đích KHÔNG có query. Static Assets dựng
// Location = pathname đích + (query của đích, nếu không có thì query của request) + "#neo" của đích ⇒ UTM giữ nguyên
// và đứng trước "#"; đích cùng origin ⇒ Location chỉ là đường dẫn, host không lấy từ query (ca open-redirect).
// Đích có query thì query đó THAY HẲN query của request ⇒ mất UTM — vì vậy cấm. Luật so khớp đúng từng ký tự, phân biệt
// "/" cuối ⇒ cần đủ 4 dòng; _redirects chạy trước html_handling "drop-trailing-slash" ⇒ "/giai-phap/" đi thẳng 301,
// không qua 307 về "/giai-phap" (không thành 2 bước).
export const RetiredRedirect = z.object({
  from: z.string().regex(/^\/(?!\/)[a-z0-9/-]+$/),
  locale: z.enum(["vi", "en"]),
  toPage: PageKey,
  anchor: z.string().regex(/^[a-z][a-z0-9-]*$/),
  status: z.literal(301),
});
export type RetiredRedirect = z.infer<typeof RetiredRedirect>;
export const RETIRED_PAGE_REDIRECTS: readonly RetiredRedirect[] = [
  { from: "/giai-phap", locale: "vi", toPage: "technology", anchor: "giai-phap", status: 301 },
  { from: "/giai-phap/", locale: "vi", toPage: "technology", anchor: "giai-phap", status: 301 },
  { from: "/en/solutions", locale: "en", toPage: "technology", anchor: "solutions", status: 301 },
  { from: "/en/solutions/", locale: "en", toPage: "technology", anchor: "solutions", status: 301 },
];
// Dòng phải có NGUYÊN VĂN trong out/_redirects (bản sao public/_redirects; khớp build.ts REDIRECT_LINE),
// ví dụ "/giai-phap /cong-nghe#giai-phap 301". Liên kết nội bộ tới mục này dùng thẳng `${ROUTES.technology[l]}#<neo>`.
export function retiredRedirectLine(r: RetiredRedirect): string {
  return `${r.from} ${ROUTES[r.toPage][r.locale]}#${r.anchor} ${r.status}`;
}

// Đường cũ trong bản build: khớp "/giai-phap" hoặc "/en/solutions" khi ký tự sau KHÔNG thuộc [a-z0-9_.~-] (bắt cả
// "/giai-phap/", "/giai-phap?…", "/giai-phap#…", "…/giai-phap\"", URL tuyệt đối; không bắt "/giai-phap-moi",
// "giai-phap.jpg", "#giai-phap"). Đánh đổi: đoạn đường "giai-phap" ở bất kỳ đâu ("/tin-tuc/giai-phap") cũng khớp ⇒ cấm
// làm slug (RETIRED_RESERVED_SEGMENTS) để không đỏ oan. "/en/news/solutions" không chứa "/en/solutions" ⇒ en không cấm.
export const RETIRED_PATH_PATTERN = /\/(?:giai-phap|en\/solutions)(?![a-z0-9_.~-])/;
export const RETIRED_RESERVED_SEGMENTS: Record<Locale, string[]> = { vi: ["giai-phap"], en: [] };

// Kiểm lúc build (backend, src/content/rules/ — content-check + output-check sau next build, design.md §6f).
// Đỏ ở mọi SITE_ENV; mỗi mã = 1 ca @kiem-luc-build của qa. Dòng lỗi stderr theo build.ts §8.
export const RETIRED_PAGE_ERROR = {
  // out/_redirects thiếu một dòng retiredRedirectLine(r), hoặc có dòng khác cùng nguồn `from` (luật trên cùng thắng).
  redirectMissing: "RETIRED_REDIRECT_MISSING",
  // HTML đích (tệp sinh cho ROUTES[toPage][locale]) không có đúng MỘT phần tử id="<anchor>", hoặc <html lang> ≠ locale.
  // Lượt 20b (ux-spec v0.6 XQ-5/V43): khối Giải pháp rỗng thì giao diện ẩn cả khối + neo + chip (ux_ui giữ) ⇒ build
  // ĐỎ mã này. Khối Giải pháp vì vậy luôn có ≥ 1 mục ở mọi bản build xanh (kể cả bộ nội dung mẫu của qa); "ẩn" chỉ là
  // đường phòng hờ của giao diện, không bao giờ lên production. Không giữ phần tử neo rỗng.
  anchorMissing: "RETIRED_ANCHOR_MISSING",
  // RETIRED_PATH_PATTERN khớp nội dung hoặc đường dẫn tệp dưới out/ (trừ out/_redirects; gồm sitemap.xml, canonical,
  // hreflang, og:url, liên kết, chunk JS), hoặc có tệp phục vụ được đường cũ (out/giai-phap.html, out/giai-phap/index.html,
  // out/en/solutions.html, out/en/solutions/index.html).
  pathInOutput: "RETIRED_PATH_IN_OUTPUT",
  // slug Tin / Dự án-Thư viện / Tuyển dụng bằng một phần tử RETIRED_RESERVED_SEGMENTS[locale].
  slugReserved: "RETIRED_SLUG_RESERVED",
} as const;
