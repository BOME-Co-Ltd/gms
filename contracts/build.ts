// Contract build và deploy site tĩnh (lượt 6, 31/10/2026 — trả lời qa XQ-QA21, appsec M36, XQ-27; XQ-29(c) M36-b).
// Máy validate: `bun x tsc --noEmit -p 02-design/contracts` (chưa kiểm — chờ admin).
// Người hiện thực: frontend_web (build, loader nội dung, content-check) · devops (deploy-prod, CI, _redirects, _headers).
import { z } from "zod";

// ---- 1. Biến build (Next `output: "export"`) ----
// CONTACT_RECIPIENT KHÔNG phải biến build: là `vars` của wrangler.test.jsonc cho Mailer giả (test-control.ts `recipient`).
export const PRODUCTION_BRANCH = "production" as const;
// Mọi luật "chỉ khi production" (design §6f thiếu approvals, §3 dưới, deploy-prod) dùng hàm này, không đọc SITE_ENV riêng.
export const isProductionBuild = (e: { SITE_ENV?: string; WORKERS_CI_BRANCH?: string }): boolean =>
  e.WORKERS_CI_BRANCH === PRODUCTION_BRANCH || e.SITE_ENV === "production";

export const BuildEnv = z.object({
  SITE_URL: z.string().url().refine((v) => !v.endsWith("/"), "SITE_URL không có '/' cuối"),
  SITE_ENV: z.enum(["test", "staging", "production"]),
  CONTENT_DIR: z.string().default("content"), // qa trỏ tới tests/fixtures/content-sample
  DATE_OVERRIDE: z.string().datetime({ offset: true }).optional(), // ngày "hôm nay" khi lọc tin theo publishedAt
  // Biến hệ thống của Workers Builds (tên nhánh của push). Không có khi build trên máy hoặc CI khác.
  WORKERS_CI_BRANCH: z.string().optional(),
}).superRefine((e, ctx) => {
  // M36: build production/staging có DATE_OVERRIDE hoặc CONTENT_DIR khác "content" ⇒ build đỏ.
  // M36-b/XQ-29(c): "production" xác định theo nhánh HOẶC SITE_ENV; một trong hai nói production thì cả hai phải
  // nói production, nếu không ⇒ đỏ. Trigger đặt nhầm SITE_ENV=test trên nhánh production không tắt được luật.
  const prod = isProductionBuild(e);
  if (prod && (e.WORKERS_CI_BRANCH !== PRODUCTION_BRANCH || e.SITE_ENV !== "production"))
    ctx.addIssue({ code: "custom", message: "PRODUCTION_ENV_MISMATCH" });
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
  wrongBranch: "BRANCH_NOT_PRODUCTION", // không --dry-run mà WORKERS_CI_BRANCH ≠ PRODUCTION_BRANCH (XQ-29(c))
  envMismatch: "PRODUCTION_ENV_MISMATCH", // BuildEnv §1: nhánh và SITE_ENV không cùng nói production
  testConfig: "TEST_CONFIG_FORBIDDEN",  // wrangler.test.jsonc hoặc main ≠ worker/index.ts (test-control.ts)
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
