// Mô hình nội dung dạng file trong repo (lượt 5 — bỏ CMS, raw 31/10). Đọc kèm content-model.md.
// Mỗi mục = content/<loại>/<slug>.<vi|en>.md (frontmatter YAML + thân Markdown) hoặc content/<tệp>.yaml.
// Loader `src/content/**` (backend) parse bằng các schema này; sai ⇒ build đỏ.
// Máy validate: `bun x tsc --noEmit` (design.md "Đã kiểm").
import { z } from "zod";
import { SafeHref } from "./safe-url";
import type { Locale } from "./api";

const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/); // ngày theo Asia/Ho_Chi_Minh
const ImageRef = z.string().regex(/^images\/[a-z0-9-]+\.(jpe?g|png|webp)$/); // tương đối content/

export const IMAGE_LIMITS = { maxBytes: 5 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] } as const; // G5 (ảnh qua kiểm lúc build). 5 MB: đề xuất của architect lượt 6, G5 không ghi số

// Lượt 13 (06/11, ux-spec §12 V38/V39 — admin chốt, thay V30): web không nêu tên công ty nào khác GMS ở bất cứ chữ
// nào; trang Công nghệ chỉ dùng tư liệu của GMS. Thực thể nguồn tư liệu bên ngoài (lượt 10 `Partner`, lượt 12 đổi tên)
// đã BỎ HẲN: không kiểu, không tệp nội dung, không khoá ảnh, không trường bảng so sánh, không mã lỗi (design.md §6f).

// Ảnh: content/images/<tên>.<đuôi> + content/images/<tên>.yaml
export const ImageMeta = z.object({
  alt: z.object({ vi: z.string().min(1), en: z.string().min(1) }),
  // anh-that = ảnh chụp thật ⇒ không nhãn. anh-dung-ai = MỌI ảnh không phải ảnh chụp thật (ảnh AI, ảnh dựng/render,
  // phối cảnh, bản vẽ kỹ thuật) ⇒ nhãn C29 "Phối cảnh dự kiến" / "Artist's impression" (S17, ux-spec V24, V39).
  // Tên giá trị giữ từ lượt 5 (đổi tên là di trú nội dung + ca qa, không thêm nghĩa); user-guide ghi nghĩa trên.
  kind: z.enum(["anh-that", "anh-dung-ai"]),
  hasPeople: z.boolean(),
  consentDate: IsoDate.optional(),             // hasPeople && !consentDate ⇒ build đỏ nếu ảnh được dùng
  source: z.string().min(1),                   // nội bộ, không hiện trên trang (V38: ghi chú nguồn không lên web)
  // Khoá cũ ⇒ build đỏ nhờ `.strict()`, không lặng lẽ bỏ qua: `partnerAsset`/`techSourceAsset` (lượt 10/12, bỏ lượt 13)
  // và `keepTitleBlock` (lượt 10, BỎ lượt 14 theo ux-spec V41 (e), prd v0.7 §3b, appsec M40 (4)(5)). Không còn đường
  // "giữ tệp gốc": mọi ảnh ra `public/img/` đều qua pipeline sharp, không metadata (design.md §6f). Khung tên bản vẽ
  // ghi tên đơn vị khác ⇒ người sửa nội dung CẮT/CHE trên tệp nguồn TRƯỚC khi thả vào content/images/ (máy không đọc
  // được chữ trong ảnh ⇒ bước người soát ở design.md §6f).
}).strict();

