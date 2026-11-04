import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

// XQ-21 (bàn giao 05/11 bước 1): lệnh build/deploy + thư mục nền cho ca @kiem-luc-build. Env ngoài đặt sẵn thì giữ.
// support/build.ts tách lệnh theo dấu cách ⇒ đường dẫn repo không được có dấu cách.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (ROOT.includes(' ')) throw new Error(`Đường dẫn repo có dấu cách, SITE_BUILD_CMD sẽ tách sai: ${ROOT}`);
process.env.SITE_BUILD_CMD ??= `bun ${ROOT}/scripts/content/build-site.ts`;
process.env.SITE_FIXTURE_ROOT ??= `${ROOT}/tests/fixtures/site-root`;
process.env.SITE_DEPLOY_CMD ??= `bun ${ROOT}/scripts/deploy/deploy-prod.ts`;

// Trạng thái dùng chung của Worker (D1, giờ giả, hộp thư giả) ⇒ chạy tuần tự; spec form tự control.reset() ở beforeEach.
// Site tĩnh + Worker cùng origin dưới `wrangler dev --local` (cổng 8787).
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['json', { outputFile: '.results/playwright.json' }]],
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:8787', trace: 'retain-on-failure' },
  projects: [
    { name: 'acceptance', testDir: './acceptance', use: { browserName: 'chromium' } },
    { name: 'perf', testDir: './perf', timeout: 600_000, use: { browserName: 'chromium' } },
  ],
});
