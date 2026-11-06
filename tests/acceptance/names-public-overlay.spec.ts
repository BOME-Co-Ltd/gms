// test-plan.md 0m.2 — dữ kiện hành vi build thật (admin quyết 07/11): build KHÔNG chép nguyên public/ sang out/.
// Chỉ public/og/default.png, public/brand/*, favicon.ico|png, icon.svg và public/img/** (copyStaticImages) vào out/; _headers do script sinh.
// Hệ quả cho appsec: design.md đang giả định Next export chép nguyên public/ — giả định đó sai với build-site.ts.
// Ca M40-02/04/05/06 (tên trong tệp tĩnh) vì thế chuyển xuống tests/unit/names-output-scan.test.ts (dựng out/ tạm).
// Fixture chỉ ở bản chép thư mục tạm (buildSite 3 tham số); không ghi gì vào public/ thật.
import { expect, test } from '@playwright/test';
import { buildSite } from '../support/build';

test('M40-0x (đối chứng) Tệp tuỳ ý thả vào public/ của bản chép KHÔNG xuất hiện trong out/', () => {
  const r = buildSite(
    {},
    { SITE_ENV: 'test' },
    {
      'public/qa-clean.svg':
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="0" y="5">GMS</text></svg>',
    },
  );
  expect(r.ok, r.log).toBe(true);
  expect(r.has('qa-clean.svg'), 'public/ KHÔNG được chép nguyên sang out/').toBe(false);
});
