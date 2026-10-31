// Cấu hình môi trường test. Không có giá trị nào ở đây là dữ kiện của khách.
// Kiến trúc mới (lượt 5): site tĩnh + Worker `gms-contact`; test chạy trên `wrangler dev --local` (cùng origin cho tĩnh + /api/contact).
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8787';

// Cửa điều khiển adapter kiểm thử của Worker (giờ giả, hộp thư giả, tiêm lỗi, đếm IP). CHỈ có dưới `wrangler dev --local`;
// ở production không có (appsec kiểm). Hình dạng cửa CHƯA có contract ⇒ xem test-plan.md XQ-20.
export const CONTROL_URL = process.env.TEST_CONTROL_URL ?? `${BASE_URL}/__test__`;

// Bản build site chạy kiểm lúc build (@kiem-luc-build): lệnh + thư mục nội dung giả. CHƯA có contract ⇒ XQ-21.
export const BUILD_CMD = process.env.SITE_BUILD_CMD ?? '';
export const FIXTURE_ROOT = process.env.SITE_FIXTURE_ROOT ?? '';

// Bước "deploy production" (chặn khi thiếu content/approvals/<băm>.yaml). Lệnh chạy được ở chế độ khô (--dry-run). CHƯA có contract ⇒ XQ-21.
export const DEPLOY_PRODUCTION_CMD = process.env.SITE_DEPLOY_CMD ?? '';

// Tên miền chính thức: [giả định — chờ khách] P12. Build phải nhận SITE_URL = giá trị này khi chạy test.
export const CANONICAL_ORIGIN = process.env.CANONICAL_ORIGIN ?? 'https://gms.example.test';

// Token Turnstile thử của Cloudflare (luôn qua) — dùng với sitekey thử khi chạy local.
export const TURNSTILE_TEST_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
