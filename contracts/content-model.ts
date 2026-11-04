// Mô hình nội dung dạng file trong repo (lượt 5 — bỏ CMS, raw 31/10). Đọc kèm content-model.md.
// Mỗi mục = content/<loại>/<slug>.<vi|en>.md (frontmatter YAML + thân Markdown) hoặc content/<tệp>.yaml.
// Loader `src/content/**` (backend) parse bằng các schema này; sai ⇒ build đỏ.
// Máy validate: `bun x tsc --noEmit` (design.md "Đã kiểm").
import { z } from "zod";
import { SafeHref } from "./safe-url";

const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/); // ngày theo Asia/Ho_Chi_Minh
const ImageRef = z.string().regex(/^images\/[a-z0-9-]+\.(jpe?g|png|webp)$/); // tương đối content/

export const IMAGE_LIMITS = { maxBytes: 5 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] } as const; // G5 (ảnh qua kiểm lúc build). 5 MB: đề xuất của architect lượt 6, G5 không ghi số

// Lượt 10 (04/11, S33 prd v0.5.1 §3b): loại tư liệu đối tác được phép. Giá trị là chữ tiếng Việt đúng như nội dung
// nguồn ghi (thông báo build trích nguyên văn). KHÔNG có "logo" và không bao giờ thêm (prd §5: logo Xanh Asian cấm).
export const PARTNER_ASSET_TYPES = ["sơ đồ quy trình", "bảng so sánh", "bản vẽ 3D"] as const;
export const PartnerAssetType = z.enum(PARTNER_ASSET_TYPES);

// Ảnh: content/images/<tên>.<đuôi> + content/images/<tên>.yaml
export const ImageMeta = z.object({
  alt: z.object({ vi: z.string().min(1), en: z.string().min(1) }),
  kind: z.enum(["anh-that", "anh-dung-ai"]),   // anh-dung-ai ⇒ nhãn "Phối cảnh dự kiến" / "Artist's impression"
  hasPeople: z.boolean(),
  consentDate: IsoDate.optional(),             // hasPeople && !consentDate ⇒ build đỏ nếu ảnh được dùng
  source: z.string().min(1),
  // Lượt 10 (S33): ảnh là tư liệu của một Đối tác. `type` là chuỗi tự do CỐ Ý (không enum) để khai sai như "logo" vẫn
  // parse được và luật build PARTNER_ASSET_NOT_ALLOWED nêu đúng tên ảnh + loại (build.ts §8), thay vì lỗi zod chung.
  partnerAsset: z.object({ partner: z.string().min(1), type: z.string().min(1) }).strict().optional(),
  // Lượt 10 (S33, prd §3b "giữ khung tên"): true ⇒ không cắt ở mọi khâu: scripts/content/images chỉ thu nhỏ giữ tỉ lệ
  // (fit "inside", bản lớn nhất = kích thước gốc), không extract/cover; OG không cắt từ ảnh này (dùng og/default.png);
  // frontend render object-fit: contain (không crop bằng CSS). Ca qa: tỉ lệ và kích thước bản lớn nhất = tệp gốc.
  keepTitleBlock: z.boolean().default(false),
}).strict();

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
// Lượt 10 (S33, prd v0.5.1 §3b "Đối tác"): content/partners.yaml = Partner[]; tệp không có hoặc mảng rỗng ⇒ trang
// Công nghệ KHÔNG có khối Đối tác (không tiêu đề, không chỗ trống). Không có trường logo: `.strict()` ⇒ khoá `logo`
// (hay khoá lạ khác) làm build đỏ. `permissionBasis` là chuỗi tự do (vd "raw 02/11 N22"; sau khi GMS gửi văn bản thì
// ghi nơi lưu văn bản) — chỉ chuỗi, văn bản cho phép không vào repo. Chuỗi rỗng/chỉ khoảng trắng ⇒ luật build
// PARTNER_PERMISSION_MISSING nêu tên đối tác + "căn cứ cho phép" (build.ts §8) — không dùng .min(1) ở đây để thông báo
// nêu được tên đối tác thay vì lỗi zod chung.
export const Partner = z.object({
  name: z.string().min(1),
  role: z.object({ vi: z.string().min(1), en: z.string().min(1) }),   // vd "đối tác chuyển giao công nghệ"
  description: z.object({ vi: z.string(), en: z.string() }).optional(),
  permissionBasis: z.string(),                                        // "căn cứ cho phép"
  allowedAssets: z.array(PartnerAssetType).default([]),               // "tư liệu được phép dùng"; ngoài enum ⇒ build đỏ
}).strict();

