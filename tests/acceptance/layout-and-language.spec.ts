// layout-and-language.feature → LAY-01..LAY-06 (S1, S2). v0.3: site tĩnh; Tin mẫu nằm trong bản build mặc định (SITE_FIXTURE, XQ-21).
import { expect, test } from '@playwright/test';
import { BASE_URL } from '../support/env';
import { siteLegalName } from '../support/fixtures';
import { detailPath, type Locale, PAGE_KEYS, type PageKey, path } from '../support/routes';
import { bodyText, htmlLang, open, tid, VN_DIACRITIC } from '../support/ui';

// Thứ tự menu theo prd.md §4 = thứ tự khoá trong bảng đường dẫn (routes.ts của architect).
const NAV_MENU_ORDER: PageKey[] = [
  'home',
  'about',
  'solutions',
  'technology',
  'products',
  'news',
  'projects',
  'careers',
  'faq',
  'contact',
  'privacy',
];
// Tin mẫu cố định của bản build mặc định (XQ-21): cặp slug vi/en của Tin "phan-loai-tai-nguon" (07/11 thay doi-ngon-ngu đã xoá).
const NEWS_SAMPLE = { vi: 'phan-loai-tai-nguon', en: 'sorting-at-source' };
const NOT_FOUND = { vi: '/khong-co-trang-nay-xyz', en: '/en/this-page-does-not-exist-xyz' };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('LAY-00 Bảng đường dẫn của test bao gồm đầy đủ các trang (@S1) [tự kiểm]', () => {
  for (const k of NAV_MENU_ORDER) expect(PAGE_KEYS).toContain(k);
});

test('LAY-01 Khung trang đúng ngôn ngữ đang xem (@S1)', async ({ page }) => {
  await open(page, 'about', 'en');
  expect(await htmlLang(page)).toBe('en');
  const links = tid(page, 'nav-main').locator('a');
  // 11 trang (prd S1) chia theo ux-spec §2b (V26): menu chính 7 mục; Tuyển dụng · FAQ · Liên hệ · Chính sách ở menu phụ/ngăn kéo.
  const MAIN = NAV_MENU_ORDER.slice(0, 7);
  expect(await links.count()).toBe(MAIN.length);
  const hrefs = await links.evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
  expect(hrefs).toEqual(MAIN.map((k) => path(k, 'en')));
  // Menu phụ chỉ tính trong thanh trên (.top) hoặc ngăn kéo (#drawer), không tính liên kết cùng testid ở nơi khác (ux-spec §2b).
  const subScope = page.locator('.top, #drawer');
  for (const k of NAV_MENU_ORDER.slice(7))
    expect(
      await subScope.locator(`[data-testid="nav-menu"][href="${path(k, 'en')}"]`).count(),
      `menu phụ (thanh trên/ngăn kéo, ux-spec §2b) có ${k}`,
    ).toBeGreaterThan(0);
  // ≥1200px: ít nhất một liên kết menu phụ nhìn thấy (mở ngăn kéo trước nếu thiết kế đòi).
  await page.setViewportSize({ width: 1280, height: 800 });
  const subLinks = subScope.locator(
    NAV_MENU_ORDER.slice(7)
      .map((k) => `[data-testid="nav-menu"][href="${path(k, 'en')}"]`)
      .join(', '),
  );
  const menuBtn = page.locator('#menu-btn');
  if ((await subLinks.locator('visible=true').count()) === 0 && (await menuBtn.isVisible())) await menuBtn.click();
  expect(
    await subLinks.locator('visible=true').count(),
    'ở ≥1200px có ít nhất một liên kết menu phụ nhìn thấy',
  ).toBeGreaterThan(0);
  for (const t of await links.allInnerTexts()) expect(t, 'menu EN chứa chữ Việt').not.toMatch(VN_DIACRITIC);
  await expect(tid(page, 'footer').locator(`a[href="${path('privacy', 'en')}"]`)).toHaveCount(1);
});

test('LAY-02 Đường dẫn không tồn tại trả 404 đúng ngôn ngữ (@S1 @risk:untranslated)', async ({ page }) => {
  const r = await page.goto(NOT_FOUND.en);
  expect(r?.status()).toBe(404);
  expect(await htmlLang(page)).toBe('en');
  // Tên pháp lý là dữ liệu công ty một chuỗi không tách locale (content-model.ts Company.legalName; contact-info.feature:30 đòi chân trang en hiện tên này)
  // ⇒ loại nó ra trước khi kiểm dấu. Không nới gì khác: mọi chữ có dấu còn lại vẫn làm test đỏ. innerText áp text-transform ⇒ so khớp không phân biệt hoa/thường.
  const legal = new RegExp(
    siteLegalName()
      .trim()
      .split(/\s+/)
      .map((w) => esc(w))
      .join('\\s+'),
    'giu',
  );
  const rest = (await bodyText(page)).replace(legal, ' ');
  expect(rest, 'trang 404 en còn chữ có dấu ngoài tên pháp lý').not.toMatch(VN_DIACRITIC);
  await expect(page.locator(`a[href="${path('home', 'en')}"]`).first()).toBeVisible();
  const vi = await page.goto(NOT_FOUND.vi);
  expect(vi?.status()).toBe(404);
});