// ---- Ô ảnh cố định (lượt 13 V39 + lượt 14 V41 (b), appsec M40 (6)) ----
// Ô ảnh = tên tệp cố định, không thêm thực thể nội dung: content/images/<basename>.<jpg|jpeg|png|webp> + <basename>.yaml
// (ImageMeta). Luật CHUNG cho mọi ô trong ALL_IMAGE_SLOTS:
//  - "Ô có ảnh dùng được" ⇔ đúng MỘT tệp ảnh của basename đó + meta hợp lệ + qua mọi luật ảnh hiện có (loại tệp dò byte
//    đầu, IMAGE_LIMITS, `hasPeople && !consentDate` ⇒ ảnh KHÔNG được dùng). Ảnh bị loại vì thiếu đồng ý = ô không có ảnh.
//  - Hai tệp cùng basename khác đuôi ⇒ build đỏ IMAGE_SLOT_DUPLICATE (build.ts §8), không tự chọn một tệp.
//  - Chú thích cố định theo locale (src/i18n/**, chữ theo ux_ui), KHÔNG dựng từ ImageMeta.source (nội bộ).
//  - Ô không có ảnh dùng được ⇒ không render, không ô chờ, không chữ "chờ GMS gửi"/"awaiting"; build vẫn xanh.
// Ô trang Công nghệ (M4, wireframe technology.html nhánh Sàng tuyển): khung "Dây chuyền sàng tuyển của GMS". Nhãn theo
// `kind`: ảnh thật không nhãn, bản vẽ/phối cảnh (anh-dung-ai) ⇒ C29. Tệp lượt trước `sorting-line-3d.png` không còn
// được đọc (V39).
export const TECHNOLOGY_IMAGE_SLOTS = { sortingLine: "gms-sorting-line" } as const;
// Ô trang chủ (M1 khối S6, wireframe home.html:710 `data-hide-if-missing="gms-before gms-after"`): cặp "Trước ↔ Sau"
// bằng ẢNH CHỤP THẬT của GMS (trước cải tạo ↔ nhà máy đang hoạt động), không phối cảnh (V41 (b)). Khối (hai ảnh + mũi
// tên + chú thích "Trước"/"Sau") chỉ render khi CẢ HAI ô có ảnh dùng được; thiếu một (kể cả bị loại vì thiếu đồng ý) ⇒
// ẩn CẢ khối, không hiện một ảnh lẻ. Ô có tệp mà `kind` ≠ HOME_IMAGE_SLOT_KIND ⇒ build đỏ IMAGE_SLOT_KIND_INVALID
// (build.ts §8; lý do chọn đỏ thay vì ẩn: contracts/README.md "Lượt 14"). Không nhãn C29 (ảnh thật).
export const HOME_IMAGE_SLOTS = { before: "gms-before", after: "gms-after" } as const;
export const HOME_IMAGE_SLOT_KIND = "anh-that" as const;
export const ALL_IMAGE_SLOTS = [
  TECHNOLOGY_IMAGE_SLOTS.sortingLine, HOME_IMAGE_SLOTS.before, HOME_IMAGE_SLOTS.after,
] as const;
export type ImageSlot = (typeof ALL_IMAGE_SLOTS)[number];

// Export (lượt 8): loader dùng `Common` để đọc frontmatter của MỌI loại có trang (news, project, job) trước khi biết
// loại — ghép cặp vi↔en theo `key` (thiếu EN ⇒ build đỏ, design.md §6b) và ghi content/slugs.lock (build.ts §4).
export const Common = z.object({
  slug: Slug,                                  // giống nhau giữa vi/en? KHÔNG bắt buộc; cặp nối bằng `key`
  key: Slug,                                   // khoá chung vi↔en; thiếu bản en của một key ⇒ build đỏ
  title: z.string().min(1).max(200),
  published: z.boolean(),
});