// Lượt 10 (S33 + S7): bảng so sánh, content/comparison-tables.yaml = ComparisonTable[]. Ô số luôn là tham chiếu
// Figure (S7: số phải có nguồn); ô chữ không được chứa chữ số (luật COMPARISON_NUMBER_NOT_FIGURE) để số không lách S7.
// Dòng có ô tham chiếu Figure thiếu `source` (hoặc thiếu key) ⇒ build đỏ COMPARISON_ROW_SOURCE_MISSING nêu bảng + dòng.
// Figure `public: false` ⇒ ẩn CẢ bảng (giữ luật lượt 5: bảng thiếu ô dẫn sai người đọc — ưu tiên 1).
// `partner` có ⇒ bảng là tư liệu đối tác loại "bảng so sánh": đối tác phải có loại này trong allowedAssets.
export const ComparisonCell = z.union([
  z.object({ figure: Slug }).strict(),
  z.object({ text: z.object({ vi: z.string().min(1), en: z.string().min(1) }) }).strict(),
]);
export const ComparisonTable = z.object({
  key: Slug,
  title: z.object({ vi: z.string().min(1), en: z.string().min(1) }),
  partner: z.string().min(1).optional(),
  columns: z.array(z.object({ vi: z.string().min(1), en: z.string().min(1) })).min(1),
  rows: z.array(z.object({
    label: z.object({ vi: z.string().min(1), en: z.string().min(1) }),  // thông báo build dùng label.vi, vd "đốt"
    cells: z.array(ComparisonCell),                                     // số ô = số cột, lệch ⇒ build đỏ
  }).strict()).min(1),
}).strict();

// Lượt 10 (S12, news-and-journey.feature dòng 9–27): lộ trình 5 bước, content/journey-steps.yaml = JourneyStep[].
// `status` là chuỗi tự do CỐ Ý; ngoài JOURNEY_STATUSES ⇒ JOURNEY_STATUS_INVALID nêu số bước + giá trị (build.ts §8).
// Không ghi status ⇒ không nhãn. Nhãn EN của từng trạng thái: frontend_web theo ux-spec (src/i18n/**).
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
  mapPoint: z.string().regex(MAP_POINT).optional(),                 // "điểm bản đồ"; thiếu ⇒ không có khối bản đồ
  mapImage: ImageRef.optional(), mapUrl: SafeHref.optional(),       // ux-spec "Mở bản đồ" (iframe chỉ sau khi bấm)
  social: z.array(z.object({ name: z.string(), url: SafeHref })).default([]),
  // V14. Lượt 10: optional — thiếu ⇒ build XANH, Chính sách không có dòng email trống, form tạm đóng (build.ts §9).
  privacyRequestEmail: z.string().email().optional(), // email NHẬN liên hệ KHÔNG ở đây (wrangler binding, design.md §4b)
});
export const PolicyFront = z.object({ version: z.string().min(1).max(40), effectiveFrom: IsoDate });
export const Approval = z.object({              // content/approvals/<sha256>.yaml (XQ-3)
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  confirmedBy: z.string().min(1), confirmedAt: IsoDate, evidence: z.string().min(1), recordedBy: z.string().min(1),
});
