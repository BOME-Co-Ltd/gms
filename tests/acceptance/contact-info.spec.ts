// contact-info.feature → INFO-01..INFO-05 (S24). v0.3: Thông tin công ty là file nội dung nguồn (content/company.yaml).
// [giả định — chờ khách] P30 (số thật 098 799 83 70 KHÔNG đăng khi chưa có P30), N9, N27, N28, N31. Số điện thoại trong test là DỮ LIỆU MẪU.
// Trang sinh từ company.yaml khác nhau ⇒ dựng bằng buildSite (XQ-21) rồi đọc HTML; riêng bản đồ cần trình duyệt.
import { expect, test } from '@playwright/test';
import { allHtml, buildSite, htmlOf } from '../support/build';
import { companyFile } from '../support/fixtures';
import { type Locale, path } from '../support/routes';
import { open, tid } from '../support/ui';

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

const SHOWN: Array<[Locale, string]> = [
  ['vi', '090 000 00 00'],
  ['en', '+84 90 000 00 00'],
];
for (const [locale, shown] of SHOWN) {
  test(`INFO-01 SĐT và nút Zalo đúng định dạng locale ${locale} (@S24 @cho-khach:P30 @kiem-luc-build)`, () => {
    const r = buildSite(companyFile({ phone: '+84900000000', zalo: 'https://zalo.me/0900000000' }));
    expect(r.ok, r.log).toBe(true);
    const html = htmlOf(r, path('contact', locale))!;
    expect(html).toContain('href="tel:+84900000000"');
    expect(text(html)).toContain(shown);
    expect(html).toContain('href="https://zalo.me/0900000000"');
  });
}

test('INFO-02 Ô trống thì phần tương ứng ẩn hẳn, số thật không lộ (@S24 @cho-khach:P30 @cho-khach:N28 @kiem-luc-build)', () => {
  const r = buildSite(companyFile({ phone: null, zalo: null, mapUrl: null, mapImage: null, taxId: null }));
  expect(r.ok, r.log).toBe(true);
  for (const locale of ['vi', 'en'] as Locale[])
    for (const key of ['contact', 'home'] as const) {
      const html = htmlOf(r, path(key, locale))!;
      expect(html).not.toMatch(/href="tel:/);
      expect(html).not.toMatch(/zalo\.me/);
      expect(html).not.toContain('data-testid="map-block"');
      expect(html).not.toContain('data-testid="tax-id"');
    }
  expect(text(allHtml(r))).not.toMatch(/098\s?799\s?83\s?70|\+84\s?98\s?799\s?83\s?70|0987998370/);
});

test('INFO-03 Bản đồ không tải trước khi người đọc yêu cầu (@S24 @cho-khach:N28)', async ({ page }) => {
  // Bản build mặc định có "điểm bản đồ" (XQ-21).
  const scripts: string[] = [];
  page.on('request', (rq) => {
    if (rq.resourceType() === 'script') scripts.push(rq.url());
  });
  await open(page, 'contact', 'vi');
  await page.waitForLoadState('networkidle');
  const self = new URL(page.url()).origin;
  expect(
    scripts.filter((u) => new URL(u).origin !== self),
    'JS bên thứ ba trước khi chọn bản đồ',
  ).toEqual([]);
  await tid(page, 'map-open').click();
  await expect(tid(page, 'map-view')).toBeVisible();
  await expect(tid(page, 'map-view')).toHaveAttribute('data-point', /\d+\.\d+.*\d+\.\d+/);
});

test('INFO-04 Địa chỉ có bản tiếng Anh (@S24 @cho-khach:N9 @kiem-luc-build)', () => {
  const r = buildSite(companyFile({ address: { vi: 'Số 1 Đường Mẫu, Hưng Yên', en: '1 Sample Street, Hung Yen' } }));
  expect(r.ok, r.log).toBe(true);
  const t = text(htmlOf(r, path('contact', 'en'))!);
  expect(t).toContain('1 Sample Street, Hung Yen');
  expect(t).not.toContain('Số 1 Đường Mẫu');
});

test('INFO-05 Số điện thoại công khai sai dạng thì build đỏ (@S24 @kiem-luc-build)', () => {
  const r = buildSite(companyFile({ phone: '09879' }));
  expect(r.ok).toBe(false);
  expect(r.log).toMatch(/số điện thoại công khai/);
  expect(r.log).toMatch(/không phải số điện thoại Việt Nam hợp lệ/);
  // "web đang chạy vẫn hiện số của bản deploy trước": bản đang chạy không bị build đỏ này động tới — kiểm ở deploy (check-approval/CI), không ở đây.
});
