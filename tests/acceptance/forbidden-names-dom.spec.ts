// test-plan.md 0k E (Q14-3) / XQ-43 mở rộng — quét tên cấm trên DOM SAU KHI JS chạy.
//   E43-01 (outerHTML) · E43-02 (innerText) mọi route routes.ts × vi, en trên bản build đang chạy (BASE_URL)
//   E43-03 mọi .html dưới out/ (gồm tệp chép từ public/ và 404.html), liệt kê bằng quét thư mục
//   E43-04 ca chứng minh bắt được: fixture CHỈ ở bản chép thư mục tạm (không vào public/ thật, không vào bản deploy)
// Nguồn: threat-model.md :98, :112, :118; design.md :213 (4). "Xanh Asian" chỉ là DỮ LIỆU của danh sách cấm.
// Gọi findForbiddenNames của contract, không chép lại hàm.
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { findForbiddenNames } from '../../contracts/content-model.ts';
import { buildSite } from '../support/build';
import { PAGE_KEYS, type Locale, path } from '../support/routes';
import { listHtml, serveDir, urlOfHtml } from '../support/static-server';

const NAMES = ['Xanh Asian'];
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../out');
const LOCALES: Locale[] = ['vi', 'en'];

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300); // useEffect / hydrate sau tải
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

test('E43-03 Mọi tệp .html dưới out/ (gồm tệp từ public/ và 404.html) mở trong trình duyệt: outerHTML và innerText không nêu tên cấm', async ({
  page,
}) => {
  expect(existsSync(OUT), `chưa có ${OUT} — chạy bun run build:e2e trước`).toBe(true);
  const files = listHtml(OUT);
  expect(files.length, 'out/ phải có tệp .html').toBeGreaterThan(0);
  expect(files, 'phải gồm 404.html (không thuộc route nào)').toContain('404.html');
  const srv = await serveDir(OUT);
  try {
    const bad: string[] = [];
    for (const rel of files) {
      await page.goto(`${srv.origin}${urlOfHtml(rel)}`);
      await settle(page);
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
// Ghi chú chênh: (3) là tệp public/ có script chạy sau tải — tương đương hành vi thành phần React `useEffect`; qa không dựng được thành phần
// React vì không sửa src/. Trình dựng chính thức có đường React hay không: xem test-plan 0l (R-01, chưa áp dụng được).
const PAGES: Array<[string, string, string]> = [
  ['E43-04a', 'qa-nbsp.html', '<p>Xanh&nbspAsian</p>'],
  ['E43-04b', 'qa-numeric.html', '<p>Xanh&#32Asian</p>'],
  [
    'E43-04c',
    'qa-late.html',
    `<div id="late-root"></div><script>setTimeout(function(){var p=document.createElement('p');p.id='late';p.textContent=['Xanh','Asian'].join(' ');document.getElementById('late-root').appendChild(p)},50)</script>`,
  ],
];

test('E43-04 Fixture chỉ lộ tên trong DOM: build XANH (quét tĩnh không thấy) nhưng quét DOM bắt được, nêu trang', async ({ page }) => {
  const overlay: Record<string, string> = {};
  for (const [, file, body] of PAGES)
    overlay[`public/${file}`] = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>qa</title></head><body>${body}</body></html>`;
  const r = buildSite({}, { SITE_ENV: 'test' }, overlay);
  // Nếu build đã đỏ ở bước quét tĩnh thì tầng quét tĩnh đã đổi phạm vi (L-03/L-04): báo appsec, không sửa test cho xanh.
  expect(r.ok, `build phải xanh với 3 fixture này (nếu đỏ: báo appsec M40-d)\n${r.log}`).toBe(true);
  const srv = await serveDir(r.outDir);
  try {
    for (const [id, file] of PAGES) {
      expect(r.has(file), `${id}: ${file} phải được chép sang out/`).toBe(true);
      await page.goto(`${srv.origin}/${file}`);
      if (file === 'qa-late.html') await page.waitForSelector('#late');
      await settle(page);
      const got = await scan(page);
      expect(got.html, `${id} ${file}: outerHTML phải bị bắt`).toEqual(NAMES);
      expect(got.text, `${id} ${file}: innerText phải bị bắt`).toEqual(NAMES);
    }
  } finally {
    await srv.close();
  }
});