const SWITCH: Array<[string, PageKey | 'newsItem', Locale, Locale]> = [
  ['Công nghệ', 'technology', 'vi', 'en'],
  ['Chính sách bảo mật', 'privacy', 'en', 'vi'],
  ['Chi tiết Tin', 'newsItem', 'vi', 'en'],
  ['Chi tiết Tin', 'newsItem', 'en', 'vi'],
  ['Liên hệ', 'contact', 'en', 'vi'],
];
for (const [label, key, from, to] of SWITCH) {
  test(`LAY-03 Đổi ngôn ngữ giữ đúng trang: ${label} ${from}→${to} (@S2)`, async ({ page }) => {
    const urlOf = (l: Locale) => (key === 'newsItem' ? detailPath('news', NEWS_SAMPLE[l], l) : path(key, l));
    await page.goto(urlOf(from));
    await tid(page, 'lang-switcher').locator(`a[hreflang="${to}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${esc(urlOf(to))}/?$`));
    expect(new URL(page.url()).pathname.replace(/\/$/, '')).not.toBe(path('home', to).replace(/\/$/, ''));
    expect(await htmlLang(page)).toBe(to);
  });
}

// Feature: tên truy cập bằng chính ngôn ngữ đó; hình là cờ (V26/V34 admin 06/11 thay luật "không cờ").
const FLAG_EMOJI = /[\u{1F1E6}-\u{1F1FF}]|🏴|🏳/u;
test('LAY-04 Bộ chọn ngôn ngữ: cờ có tên truy cập "Tiếng Việt"/"English" (@S2, V26, V34)', async ({ page }) => {
  for (const [pageKey, locale] of [
    ['home', 'vi'],
    ['about', 'en'],
  ] as Array<[PageKey, Locale]>) {
    await open(page, pageKey, locale);
    const sw = tid(page, 'lang-switcher');
    const viLink = sw.locator('a[hreflang="vi"]');
    const enLink = sw.locator('a[hreflang="en"]');
    await expect(viLink).toBeVisible();
    await expect(enLink).toBeVisible();
    // V26/V34 (admin 06/11): cờ không chữ; tên truy cập viết bằng chính ngôn ngữ đó (prd S2).
    await expect(viLink).toHaveAttribute('aria-label', 'Tiếng Việt');
    await expect(enLink).toHaveAttribute('aria-label', 'English');
    await expect(sw.locator('svg.flag')).toHaveCount(2); // V26/V34 thay luật "không cờ" của S2 cũ
    expect(await sw.innerText(), 'emoji cờ trong bộ chọn').not.toMatch(FLAG_EMOJI);
    const label = [await viLink.getAttribute('aria-label'), await enLink.getAttribute('aria-label')].join(' ');
    expect(label, 'aria-label chứa emoji cờ').not.toMatch(FLAG_EMOJI);
  }
});

// Site tĩnh có thể KHÔNG có "đường đổi ngôn ngữ" riêng (XQ-22). Test chấp nhận hai hình: đường đó không tồn tại (404) hoặc nếu có
// thì không chuyển ra tên miền khác. Cả hai đều cho "người đọc không bị chuyển tới tên miền khác".
test('LAY-05 Đường đổi ngôn ngữ không chuyển ra trang ngoài (@S2 @risk:open-redirect)', async ({ page }) => {
  for (const p of [
    '/switch-language?to=en&next=https://example.com',
    '/en?next=https://example.com',
    '/?lang=en&next=//example.com',
  ]) {
    await page.goto(p).catch(() => undefined);
    expect(new URL(page.url()).origin, p).toBe(new URL(BASE_URL).origin);
  }
  const r = await page.goto('/switch-language?to=en&next=https://example.com');
  if (r?.status() === 200) expect(new URL(page.url()).pathname).toBe(path('home', 'en'));
  else expect([404, 410]).toContain(r?.status());
});

test('LAY-06 Không tự chuyển ngôn ngữ theo trình duyệt (@S2)', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'en-US', extraHTTPHeaders: { 'accept-language': 'en' } });
  const page = await ctx.newPage();
  const r = await page.goto(path('technology', 'vi'));
  expect(r?.status()).toBe(200);
  expect(new URL(page.url()).pathname.replace(/\/$/, '')).toBe(path('technology', 'vi'));
  expect(await htmlLang(page)).toBe('vi');
  await ctx.close();
});
