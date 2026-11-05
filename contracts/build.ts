// Contract build và deploy site tĩnh (lượt 6, 31/10/2026 — trả lời qa XQ-QA21, appsec M36, XQ-27; XQ-29(c) M36-b).
// Lượt 8 (04/11): DATE_OVERRIDE chỉ ngày; build do Deploy Hook kích không chắc có WORKERS_CI_BRANCH (§1).
// Lượt 9 (04/11): §1 nhánh (2) giữ theo appsec XQ-31.1 (CÓ có điều kiện, design.md §5b); thêm §7 luật import Worker.
// Lượt 10 (04/11): §8 mã + thông báo luật nội dung (S33, S12, S31, S24); §9 FormStatus (form tạm đóng khi thiếu V3/V14/N27).
// Máy validate: `bun x tsc --noEmit` (design.md "Đã kiểm").
// Người hiện thực: frontend_web (build, loader nội dung, content-check) · devops (deploy-prod, CI, _redirects, _headers).
import { z } from "zod";

// ---- 1. Biến build (Next `output: "export"`) ----
// Đích thư liên hệ KHÔNG phải biến build: production = `send_email[].destination_address` của binding MAIL trong
// wrangler.jsonc (design.md §4b). CONTACT_RECIPIENT chỉ là `vars` của wrangler.test.jsonc cho Mailer giả (test-control.ts).
export const PRODUCTION_BRANCH = "production" as const;
type BranchEnv = { SITE_ENV?: string; WORKERS_CI_BRANCH?: string; WORKERS_CI?: string };
// Tài liệu Workers Builds (Configuration › Default variables, cập nhật 22/09/2026, đọc 04/11/2026) ghi
// WORKERS_CI_BRANCH = "<branch-name-from-push-event"; trang Deploy hooks (cập nhật 30/10/2026) KHÔNG nói build do hook
// kích có đặt biến này. Vì vậy: rỗng/không có = "không biết nhánh", KHÔNG coi là nhánh khác. [chưa kiểm] ⇒ devops thử.
const branchOf = (e: BranchEnv): string | undefined => (e.WORKERS_CI_BRANCH ? e.WORKERS_CI_BRANCH : undefined);
// Mọi luật "chỉ khi production" (design §6f thiếu approvals, §3 dưới, deploy-prod) dùng hàm này, không đọc SITE_ENV riêng.
export const isProductionBuild = (e: BranchEnv): boolean =>
  branchOf(e) === PRODUCTION_BRANCH || e.SITE_ENV === "production";
// M36-b hai chiều: một bên nói production thì bên kia phải nói production; nhánh không biết thì chỉ SITE_ENV quyết.
export const productionEnvMismatch = (e: BranchEnv): boolean =>
  isProductionBuild(e) &&
  (e.SITE_ENV !== "production" || (branchOf(e) !== undefined && branchOf(e) !== PRODUCTION_BRANCH));
// deploy-prod KHÔNG --dry-run chỉ chạy khi hàm này đúng. Hai đường:
//   (1) build do push: WORKERS_CI_BRANCH = production;
//   (2) build do Deploy Hook (hook gắn nhánh production, ADR-005 §3.1): không có nhánh + WORKERS_CI = "1" (Workers Builds).
// SITE_ENV=test + không có nhánh ⇒ không phải production ⇒ deploy bị từ chối (BRANCH_NOT_PRODUCTION), không lặng lẽ
// deploy mà bỏ kiểm approval. Trên máy (không WORKERS_CI) không deploy production được.
// XQ-31.1 (appsec, 04/11): nhánh (2) được chấp nhận CÓ ĐIỀU KIỆN (design.md §5b XQ-4). devops thử thấy hook CÓ đặt
// WORKERS_CI_BRANCH ⇒ architect BỎ nhánh (2) (chỉ còn (1)); ca qa threat-model §00000.4.
export const mayDeployProduction = (e: BranchEnv): boolean =>
  !productionEnvMismatch(e) && e.SITE_ENV === "production" &&
  (branchOf(e) === PRODUCTION_BRANCH || (branchOf(e) === undefined && e.WORKERS_CI === "1"));

// Ngày theo Asia/Ho_Chi_Minh, CHỈ ngày (khớp content-model.ts `IsoDate`, so với JobFront.validThrough).
export const BuildDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const BUILD_TIME_ZONE = "Asia/Ho_Chi_Minh" as const;

