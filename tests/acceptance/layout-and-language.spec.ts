// layout-and-language.feature → LAY-01..LAY-06 (S1, S2). v0.3: site tĩnh; Tin mẫu nằm trong bản build mặc định (SITE_FIXTURE, XQ-21).
import { expect, test } from '@playwright/test';
import { BASE_URL } from '../support/env';
import { detailPath, type Locale, PAGE_KEYS, type PageKey, path } from '../support/routes';
import { bodyText, htmlLang, open, tid, VN_DIACRITIC } from '../support/ui';

// Thứ tự menu theo prd.md §4 = thứ tự khoá trong bảng đường dẫn (routes.ts của architect).
const NAV_MENU_ORDER: PageKey[] = [
  'about',
  'solutions',
  'technology',
  'products',
  'projects',
  'news',
  'careers',
  'contact',
];
// Tin mẫu cố định của bản build mặc định (XQ-21): cặp slug vi/en của Tin "doi-ngon-ngu".
const NEWS_SAMPLE = { vi: 'doi-ngon-ngu-vi', en: 'doi-ngon-ngu-en' };
const NOT_FOUND = { vi: '/khong-co-trang-nay-xyz', en: '/en/this-page-does-not-exist-xyz' };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('LAY-00 Bảng đường dẫn của test bao gồm đầy đủ các trang (@S1) [tự kiểm]', () => {
  for (const k of NAV_MENU_ORDER) expect(PAGE_KEYS).toContain(k);
});

test('LAY-01 Khung trang đúng ngôn ngữ đang xem (@S1)', async ({ page }) => {
  await open(page, 'about', 'en');
  expect(await htmlLang(page)).toBe('en');
  const links = tid(page, 'nav-main').locator('a');
  expect(await links.count()).toBe(8);
  const hrefs = await links.evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
  expect(hrefs).toEqual(NAV_MENU_ORDER.map((k) => path(k, 'en')));
  for (const t of await links.allInnerTexts()) expect(t, 'menu EN chứa chữ Việt').not.toMatch(VN_DIACRITIC);
  await expect(tid(page, 'footer').locator(`a[href="${path('privacy', 'en')}"]`)).toHaveCount(1);
});

test('LAY-02 Đường dẫn không tồn tại trả 404 đúng ngôn ngữ (@S1 @risk:untranslated)', async ({ page }) => {
  const r = await page.goto(NOT_FOUND.en);
  expect(r?.status()).toBe(404);
  expect(await htmlLang(page)).toBe('en');
  expect(await bodyText(page)).not.toMatch(VN_DIACRITIC);
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

test('LAY-04 Bộ chọn ngôn ngữ hiển thị icon cờ Việt Nam và Anh Quốc (@S2)', async ({ page }) => {
  await open(page, 'home', 'vi');
  const sw = tid(page, 'lang-switcher');
  const viLink = sw.locator('a[hreflang="vi"]');
  const enLink = sw.locator('a[hreflang="en"]');
  await expect(viLink).toBeVisible();
  await expect(enLink).toBeVisible();
  await expect(viLink.locator('svg')).toHaveCount(1);
  await expect(enLink.locator('svg')).toHaveCount(1);
  await expect(viLink).toHaveAttribute('title', 'Tiếng Việt');
  await expect(enLink).toHaveAttribute('title', 'English');
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
