import { defineConfig } from '@playwright/test';

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