export const BuildEnv = z.object({
  SITE_URL: z.string().url().refine((v) => !v.endsWith("/"), "SITE_URL không có '/' cuối"),
  SITE_ENV: z.enum(["test", "staging", "production"]),
  CONTENT_DIR: z.string().default("content"), // qa trỏ tới tests/fixtures/content-sample
  // "Hôm nay" khi lọc tin tuyển dụng (validThrough < ngày build ⇒ không sinh trang, XQ-4). Vd DATE_OVERRIDE=2026-11-16.
  // Không có ⇒ ngày hiện tại theo BUILD_TIME_ZONE.
  DATE_OVERRIDE: BuildDate.optional(),
  // Biến hệ thống của Workers Builds. Không có khi build trên máy hoặc CI khác; build do Deploy Hook: xem branchOf.
  WORKERS_CI_BRANCH: z.string().optional(),
  WORKERS_CI: z.string().optional(),
}).superRefine((e, ctx) => {
  // M36: build production/staging có DATE_OVERRIDE hoặc CONTENT_DIR khác "content" ⇒ build đỏ.
  // M36-b/XQ-29(c): "production" xác định theo nhánh HOẶC SITE_ENV (productionEnvMismatch ở trên).
  // Trigger đặt nhầm SITE_ENV=test trên nhánh production không tắt được luật.
  const prod = isProductionBuild(e);
  if (productionEnvMismatch(e)) ctx.addIssue({ code: "custom", message: "PRODUCTION_ENV_MISMATCH" });
  if ((prod || e.SITE_ENV !== "test") && e.DATE_OVERRIDE) ctx.addIssue({ code: "custom", message: "DATE_OVERRIDE_FORBIDDEN" });
  if (prod && e.CONTENT_DIR !== "content") ctx.addIssue({ code: "custom", message: "CONTENT_DIR_FORBIDDEN" });
});

// ---- 2. Script (tên không có ":" — luật L-014) ----
export const BUILD_SCRIPTS = {
  build: "build",                  // content-check rồi next build ⇒ OUT_DIR
  contentCheck: "content-check",   // chỉ kiểm content/** (schema, safe-url, slugs.lock, ảnh); exit ≠ 0 khi lỗi
  deployProd: "deploy-prod",       // nhận cờ --dry-run: in hash, kiểm approval, không gọi wrangler
} as const;

export const OUT_DIR = "out" as const;
// Dạng URL: trailingSlash false ⇒ `/vi/gioi-thieu` ↔ out/vi/gioi-thieu.html; trang gốc locale `/en` ↔ out/en.html.
// wrangler.jsonc `assets.html_handling: "drop-trailing-slash"`: `/x/` ⇒ 307 về `/x` (theo tài liệu Cloudflare, chưa
// chạy thử với cặp out/en.html + out/en/… — qa có ca kiểm). Canonical/sitemap luôn dạng không "/" cuối.
export const TRAILING_SLASH = false as const;
export const ASSETS_HTML_HANDLING = "drop-trailing-slash" as const;

// ---- 3. Băm nội dung và duyệt (XQ-27, content-model.ts `Approval`) ----
// contentHash = sha256hex( nối theo thứ tự `${relPath}\n${sha256hex(bytes)}\n` ) qua MỌI tệp dưới content/**
// trừ content/approvals/**; relPath dùng "/", tương đối từ content/, sắp theo byte UTF-8 tăng dần. Tệp ẩn (".*") tính luôn.
export const CONTENT_HASH_EXCLUDE = ["approvals/"] as const;
export const ContentHash = z.string().regex(/^[0-9a-f]{64}$/);
export const APPROVAL_PATH = (hash: string) => `content/approvals/${hash}.yaml` as const;

