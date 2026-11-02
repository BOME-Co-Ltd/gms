// Mô hình nội dung dạng file trong repo (lượt 5 — thay collection Payload). Đọc kèm content-model.md.
// Mỗi mục = content/<loại>/<slug>.<vi|en>.md (frontmatter YAML + thân Markdown) hoặc content/<tệp>.yaml.
// Loader `src/content/**` (backend) parse bằng các schema này; sai ⇒ build đỏ.
// Máy validate: `bun x tsc --noEmit -p 02-design/contracts` (chưa kiểm).
import { z } from "zod";
import { SafeHref } from "./safe-url";

const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/); // ngày theo Asia/Ho_Chi_Minh
const ImageRef = z.string().regex(/^images\/[a-z0-9-]+\.(jpe?g|png|webp)$/); // tương đối content/

export const IMAGE_LIMITS = { maxBytes: 5 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] } as const; // G5 (ảnh qua kiểm lúc build). 5 MB: đề xuất của architect lượt 6, G5 không ghi số

// Ảnh: content/images/<tên>.<đuôi> + content/images/<tên>.yaml
export const ImageMeta = z.object({
  alt: z.object({ vi: z.string().min(1), en: z.string().min(1) }),
  kind: z.enum(["anh-that", "anh-dung-ai"]),   // anh-dung-ai ⇒ nhãn "Phối cảnh dự kiến" / "Artist's impression"
  hasPeople: z.boolean(),
  consentDate: IsoDate.optional(),             // hasPeople && !consentDate ⇒ build đỏ nếu ảnh được dùng
  source: z.string().min(1),
});

const Common = z.object({
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
  gmsSelected: z.boolean().optional(),          // bắt buộc true khi có origin (S31)
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
export const Partner = z.object({ name: z.string().min(1), logo: ImageRef.optional(), permissionOnFile: z.literal(true) });
export const Company = z.object({               // NAP một nguồn (S24); content/company.yaml
  legalName: z.string().min(1),
  address: z.object({ vi: z.string(), en: z.string() }),
  phone: z.string().optional(), email: z.string().email().optional(), zalo: SafeHref.optional(),
  mapImage: ImageRef.optional(), mapUrl: SafeHref.optional(),
  social: z.array(z.object({ name: z.string(), url: SafeHref })).default([]),
  privacyRequestEmail: z.string().email(),      // V14; email NHẬN liên hệ KHÔNG ở đây (wrangler var, design.md §4b)
});
export const PolicyFront = z.object({ version: z.string().min(1).max(40), effectiveFrom: IsoDate });
export const Approval = z.object({              // content/approvals/<sha256>.yaml (XQ-3)
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  confirmedBy: z.string().min(1), confirmedAt: IsoDate, evidence: z.string().min(1), recordedBy: z.string().min(1),
});
