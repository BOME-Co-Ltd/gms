// Contract build và deploy site tĩnh (lượt 6, 31/10/2026 — trả lời qa XQ-QA21, appsec M36, XQ-27; XQ-29(c) M36-b).
// Lượt 8 (04/11): DATE_OVERRIDE chỉ ngày; build do Deploy Hook kích không chắc có WORKERS_CI_BRANCH (§1).
// Lượt 9 (04/11): §1 nhánh (2) giữ theo appsec XQ-31.1 (CÓ có điều kiện, design.md §5b); thêm §7 luật import Worker.
// Lượt 10 (04/11): §8 mã + thông báo luật nội dung (S33, S12, S31, S24); §9 FormStatus (form tạm đóng khi thiếu V3/V14/N27).
// Lượt 14 (06/11): §2 thêm output-check; §8 luật tên không được nêu (ux-spec V41 (c)(d), appsec M40), ô ảnh trang chủ
// (V41 (b)), bỏ keepTitleBlock (V41 (e)).
// Máy validate: `bun x tsc --noEmit` (design.md "Đã kiểm").
// Người hiện thực: frontend_web (build, loader nội dung, content-check, output-check) · devops (deploy-prod, CI,
// _redirects, _headers).
import { z } from "zod";
import type { Locale } from "./api";

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
  build: "build",                  // content-check → next build ⇒ OUT_DIR → output-check (lượt 14); bước nào đỏ thì dừng
  contentCheck: "content-check",   // chỉ kiểm content/** (schema, safe-url, slugs.lock, ảnh, tên không được nêu); exit ≠ 0 khi lỗi
  outputCheck: "output-check",     // lượt 14: chỉ đọc OUT_DIR sau next build (FORBIDDEN_NAME_IN_OUTPUT, DENYLIST_IN_OUTPUT, §8)
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
// thiếu nguồn ra CẢ lỗi S7 lẫn COMPARISON_ROW_SOURCE_MISSING. Mỗi lỗi in một dòng stderr: `[<CODE>] <thông báo>`, exit ≠ 0
// (lượt 19, XQ-45: khớp code scripts/content/check.ts:18, build-site.ts:2246, :2589, :2595; trước đây ghi `<CODE>: …`).
// Thông báo tiếng Việt, trích NGUYÊN VĂN tên/giá trị trong nội dung nguồn trong nháy kép; qa so chuỗi con của thông báo
// (các cụm trong nháy ở feature), không so cả dòng. Thêm luật = sửa contract (D7).
export type ContentRuleIssue = { code: ContentRuleCode; message: string };
export const CONTENT_RULE_MESSAGES = {
  // Lượt 13 (V38/V39): bỏ ba mã luật nguồn tư liệu bên ngoài (lượt 10 PARTNER_*, lượt 12 đổi tên) — thực thể đã bỏ.
  // figures-and-claims.feature S33 phần bảng so sánh (pm sửa theo V38/V39 song song)
  COMPARISON_ROW_SOURCE_MISSING: (p: { table: string; row: string }) =>
    `bảng so sánh "${p.table}", dòng "${p.row}" thiếu nguồn`,
  COMPARISON_NUMBER_NOT_FIGURE: (p: { table: string; row: string }) =>
    `bảng so sánh "${p.table}", dòng "${p.row}" có chữ số trong ô chữ — số phải là Số liệu có nguồn`,
  COMPARISON_SHAPE: (p: { table: string; row: string }) =>
    `bảng so sánh "${p.table}", dòng "${p.row}" có số ô khác số cột`,
  // lượt 18 (backend XQ-1, admin chuyển): content/comparison-tables.yaml sai content-model.ts ComparisonTable ⇒ build đỏ,
  // MỖI vấn đề một lỗi: khoá lạ (`.strict()`, gồm khoá đã bỏ partner/techSource), ô không phải {figure} hay {text},
  // chuỗi rỗng, thiếu trường, gốc tệp không phải danh sách (`table` "(gốc tệp)", `row` "-"), hai bảng trùng `key`.
  // `table` = title.vi, thiếu thì `key`, thiếu nữa thì "#<thứ tự>"; `row` = label.vi của dòng có vấn đề, "#<thứ tự>"
  // khi thiếu nhãn, "-" khi vấn đề không thuộc dòng nào; `detail` = "<đường khoá nối ".">: <lý do>" hoặc lý do ngắn.
  // Số ô ≠ số cột CHỈ ra COMPARISON_SHAPE (ComparisonTable không tự kiểm số ô ⇒ không trùng hai mã cho một nguyên nhân).
  // Lý do chọn mã riêng thay vì dùng chung COMPARISON_SHAPE: contracts/README.md "Lượt 18".
  COMPARISON_SCHEMA_INVALID: (p: { table: string; row: string; detail: string }) =>
    `bảng so sánh "${p.table}", dòng "${p.row}" sai schema: ${p.detail}`,
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
  // lượt 13 (V39): ô ảnh cố định của M4 (content-model.ts TECHNOLOGY_IMAGE_SLOTS) có hơn một tệp cùng basename khác đuôi
  // (vd gms-sorting-line.jpg và gms-sorting-line.png) ⇒ build đỏ, nêu basename + các tệp, không tự chọn một tệp.
  IMAGE_SLOT_DUPLICATE: (p: { slot: string; files: string[] }) =>
    `ô ảnh "${p.slot}" có nhiều tệp: ${p.files.map((f) => `"${f}"`).join(", ")} — giữ đúng một tệp`,
  // lượt 14 (V41 (b)): ô trang chủ gms-before/gms-after (content-model.ts HOME_IMAGE_SLOTS) có tệp mà kind ≠ "anh-that".
  // content-pages.feature:46–51: nêu ảnh (`file`, tương đối CONTENT_DIR, vd "images/gms-after.jpg"), vị trí (`slot`) và lý do.
  IMAGE_SLOT_KIND_INVALID: (p: { slot: string; file: string; kind: string }) =>
    `ô ảnh "${p.slot}" (tệp "${p.file}") chỉ nhận ảnh chụp thật ("anh-that"), tệp khai loại "${p.kind}"`,
  // lượt 18 (khớp code e515138, src/content/rules/index.ts validateImageMetaRaw, không đổi hành vi): meta ảnh content/images/<tên>.yaml có
  // khoá không thuộc content-model.ts ImageMeta (`.strict()`; gồm khoá đã bỏ partnerAsset, techSourceAsset, keepTitleBlock)
  // ⇒ build đỏ, MỖI khoá lạ một lỗi, không lặng lẽ bỏ qua. `image` = basename của ảnh, không đuôi, không thư mục (vd
  // "gms-sorting-line"); `key` = tên khoá lạ nguyên văn. Ảnh có lỗi này không được nạp (như mọi lỗi meta ảnh).
  IMAGE_META_KEY_UNKNOWN: (p: { image: string; key: string }) =>
    `${p.image}: metadata ảnh có khoá "${p.key}" không thuộc mô hình ảnh (content-model.ts ImageMeta)`,
  // ---- Tên không được nêu (lượt 14; content-model.ts ForbiddenNames/findForbiddenNames; design.md §6f) ----
  // appsec M40 (1): thiếu tệp, sai schema hoặc `names` rỗng ⇒ đỏ ở MỌI SITE_ENV (content-check, trước next build).
  DENYLIST_MISSING: () =>
    `thiếu "content/denylist.yaml", sai dạng, hoặc danh sách "names" rỗng — luật tên không được nêu không chạy được`,
  // figures-and-claims.feature:119–124 (content-check, trước next build). `file` tương đối CONTENT_DIR (vd
  // "images/so-do-sang-tuyen.yaml"); `locale` theo hậu tố tệp `.vi.`/`.en.` hoặc khoá cuối `vi`/`en` của đường khoá YAML;
  // `field` = đường khoá YAML nối "." (vd "alt.en"), "thân bài" cho thân Markdown, "tên tệp" khi trúng đường dẫn.
  FORBIDDEN_NAME_IN_CONTENT: (p: { file: string; locale?: Locale; field?: string; name: string }) =>
    `tệp "${p.file}"${p.locale ? `, locale "${p.locale}"` : ""}${p.field ? `, trường "${p.field}"` : ""}` +
    ` nêu tên không được nêu "${p.name}"`,
  // V41 (d), appsec M40 (2): output-check, sau next build. `file` tương đối OUT_DIR (vd "en/technology.html");
  // inPath = trúng ở đường dẫn/tên tệp chứ không ở nội dung tệp.
  FORBIDDEN_NAME_IN_OUTPUT: (p: { file: string; name: string; inPath: boolean }) =>
    `bản build "${p.file}" ${p.inPath ? "có tên tệp/đường dẫn chứa" : "chứa"} tên không được nêu "${p.name}"`,
  // appsec M40 (3): OUT_DIR có tệp tên DENYLIST_PATH (ở bất kỳ thư mục con nào).
  DENYLIST_IN_OUTPUT: (p: { file: string }) =>
    `bản build có "${p.file}" — danh sách tên không được nêu không được phục vụ công khai`,
} as const;
export type ContentRuleCode = keyof typeof CONTENT_RULE_MESSAGES;
// Luật ảnh/bảng (đọc kèm content-model.ts ImageMeta, ALL_IMAGE_SLOTS, ComparisonTable; lượt 13 V38/V39, lượt 14 V41):
// (1) Không có thực thể, khối, tiêu đề, mục dải liên kết hay chú thích nào nêu nguồn tư liệu bên ngoài. Chú thích ảnh
//     chỉ là chữ cố định theo locale (src/i18n/**), không dựng từ ImageMeta.source. ImageMeta có khoá lạ (gồm khoá cũ
//     partnerAsset/techSourceAsset/keepTitleBlock) ⇒ build đỏ IMAGE_META_KEY_UNKNOWN (`.strict()`, nêu khoá; lượt 18).
// (2) Ô ảnh cố định (gms-sorting-line, gms-before, gms-after): luật chung ở content-model.ts "Ô ảnh cố định" — ô không có
//     ảnh dùng được (thiếu tệp, hoặc hasPeople thiếu consentDate) ⇒ không render; trùng basename ⇒ IMAGE_SLOT_DUPLICATE;
//     cặp Trước/Sau chỉ render khi CẢ HAI ô có ảnh dùng được, kind phải "anh-that" (IMAGE_SLOT_KIND_INVALID).
// (3) Nhãn ảnh theo kind (S17, ux-spec V24/V39): "anh-that" không nhãn; "anh-dung-ai" (gồm bản vẽ, phối cảnh, render)
//     ⇒ C29. Máy không biết ảnh nào "thật sự" là ảnh dựng; khai sai kind là rủi ro S17 hiện có, chặn bằng xác nhận
//     văn bản của GMS (XQ-3), không bằng luật mới.
// (4) Lượt 14 (V41 (e), appsec M40 (4)(5)): BỎ keepTitleBlock. Mọi ảnh ra public/img/ qua sharp, không metadata; không
//     đường nào chép tệp gốc content/images/** sang public/ hay OUT_DIR. Khung tên/chữ/logo bên khác trong ảnh: cắt/che
//     trước khi đăng + người soát ảnh cỡ gốc (design.md §6f) — máy không đọc chữ trong ảnh.
// (5) Bảng so sánh: luật COMPARISON_* trên; không có trường nguồn bên ngoài (khoá cũ ⇒ COMPARISON_SCHEMA_INVALID,
//     `.strict()`; lượt 18).
// (6) Tên không được nêu (lượt 14, design.md §6f), hai lượt quét, cùng content-model.ts findForbiddenNames:
//   (a) content-check: mọi tệp dưới CONTENT_DIR TRỪ DENYLIST_PATH và approvals/** — nội dung tệp văn bản (md frontmatter +
//       thân, yaml/yml, slugs.lock) theo từng giá trị chuỗi, và đường dẫn tương đối của MỌI tệp (gồm ảnh) ⇒
//       FORBIDDEN_NAME_IN_CONTENT. Lượt này có vì kịch bản cần nêu ảnh + locale (figures-and-claims.feature:119–124), out/ không cho biết.
//       Lượt 19 (XQ-QA-L18-1): tên (kể cả dạng viết liền) nằm trong TÊN TỆP ảnh nguồn, vd content/images/xanhasian-so-do.jpg
//       ⇒ đúng một mã FORBIDDEN_NAME_IN_CONTENT, trường "tên tệp", `file` tương đối CONTENT_DIR. Lỗi (a) dừng build trước khi
//       dựng out/ ⇒ cùng lần build KHÔNG có FORBIDDEN_NAME_IN_OUTPUT; ảnh ra public/img/ qua sharp chỉ sau khi (a) xanh (luật (4)).
//   (b) output-check: MỌI tệp dưới OUT_DIR. Đuôi thuộc OUTPUT_SCAN_BINARY_EXTENSIONS ⇒ chỉ so đường dẫn; mọi tệp khác
//       (html, xml, json, txt, js, mjs, css, svg, webmanifest, map, _headers, _redirects, không đuôi…) đọc UTF-8 (byte
//       hỏng thay U+FFFD, không bỏ tệp) và so cả nội dung lẫn đường dẫn ⇒ FORBIDDEN_NAME_IN_OUTPUT. Liệt kê đuôi NHỊ PHÂN
//       được bỏ qua, không liệt kê đuôi văn bản được quét: loại tệp mới mặc định bị quét (M40 (2)).
//   (c) output-check: tệp nào dưới OUT_DIR có tên = DENYLIST_PATH ⇒ DENYLIST_IN_OUTPUT (M40 (3)).
//   Gom mọi lỗi của một bước rồi mới dừng (như §8). Giới hạn ghi để không ai tin quá: chữ nằm TRONG ảnh/phông không
//   quét; tên viết tắt hoặc biến thể không có trong danh sách không bắt. Lượt 15: chữ dựng lúc chạy ở trình duyệt (ghép
//   chuỗi từ biến trong JS client) không bắt — người giữ phần dư ở design.md §6f, ca đo XQ-43 (qa). Lượt 16 (M40-b/c):
//   mã hoá lồng nhau giải tới NAME_SCAN_DECODE_PASSES_MAX = 3 lớp, lớp thứ 4 trở lên lọt; ký tự định dạng vô hình
//   (\p{Cf}, gồm gạch nối mềm, rộng-không) bị xoá trước khi so — content-model.ts, contracts/README.md "Lượt 16".
export const OUTPUT_SCAN_BINARY_EXTENSIONS = [
  "jpg", "jpeg", "png", "webp", "gif", "avif", "ico", "woff", "woff2", "ttf", "otf", "pdf",
] as const;

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