// `deploy-prod --dry-run` in ra stdout đúng một dòng khớp DEPLOY_HASH_LINE, rồi một trong các dòng kết quả.
// Exit 0 chỉ khi APPROVED. Chuỗi nguyên văn — qa so khớp.
export const DEPLOY_HASH_LINE = /^content-hash: [0-9a-f]{64}$/;
export const DEPLOY_RESULT = {
  approved: "APPROVED",
  missing: "APPROVAL_MISSING",          // không có content/approvals/<hash>.yaml
  invalid: "APPROVAL_INVALID",          // sai schema Approval hoặc trường hash ≠ hash đã tính
  wrongBranch: "BRANCH_NOT_PRODUCTION", // không --dry-run mà mayDeployProduction(env) sai (§1, XQ-29(c))
  envMismatch: "PRODUCTION_ENV_MISMATCH", // BuildEnv §1: nhánh và SITE_ENV không cùng nói production
  testConfig: "TEST_CONFIG_FORBIDDEN",  // wrangler.test.jsonc hoặc main ≠ worker/index.ts (test-control.ts)
  formStatusMismatch: "FORM_STATUS_MISMATCH", // lượt 10, §9: out/form-status.json open=false mà FORM_ENABLED ≠ "false"
} as const;
// Lưu ý (ADR-005): script này chỉ chặn sơ suất; người ghi được repo sửa được nó. Lớp chặn cố ý là ruleset nhánh
// `production` + CODEOWNERS (người duyệt khác người viết) + Workers Builds chỉ build nhánh `production` (ADR-005 §3.1).
// Kiểm approval chạy khi isProductionBuild(env) (§1), kể cả khi SITE_ENV đặt sai.

// ---- 4. slugs.lock (content-model.md) ----
// Mỗi dòng: `<kind>\t<key>\t<locale>\t<slug>`, LF, không dòng trống, sắp theo byte; kind ∈ SlugKind.
// Đổi slug của (kind,key,locale) đã có ⇒ build đỏ trừ khi `_redirects` có 301 từ đường cũ sang đường mới.
// Xoá mục ⇒ được (trang thành 404; seo quyết có 301 hay không). Thêm mục ⇒ build ghi thêm dòng, người viết commit.
export const SlugKind = z.enum(["page", "news", "journey"]);
export const SLUG_LOCK_LINE = /^(page|news|journey)\t[a-z0-9-]+\t(vi|en)\t[a-z0-9-]+$/;

// ---- 5. Bộ nội dung mẫu ----
// Thuộc qa: tests/fixtures/content-sample/ (cùng cấu trúc content/, có approvals/ riêng). Build qua CONTENT_DIR,
// SITE_ENV=test. Nội dung thật content/** không dùng làm dữ liệu kiểm.

// ---- 6. _redirects và _headers (Static Assets) ----
// _redirects: devops viết tay từ 02-design/redirect-map.md + 301 khi đổi slug. Nội dung không sinh dòng nào.
// content-check kiểm mọi dòng: nguồn và đích bắt đầu bằng đúng MỘT "/" (không "//", không lược đồ) ⇒ không đường
// chuyển hướng nào ra tên miền khác (XQ-QA22). Mã 301 hoặc 308; mã khác ⇒ đỏ.
export const REDIRECT_LINE = /^\/(?!\/)\S*\s+\/(?!\/)\S*\s+(301|308)$/;
// _headers: tĩnh (design.md §6e) + băm CSP của script inline sinh sau next build; SITE_ENV=staging thêm
// `X-Robots-Tag: noindex` cho `/*`. Nội dung không sinh dòng nào. _headers KHÔNG áp cho phản hồi Worker
// (/api/*): Worker tự đặt WORKER_RESPONSE_HEADERS (api.ts §9).

// ---- 7. Luật import của Worker (lượt 9, XQ-25(f), threat-model T7) ----
// Bundle Worker production (điểm vào worker/index.ts) chỉ được chứa: mã nhà (worker/** trừ worker/testing/**,
// src/shared/contact/**) + đúng các gói npm dưới + module nền tảng dưới. Gói độc trong bundle đọc được outbox (PII).
// Ca CI (devops dựng, qa viết): `wrangler deploy --dry-run --outdir <thư mục> --metafile <tệp>` với wrangler.jsonc;
// mọi đầu vào của metafile nằm dưới node_modules phải thuộc WORKER_ALLOWED_PACKAGES; mọi import "cloudflare:*" phải
// thuộc WORKER_ALLOWED_PLATFORM_MODULES. [chưa kiểm] cờ --metafile của wrangler 4.x ⇒ không có thì devops chạy
// `bun build worker/index.ts --target=browser --metafile` cùng tsconfig, so cùng danh sách.
// worker/domain/** (C7) chặt hơn: chỉ "zod" + đường dẫn tương đối trong worker/domain/** và src/shared/contact/**
// (Biome noRestrictedImports hoặc ca CI grep import; không cloudflare:*).
export const WORKER_ALLOWED_PACKAGES = ["zod"] as const;
export const WORKER_ALLOWED_PLATFORM_MODULES = ["cloudflare:email"] as const; // EmailMessage cho send_email (adapters)
// Gói kiểu (@cloudflare/workers-types) chỉ là type, không vào bundle. Thêm gói vào hai danh sách trên = sửa contract
// (D7) ⇒ appsec soát.
// Cài đặt: `bun install --frozen-lockfile` ở CI; bun.lock commit. package.json `trustedDependencies` (gói được chạy
// script cài đặt) chỉ gồm TRUSTED_DEPENDENCIES; thêm gói ⇒ sửa contract, appsec soát. Ca CI: so khớp nguyên văn.
// [chưa kiểm] sharp 0.35.x với bun có cần script cài đặt không: không cần thì bỏ khỏi danh sách (danh sách nhỏ hơn
// luôn được phép), cần thêm gói khác (vd esbuild/workerd của wrangler) ⇒ báo architect + appsec trước khi thêm.
export const TRUSTED_DEPENDENCIES = ["sharp"] as const;