export const NewsFront = Common.extend({
  summary: z.string().min(1).max(400),
  date: IsoDate,
  heroImage: ImageRef.optional(),
  journey: z.boolean().default(false),         // chuỗi "Hành trình chuyển đổi"
  origin: z.string().regex(/^fanpage#0[1-7]$/).optional(),
  gmsSelected: z.boolean().optional(),          // bắt buộc true khi có origin (S31); thiếu/false ⇒ không sinh trang
  // Lượt 10 (S31, news-and-journey.feature dòng 79–82): căn cứ của ghi "GMS chọn đăng", vd "raw 02/11 P21".
  // gmsSelected true mà chuỗi rỗng ⇒ build đỏ FANPAGE_SELECTION_BASIS_MISSING (build.ts §8).
  gmsSelectedBasis: z.string().optional(),
});
export const ProjectFront = NewsFront.extend({ category: z.string().min(1) });
export const JobFront = Common.extend({
  validThrough: IsoDate,                        // ngày build > validThrough ⇒ không sinh trang (XQ-4)
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACTOR", "INTERN"]),
});
export const FaqItem = z.object({ key: Slug, order: z.number().int(), question: z.string().min(1), answer: z.string().min(1) });
export const OutputLine = z.object({
  key: Slug, group: z.enum(["sang-tuyen", "vpd"]), state: z.enum(["dinh-huong", "da-co"]),
  name: z.object({ vi: z.string(), en: z.string() }), desc: z.object({ vi: z.string(), en: z.string() }),
});
export const Figure = z.object({                // S7: thiếu source/confirmedBy ⇒ build đỏ
  key: Slug, value: z.string().min(1), unit: z.object({ vi: z.string(), en: z.string() }).optional(),
  label: z.object({ vi: z.string(), en: z.string() }),
  source: z.string().min(1), confirmedBy: z.string().min(1), confirmedAt: IsoDate, public: z.boolean(),
});
// Lượt 10 (S33 + S7): bảng so sánh, content/comparison-tables.yaml = ComparisonTable[]. Ô số luôn là tham chiếu
// Figure (S7: số phải có nguồn); ô chữ không được chứa chữ số (luật COMPARISON_NUMBER_NOT_FIGURE) để số không lách S7.
// Dòng có ô tham chiếu Figure thiếu `source` (hoặc thiếu key) ⇒ build đỏ COMPARISON_ROW_SOURCE_MISSING nêu bảng + dòng.
// Figure `public: false` ⇒ ẩn CẢ bảng (giữ luật lượt 5: bảng thiếu ô dẫn sai người đọc — ưu tiên 1).
// Lượt 13 (V39): bảng ẩn ở v1 (không có tệp ⇒ không khối); khi bật, chỉ dùng số GMS có nguồn — đi qua Figure như trên.
// Bỏ trường nguồn tư liệu bên ngoài của bảng (lượt 10 `partner`, lượt 12 `techSource`): khoá cũ ⇒ build đỏ (`.strict()`).
export const ComparisonCell = z.union([
  z.object({ figure: Slug }).strict(),
  z.object({ text: z.object({ vi: z.string().min(1), en: z.string().min(1) }) }).strict(),
]);
export const ComparisonTable = z.object({
  key: Slug,
  title: z.object({ vi: z.string().min(1), en: z.string().min(1) }),
  columns: z.array(z.object({ vi: z.string().min(1), en: z.string().min(1) })).min(1),
  rows: z.array(z.object({
    label: z.object({ vi: z.string().min(1), en: z.string().min(1) }),  // thông báo build dùng label.vi, vd "đốt"
    cells: z.array(ComparisonCell),                                     // số ô = số cột, lệch ⇒ build đỏ
  }).strict()).min(1),
}).strict();

// Lượt 10 (S12, news-and-journey.feature dòng 9–27): lộ trình 5 bước, content/journey-steps.yaml = JourneyStep[].
// `status` là chuỗi tự do CỐ Ý; ngoài JOURNEY_STATUSES ⇒ JOURNEY_STATUS_INVALID nêu số bước + giá trị (build.ts §8).
// Không ghi status ⇒ không nhãn. Nhãn EN của từng trạng thái: frontend_web theo ux-spec (src/i18n/**).
// Lượt 13 (V40 — admin chốt: nhà máy đã đi vào hoạt động): nội dung v1 = 5 bước, CẢ 5 `status: "đã xong"`. Contract
// không có giá trị mặc định (thiếu tệp/thiếu status ⇒ không nhãn — vẫn lệch V40, nên tệp nội dung v1 phải có đủ 5).
// Giữ đủ ba giá trị: "đang làm"/"chưa tới" vẫn hợp lệ cho nội dung về sau và bộ nội dung mẫu của qa.
export const JOURNEY_STATUSES = ["chưa tới", "đang làm", "đã xong"] as const;
export const JourneyStep = z.object({
  order: z.number().int().min(1).max(5),
  name: z.object({ vi: z.string().min(1), en: z.string().min(1) }),
  status: z.string().optional(),
}).strict();

// Lượt 10 (S24, contact-info.feature dòng 8–17, 54–58; contact-form dòng 130): số điện thoại/Zalo Việt Nam, ghi
// "+84…" hoặc "0…" (di động 10 số, cố định 02x 11 số); sai dạng (vd "09879") ⇒ luật PHONE_INVALID nêu tên trường
// "số điện thoại công khai"/"số Zalo" (build.ts §8; chuỗi tự do ở đây để thông báo nêu được tên trường). Loader chuẩn
// hoá về E.164; hiển thị theo locale (vi "090 000 00 00", en "+84 90 000 00 00"), tel:+84…, Zalo
// "https://zalo.me/0" + phần sau +84 — frontend_web.
export const VN_PHONE = /^(\+84|0)(2\d{9}|[35789]\d{8})$/;
export const MAP_POINT = /^-?\d{1,2}\.\d{4,7}, ?-?\d{1,3}\.\d{4,7}$/; // "20.930031, 106.065651" (vĩ độ, kinh độ)
export const Company = z.object({               // NAP một nguồn (S24); content/company.yaml
  legalName: z.string().min(1),                 // N27
  // Lượt 10: thiếu ⇒ build XANH, ẩn dòng mã số thuế ở chân trang vi/en, form tạm đóng (FormStatus, build.ts §9)
  taxId: z.string().regex(/^\d{10}(-\d{3})?$/).optional(),
  address: z.object({ vi: z.string(), en: z.string() }),
  phone: z.string().optional(), zaloPhone: z.string().optional(),   // kiểm bằng VN_PHONE (PHONE_INVALID); thiếu ⇒ ẩn nút
  email: z.string().email().optional(),
  // "điểm bản đồ"; thiếu ⇒ không có khối bản đồ. Lượt 12 (V29): nguồn DUY NHẤT của iframe + liên kết "Mở bản đồ"
  // (mapEmbedSrc/mapOpenHref dưới đây). Bỏ `mapImage` (ảnh tĩnh) và `mapUrl` (URL nhập tay): Company không `.strict()`
  // nên khoá cũ còn trong company.yaml bị zod bỏ qua — loader KHÔNG đọc, frontend KHÔNG dùng làm src/href.
  mapPoint: z.string().regex(MAP_POINT).optional(),
  social: z.array(z.object({ name: z.string(), url: SafeHref })).default([]),
  // V14. Lượt 10: optional — thiếu ⇒ build XANH, Chính sách không có dòng email trống, form tạm đóng (build.ts §9).
  privacyRequestEmail: z.string().email().optional(), // email NHẬN liên hệ KHÔNG ở đây (wrangler binding, design.md §4b)
});

// Lượt 12 (V29 + XQ-37 appsec, design.md §6d "Bản đồ (V29)"): MỘT dạng URL cho khung bản đồ, dựng lúc build từ
// mapPoint. Không Embed API có `key=`, không host `maps.google.com`, không lấy src từ chuỗi nhập tay. CSP trang tĩnh
// chỉ thêm MAP_EMBED.origin vào `frame-src` (design.md §6e). Thuộc tính iframe lấy ĐÚNG các giá trị dưới; không có
// thuộc tính `allow`, không `allowfullscreen`. `title` = "Bản đồ: <address.vi>" / "Map: <address.en>".
export const MAP_EMBED = {
  origin: "https://www.google.com",
  zoom: 15,
  loading: "lazy",
  referrerPolicy: "no-referrer",
  sandbox: "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
  aspectRatio: "16/10",
} as const;

// Tách "20.930031, 106.065651" ⇒ chuỗi vĩ độ/kinh độ giữ nguyên chữ số (không qua số thực, không làm tròn).
// Chuỗi không khớp MAP_POINT ⇒ ném lỗi (loader đã báo MAP_POINT_INVALID trước đó, build.ts §8).
export function parseMapPoint(point: string): { lat: string; lng: string } {
  if (!MAP_POINT.test(point)) throw new Error("MAP_POINT_INVALID");
  const comma = point.indexOf(",");
  return { lat: point.slice(0, comma).trim(), lng: point.slice(comma + 1).trim() };
}
export function mapEmbedSrc(point: string, locale: Locale): string {
  const { lat, lng } = parseMapPoint(point);
  return `${MAP_EMBED.origin}/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=${MAP_EMBED.zoom}&hl=${locale}&output=embed`;
}
// Liên kết "Mở bản đồ" (C-map-open): Maps URLs api=1 (có tài liệu), tab mới, rel="noopener noreferrer".
export function mapOpenHref(point: string): string {
  const { lat, lng } = parseMapPoint(point);
  return `${MAP_EMBED.origin}/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

export const PolicyFront = z.object({ version: z.string().min(1).max(40), effectiveFrom: IsoDate });
export const Approval = z.object({              // content/approvals/<sha256>.yaml (XQ-3)
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  confirmedBy: z.string().min(1), confirmedAt: IsoDate, evidence: z.string().min(1), recordedBy: z.string().min(1),
});

// ---- Tên không được nêu (lượt 14; ux-spec V38, V41 (c)(d); prd v0.7 §3b, §11 Q4; appsec M40; design.md §6f) ----
// content/denylist.yaml = ForbiddenNames. Danh sách v1: `names: ["Xanh Asian"]`. Chỉ ghi tên công ty/đơn vị KHÁC GMS
// mà web không được nêu. Tên dịch vụ do chức năng/luật bắt buộc (Cloudflare, dịch vụ thư trong Chính sách bảo mật;
// Zalo, Facebook, Messenger, dịch vụ bản đồ) KHÔNG thuộc danh sách (V41 (c)) — thêm nhầm thì build đỏ ầm ĩ (vd CSP
// `frame-src https://www.google.com`), không im lặng.
// Tệp KHÔNG render, KHÔNG có đường nào sang public/ hay out/ (M40 (3)); out/ có tệp tên DENYLIST_PATH ⇒ DENYLIST_IN_OUTPUT.
// Tệp thuộc content/** nên tính vào contentHash (build.ts §3): đổi danh sách = nội dung mới, cần xác nhận mới trước
// deploy prod (cố ý — danh sách là một phần của "nội dung đã duyệt"; xem contracts/README.md "Lượt 14").
// Thiếu tệp / sai schema / `names` rỗng ⇒ build đỏ DENYLIST_MISSING ở MỌI SITE_ENV (không có chế độ chỉ cảnh báo).
export const DENYLIST_PATH = "denylist.yaml" as const; // tương đối CONTENT_DIR
export const ForbiddenNames = z.object({
  names: z.array(z.string().min(2).max(100).regex(/[\p{L}\p{N}]/u)).min(1),
}).strict();

// Chuẩn hoá hai phía trước khi so (V41 (d)): xoá ký tự định dạng vô hình (\p{Cf}: gạch nối mềm U+00AD, U+200B–U+200F,
// U+202A–U+202E, U+2060–U+2064, U+FEFF…; lượt 16, appsec M40-c) → NFC → chữ thường → bỏ dấu (tách NFD, xoá dấu kết hợp;
// đ ⇒ d) → gộp khoảng trắng (gồm U+00A0) thành một dấu cách. Xoá Cf ĐẦU TIÊN, trước khi gộp khoảng trắng: "Xa"+U+00AD+"nh"
// ⇒ "xanh", "Xanh"+U+200B+"Asian" ⇒ "xanhasian" (dạng viết liền, lớp nối `*` vẫn bắt). Trình duyệt không vẽ Cf nên người
// đọc thấy nguyên tên. Chữ Việt không dùng Cf ⇒ không đỏ oan mới.
export function normalizeForNameScan(s: string): string {
  return s.replace(/\p{Cf}+/gu, "").normalize("NFC").toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "")
    .replace(/đ/g, "d").replace(/\s+/gu, " ");
}

// Giải mã trước khi chuẩn hoá, áp cho MỌI tệp văn bản (không phân loại theo đuôi — superset rẻ hơn một bảng ánh xạ):
// tham chiếu ký tự HTML/XML (&#NN; &#xHH; &amp; &lt; &gt; &quot; &apos; &nbsp; &shy;), thoát JS/JSON (\uXXXX, \xHH), mã
// hoá phần trăm của URL (%XX…: byte UTF-8 hỏng giữ nguyên "%XX", chuỗi hợp lệ bên cạnh vẫn giải — decodePercentRun).
// Để "Xanh&nbsp;Asian", "Xanh Asian", "xanh%20asian", "xanh%20asian%FF" không lọt. Lượt 16 (appsec M40-b): một lượt
// giải (decodeOnceForNameScan, thứ tự cố định HTML → \u/\x → %) LẶP tới khi chuỗi không đổi, tối đa
// NAME_SCAN_DECODE_PASSES_MAX lượt ⇒ mã hoá lồng nhau tới 3 lớp ("%2520", "%26nbsp%3B", "%5Cu0020", "&amp;nbsp;",
// "%252520") giải hết; lớp thứ 4 trở lên còn lại một lớp chưa giải ⇒ lọt (giới hạn có chủ ý, design.md §6f). Dấu "+"
// KHÔNG giải thành dấu cách — "+" là ký tự nối trong forbiddenNamePattern (lượt 15; lý do: contracts/README.md "Lượt 15").
export const NAME_SCAN_DECODE_PASSES_MAX = 3;
// Map thay object literal: tên thực thể lạ trùng khoá của Object.prototype ("&constructor;", "&toString;") không trả hàm.
const NAMED_REFS: ReadonlyMap<string, string> = new Map<string, string>([
  ["amp", "&"], ["lt", "<"], ["gt", ">"], ["quot", '"'], ["apos", "'"],
  ["nbsp", String.fromCharCode(0xa0)], ["shy", String.fromCharCode(0xad)], // mã số, không để ký tự vô hình trong nguồn
]);
const fromCodePointOr = (cp: number, fallback: string): string =>
  Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : fallback;
// Số byte của một chuỗi UTF-8 theo byte đầu (RFC 3629 §4): 00–7F ⇒ 1, C2–DF ⇒ 2, E0–EF ⇒ 3, F0–F4 ⇒ 4; còn lại (byte
// nối 80–BF, C0, C1, F5–FF) ⇒ 0 = không mở được chuỗi nào.
const utf8SeqLength = (lead: number): number => {
  if (lead <= 0x7f) return 1;
  if (lead >= 0xc2 && lead <= 0xdf) return 2;
  if (lead >= 0xe0 && lead <= 0xef) return 3;
  if (lead >= 0xf0 && lead <= 0xf4) return 4;
  return 0;
};
// Lượt 15 (hệ quả (i) lượt 14): một cụm "%XX" liền nhau. Cả cụm giải được ⇒ trả luôn. Không ⇒ đi từng byte: byte đầu cho
// độ dài n, thử decodeURIComponent đúng n byte đó (nó tự loại byte nối sai, dạng dài thừa, nửa cặp thay thế, > U+10FFFF);
// được ⇒ lấy chữ, nhảy n; không ⇒ giữ nguyên "%XX" của byte đầu, nhảy 1 (đồng bộ lại ở byte kế). Vd "%20%FF%20" ⇒ " %FF ",
// "%E1%BA%20" ⇒ "%E1%BA ", "%C3%C3%A1" ⇒ "%C3á". Hàm thuần, chỉ dùng hàm có sẵn của ES.
function decodePercentRun(run: string): string {
  try { return decodeURIComponent(run); } catch { /* có byte hỏng ⇒ giải từng chuỗi bên dưới */ }
  const bytes: string[] = run.match(/%[0-9a-f]{2}/gi) ?? [];
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const lead = bytes[i] ?? "";
    const n = utf8SeqLength(Number.parseInt(lead.slice(1), 16));
    let decoded: string | undefined = undefined;
    if (n > 0 && i + n <= bytes.length) {
      try { decoded = decodeURIComponent(bytes.slice(i, i + n).join("")); } catch { /* chuỗi n byte hỏng */ }
    }
    if (decoded === undefined) { out += lead; i += 1; } else { out += decoded; i += n; }
  }
  return out;
}
// Một lượt giải (thứ tự cố định). Mỗi .replace quét chuỗi đầu vào của chính nó một lần: chữ vừa giải ra ở một bước không
// được bước đó giải tiếp ("&amp;nbsp;" ⇒ "&nbsp;"), lớp còn lại do lượt sau của decodeForNameScan bóc.
function decodeOnceForNameScan(s: string): string {
  return s
    .replace(/&#x([0-9a-f]{1,6});/gi, (m: string, h: string) => fromCodePointOr(Number.parseInt(h, 16), m))
    .replace(/&#(\d{1,7});/g, (m: string, d: string) => fromCodePointOr(Number.parseInt(d, 10), m))
    .replace(/&([a-z]+);/gi, (m: string, n: string) => NAMED_REFS.get(n.toLowerCase()) ?? m)
    .replace(/\\u([0-9a-f]{4})/gi, (_m: string, h: string) => String.fromCharCode(Number.parseInt(h, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_m: string, h: string) => String.fromCharCode(Number.parseInt(h, 16)))
    .replace(/(?:%[0-9a-f]{2})+/gi, (m: string) => decodePercentRun(m));
}
// Lượt 16 (M40-b): lặp tới bất động, trần NAME_SCAN_DECODE_PASSES_MAX lượt. Dừng sớm khi một lượt không đổi gì (đường
// thường: chuỗi không mã hoá ⇒ 1 lượt; mã hoá một lớp ⇒ 2 lượt). Trần là hằng ⇒ thời gian chạy ≤ 3 × một lượt, không có
// vòng vô hạn kể cả khi một lượt luôn đổi chuỗi. Vd "xanh%252520asian" ⇒ "%2520" ⇒ "%20" ⇒ " " (3 lượt, bắt);
// "xanh%25252520asian" ⇒ sau 3 lượt còn "xanh%20asian" (lọt — giới hạn, contracts/README.md "Lượt 16").
export function decodeForNameScan(s: string): string {
  let cur = s;
  for (let pass = 0; pass < NAME_SCAN_DECODE_PASSES_MAX; pass += 1) {
    const next = decodeOnceForNameScan(cur);
    if (next === cur) break;
    cur = next;
  }
  return cur;
}

// Một tên ⇒ một RegExp trên chuỗi ĐÃ chuẩn hoá: các chữ của tên nối bằng `[\s_./+-]*` ⇒ bắt "Xanh Asian", "xanh asian",
// "Xanh Ásian", "XanhAsian" (dạng viết liền), "xanh-asian", "xanh_asian", "xanh.asian", "xanh/asian" (tên tệp, URL,
// slug), "xanh+asian" và "xanh%2Basian" (dấu cách dạng form trong query string; lượt 15, hệ quả (ii) lượt 14). Không bắt
// khi giữa hai chữ có dấu câu khác (", " …) — cố ý, để câu thường không đỏ oan.
export function forbiddenNamePattern(name: string): RegExp {
  const tokens = normalizeForNameScan(name).split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0);
  if (tokens.length === 0) throw new Error("DENYLIST_MISSING"); // ForbiddenNames.regex đã chặn trước
  return new RegExp(tokens.join("[\\s_./+-]*"), "u");
}

// Trả các tên (nguyên văn như trong danh sách) xuất hiện trong `text`. Hàm thuần — loader, output-check và ca qa dùng chung.
export function findForbiddenNames(text: string, names: readonly string[]): string[] {
  const hay = normalizeForNameScan(decodeForNameScan(text));
  return names.filter((n) => forbiddenNamePattern(n).test(hay));
}
