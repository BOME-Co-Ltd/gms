import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Mục đích: luật Nhanh/Nhẹ (policy.yaml → prompt_only_rules QA-SPEED-ASK). Config gốc `playwright.config.ts`
// giữ nguyên (sửa nó buộc FULL); file này import và kế thừa testDir, timeout, expect, reporter (cùng
// outputFile `.results/playwright.json` mà cổng gate đọc), use/baseURL và các biến SITE_* do config gốc đặt.
//
// - Nhẹ (mặc định): E2E_WORKERS=1, bọc `taskpolicy -b`, máy không nóng.
// - Nhanh: E2E_WORKERS=3, nóng máy.
// - Nhóm chạm Worker (D1, giờ giả, hộp thư giả qua `support/control`) luôn chạy tuần tự: project
//   `acceptance-shared` đặt workers: 1. Phần còn lại (`acceptance-parallel`) chia theo FILE.
// - fullyParallel: false: không chia ca trong một file, vì memo `buildSite` (tests/support/build.ts) theo tiến trình.
// - Giả định: cổng gate so khớp theo đường dẫn file spec, không theo tên project, nên tách project này
//   không làm lệch kết quả. Mỗi spec thuộc đúng một project (testIgnore dùng cùng danh sách).
//
// Lệnh mẫu:
//   E2E_WORKERS=3 bun x playwright test -c tests/playwright.parallel.config.ts \
//     --project acceptance-shared --project acceptance-parallel <spec...>

const raw = process.env.E2E_WORKERS ?? '1';
if (!/^\d+$/.test(raw.trim()) || Number(raw) < 1) {
  throw new Error(`E2E_WORKERS phải là số nguyên >= 1, nhận được: "${raw}"`);
}
const workers = Number(raw);

// 4 spec dùng trạng thái Worker dùng chung (grep `support/control` trong tests/acceptance).
const SHARED = [
  '**/contact-form.spec.ts',
  '**/contact-contract.spec.ts',
  '**/cross-journeys.spec.ts',
  '**/visual-v-rules.spec.ts',
];

const perf = (base.projects ?? []).find((p) => p.name === 'perf');
if (!perf) throw new Error('Config gốc không còn project perf');

export default defineConfig({
  ...base,
  fullyParallel: false,
  workers,
  projects: [
    {
      name: 'acceptance-shared',
      testDir: './acceptance',
      testMatch: SHARED,
      workers: 1,
      use: { browserName: 'chromium' },
    },
    {
      name: 'acceptance-parallel',
      testDir: './acceptance',
      testIgnore: SHARED,
      use: { browserName: 'chromium' },
    },
    perf,
  ],
});