// ---- 8. Luật nội dung lúc build (lượt 10; design.md §6f, src/content/rules/**, backend) ----
// content-check chạy MỌI luật rồi mới dừng (gom lỗi, không dừng ở lỗi đầu) ⇒ một dòng bảng so sánh tham chiếu Số liệu
// thiếu nguồn ra CẢ lỗi S7 lẫn COMPARISON_ROW_SOURCE_MISSING. Mỗi lỗi in một dòng stderr: `<CODE>: <thông báo>`, exit ≠ 0.
// Thông báo tiếng Việt, trích NGUYÊN VĂN tên/giá trị trong nội dung nguồn trong nháy kép; qa so chuỗi con của thông báo
// (các cụm trong nháy ở feature), không so cả dòng. Thêm luật = sửa contract (D7).
export type ContentRuleIssue = { code: ContentRuleCode; message: string };
export const CONTENT_RULE_MESSAGES = {
  // figures-and-claims.feature dòng 96–101
  PARTNER_PERMISSION_MISSING: (p: { partner: string }) =>
    `Đối tác "${p.partner}" thiếu trường "căn cứ cho phép"`,
  // dòng 110–115; cũng bắt type rỗng của enum lẫn đối tác không có trong partners.yaml
  PARTNER_ASSET_NOT_ALLOWED: (p: { image: string; type: string; partner: string }) =>
    `"${p.image}" loại "${p.type}" không thuộc tư liệu được phép của "${p.partner}"`,
  PARTNER_UNKNOWN: (p: { ref: string; partner: string }) =>
    `"${p.ref}" khai là tư liệu của Đối tác "${p.partner}" nhưng không có Đối tác này trong partners.yaml`,
  // dòng 130–135
  COMPARISON_ROW_SOURCE_MISSING: (p: { table: string; row: string }) =>
    `bảng so sánh "${p.table}", dòng "${p.row}" thiếu nguồn`,
  COMPARISON_NUMBER_NOT_FIGURE: (p: { table: string; row: string }) =>
    `bảng so sánh "${p.table}", dòng "${p.row}" có chữ số trong ô chữ — số phải là Số liệu có nguồn`,
  COMPARISON_SHAPE: (p: { table: string; row: string }) =>
    `bảng so sánh "${p.table}", dòng "${p.row}" có số ô khác số cột`,
  // news-and-journey.feature dòng 23–26
  JOURNEY_STATUS_INVALID: (p: { step: number; status: string }) =>
    `bước ${p.step} có trạng thái "${p.status}" không thuộc "chưa tới", "đang làm", "đã xong"`,
  // news-and-journey.feature dòng 79–82
  FANPAGE_SELECTION_BASIS_MISSING: (p: { origin: string }) =>
    `bài fanpage "${p.origin}" ghi "GMS chọn đăng" nhưng thiếu căn cứ`,
  // contact-info.feature dòng 54–57; field ∈ "số điện thoại công khai" | "số Zalo"
  PHONE_INVALID: (p: { field: string }) => `"${p.field}" không phải số điện thoại Việt Nam hợp lệ`,
  // lượt 11 (05/11), khớp src/content/rules/index.ts (c982bff): company.yaml có mapPoint mà không phải chuỗi khớp
  // content-model.ts MAP_POINT ⇒ lỗi này, build đỏ; thiếu/null ⇒ không lỗi, không có khối bản đồ (contact-info.feature:21–23).
  MAP_POINT_INVALID: () =>
    `company.yaml: điểm bản đồ (mapPoint) phải có dạng "vĩ độ, kinh độ", ví dụ "20.930031, 106.065651"`,
} as const;
export type ContentRuleCode = keyof typeof CONTENT_RULE_MESSAGES;
// Luật S33 (đọc kèm content-model.ts Partner, ImageMeta, ComparisonTable):
// (1) Partner.permissionBasis.trim() === "" ⇒ PARTNER_PERMISSION_MISSING. Đối tác đó không ra trang dù build đỏ.
// (2) Ảnh có partnerAsset: partner không có ⇒ PARTNER_UNKNOWN; type ∉ partner.allowedAssets (kể cả "logo", vì
//     PARTNER_ASSET_TYPES không có "logo") ⇒ PARTNER_ASSET_NOT_ALLOWED. ComparisonTable.partner: cùng luật với type
//     "bảng so sánh", tên ảnh thay bằng key bảng.
// (3) Không có trường logo ở Partner (strict). Frontend KHÔNG render ảnh nào trong khối Đối tác — chỉ tên + vai trò
//     (+ mô tả); tư liệu đối tác hiện ở vị trí nội dung của nó trên trang Công nghệ, ảnh "anh-dung-ai" có nhãn S17.
// (4) partners.yaml thiếu hoặc [] ⇒ không render khối Đối tác (không tiêu đề).
// (5) keepTitleBlock: true ⇒ ảnh ra không cắt (content-model.ts ImageMeta). Bản vẽ 3D là ảnh dựng ⇒ nội dung nguồn
//     khai kind "anh-dung-ai" để có nhãn S17 (dòng 117–122). Máy không biết ảnh nào "thật sự" là ảnh dựng; khai sai
//     kind là rủi ro S17 hiện có, chặn bằng xác nhận văn bản của GMS (XQ-3), không bằng luật mới.

