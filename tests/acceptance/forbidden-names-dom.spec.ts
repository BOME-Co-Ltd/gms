// test-plan.md 0k E (Q14-3) / XQ-43 mở rộng — quét tên cấm trên DOM SAU KHI JS chạy.
//   E43-01 (outerHTML) · E43-02 (innerText) mọi route routes.ts × vi, en trên bản build đang chạy (BASE_URL)
//   E43-03 mọi .html dưới out/ (liệt kê bằng quét thư mục, gồm 404.html)
//   E43-04 ca chứng minh bắt được: fixture CHỈ ở out/ tạm do test dựng (không vào public/ thật, không vào bản deploy) — test-plan 0n
// Nguồn: threat-model.md :98, :112, :118; design.md :213 (4). "Xanh Asian" chỉ là DỮ LIỆU của danh sách cấm.
// Gọi findForbiddenNames của contract, không chép lại hàm.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { findForbiddenNames } from '../../contracts/content-model.ts';
import { scanOutputForForbiddenNames } from '../../src/content/rules/names.ts';
import { type Locale, PAGE_KEYS, path } from '../support/routes';
import { listHtml, serveDir, urlOfHtml } from '../support/static-server';

const NAMES = ['Xanh Asian'];
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../out');
const LOCALES: Locale[] = ['vi', 'en'];

async function settle(page: Page, ms = 300) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(ms); // useEffect / hydrate sau tải
}
const scan = async (page: Page) => ({
  html: findForbiddenNames(await page.evaluate(() => document.documentElement.outerHTML), NAMES),
  text: findForbiddenNames(await page.evaluate(() => document.body.innerText), NAMES),
});

for (const locale of LOCALES)
  for (const key of PAGE_KEYS) {
    test(`E43-01/02 ${key} (${locale}): outerHTML và innerText sau khi JS chạy không nêu tên cấm`, async ({ page }) => {
      const res = await page.goto(path(key, locale));
      expect(res?.status()).toBe(200);
      await settle(page);
      const got = await scan(page);
      expect(got.html, 'E43-01 outerHTML').toEqual([]);
      expect(got.text, 'E43-02 innerText').toEqual([]);
    });
  }

test('E43-03 Mọi tệp .html dưới out/ (gồm 404.html) mở trong trình duyệt: outerHTML và innerText không nêu tên cấm', async ({
  page,
}) => {
  test.setTimeout(600_000); // nhiều tệp .html × (tải + chờ) vượt 90 giây mặc định (đổi 0n)
  // Chỉ quét thứ out/ chứa: chặn mọi yêu cầu ra ngoài loopback để networkidle không chờ mạng ngoài.
  await page.route('**/*', (route) =>
    /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(route.request().url()) ? route.continue() : route.abort(),
  );
  expect(existsSync(OUT), `chưa có ${OUT} — chạy bun run build:e2e trước`).toBe(true);
  const files = listHtml(OUT);
  expect(files.length, 'out/ phải có tệp .html').toBeGreaterThan(0);
  expect(files, 'phải gồm 404.html (không thuộc route nào)').toContain('404.html');
  const srv = await serveDir(OUT);
  try {
    const bad: string[] = [];
    for (const rel of files) {
      await page.goto(`${srv.origin}${urlOfHtml(rel)}`);
      await settle(page, 150);
      const got = await scan(page);
      if (got.html.length) bad.push(`${rel}: outerHTML ${JSON.stringify(got.html)}`);
      if (got.text.length) bad.push(`${rel}: innerText ${JSON.stringify(got.text)}`);
    }
    expect(bad, 'tệp nêu tên cấm sau khi JS chạy').toEqual([]);
  } finally {
    await srv.close();
  }
});

// --- E43-04: ca chứng minh BẮT ĐƯỢC ---------------------------------------------------------------------------------
// Ba tệp tĩnh chỉ lộ tên ở DOM: (1) "Xanh&nbspAsian" (2) "Xanh&#32Asian" — thực thể thiếu ";" mà luật quét tệp không giải (L-03/L-04 = []),
// trình duyệt thì giải; (3) chữ chỉ sinh sau tải (setTimeout) từ mảnh ghép, nên không có trong tệp tĩnh.
// Đổi 0n: build chỉ chép một số đường từ public/ (og/default.png, brand/*, favicon/icon.svg, img/**) nên không đặt fixture .html qua build.
// Test dựng out/ TẠM chứa đúng 3 tệp; "build xanh" được thay bằng gọi thẳng hàm quét tĩnh của build (cùng hàm M40-0x ở mức đơn vị).
const PAGES: Array<[string, string, string]> = [
  ['E43-04a', 'qa-nbsp.html', '<p>Xanh&nbspAsian</p>'],
  ['E43-04b', 'qa-numeric.html', '<p>Xanh&#32Asian</p>'],
  [
    'E43-04c',
    'qa-late.html',
    `<div id="late-root"></div><script>setTimeout(function(){var p=document.createElement('p');p.id='late';p.textContent=['Xanh','Asian'].join(' ');document.getElementById('late-root').appendChild(p)},50)</script>`,
  ],
];

test('E43-04 Fixture chỉ lộ tên trong DOM: quét tĩnh out/ không thấy nhưng quét DOM bắt được, nêu trang', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'qa-dom-out-'));
  for (const [, file, body] of PAGES)
    writeFileSync(
      join(dir, file),
      `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>qa</title></head><body>${body}</body></html>`,
    );
  const srv = await serveDir(dir);
  try {
    // Nếu quét tĩnh bắt được thì tầng quét tĩnh đã đổi phạm vi (L-03/L-04): báo appsec, không sửa test cho xanh.
    expect(
      scanOutputForForbiddenNames(dir, NAMES),
      'quét tĩnh không được thấy 3 fixture này (nếu thấy: báo appsec M40-d)',
    ).toEqual([]);
    for (const [id, file] of PAGES) {
      await page.goto(`${srv.origin}/${file}`);
      if (file === 'qa-late.html') await page.waitForSelector('#late');
      await settle(page);
      const got = await scan(page);
      expect(got.html, `${id} ${file}: outerHTML phải bị bắt`).toEqual(NAMES);
      expect(got.text, `${id} ${file}: innerText phải bị bắt`).toEqual(NAMES);
    }
  } finally {
    await srv.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