// ---- 9. Trạng thái form lúc build (lượt 10; contact-form.feature dòng 128–173, contact-info dòng 26–32,
//      privacy-policy dòng 73–78) ----
// Thiếu dữ liệu chờ khách ⇒ build XANH, form TẠM ĐÓNG ở cả vi/en, không làm build đỏ. Build ghi `out/form-status.json`
// (FormStatus) và trang Liên hệ render trạng thái F4 của ux-spec (§5.3; câu C-form-off) khi open = false. Số điện
// thoại (nếu có) vẫn hiện làm cách liên hệ khác. Hai lớp chặn:
//  (a) tĩnh: frontend_web đọc FormStatus lúc build; open = false ⇒ không gửi POST nào (F4);
//  (b) Worker: deploy-prod (devops) so khớp — FormStatus.open = false mà wrangler.jsonc `FORM_ENABLED` ≠ "false" ⇒ dừng
//      DEPLOY_RESULT.formStatusMismatch. Worker trả 503 FORM_DISABLED cho POST lọt vào (api.ts).
// Tắt khẩn cấp (FORM_ENABLED="false" lúc chạy) không qua build: trang vẫn render form, POST ⇒ 503 FORM_DISABLED ⇒
// frontend hiện cùng câu C-form-off, khoá nút Gửi, giữ chữ đã gõ (dòng 171–173).
export const FORM_CLOSED_REASONS = [
  "mail-not-ready",      // P12/V3: chưa có tên miền/Email Routing hoặc chưa có email nhận liên hệ đã verify
  "no-privacy-email",    // V14: Company.privacyRequestEmail thiếu
  "no-tax-id",           // N27: Company.taxId thiếu
] as const;
export const FormStatus = z.object({ open: z.boolean(), reasons: z.array(z.enum(FORM_CLOSED_REASONS)) })
  .refine((s) => s.open === (s.reasons.length === 0), "open ⇔ không có lý do");
// Biến build (thêm vào BuildEnv khi hiện thực; không phải bí mật): CONTACT_MAIL_READY="true" chỉ khi devops đã verify
// đích MAIL (V3) và Email Routing tên miền con (ADR-006). Thiếu/khác "true" ⇒ reason "mail-not-ready". SITE_ENV=test:
// qa đặt biến này để chạy từng dòng bảng Dữ liệu.
export const CONTACT_MAIL_READY = z.enum(["true", "false"]).default("false");
export const formStatusOf = (i: { mailReady: boolean; privacyRequestEmail?: string; taxId?: string }) => {
  const reasons = [
    ...(i.mailReady ? [] : ["mail-not-ready" as const]),
    ...(i.privacyRequestEmail ? [] : ["no-privacy-email" as const]),
    ...(i.taxId ? [] : ["no-tax-id" as const]),
  ];
  return { open: reasons.length === 0, reasons };
};
