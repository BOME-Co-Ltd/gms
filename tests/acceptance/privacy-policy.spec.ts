// privacy-policy.feature → PRIV-01..PRIV-07 (S25). v0.3: chính sách là file nội dung nguồn; xoá theo yêu cầu = GMS xoá thư trong hộp thư (G9).
// [giả định — chờ khách] V8, V9, V11 · [cần luật sư] · [cần hỏi admin] XQ-1(4a): nội dung thật chưa chốt;
// test chỉ kiểm sự có mặt của căn cứ/phiên bản/quyền, không kiểm câu chữ pháp lý.
import { test, expect } from '@playwright/test';
import { buildSite, htmlOf } from '../support/build';
import { companyFile } from '../support/fixtures';
import { path, type Locale } from '../support/routes';
import { bodyText, htmlLang, open, tid } from '../support/ui';

const PURPOSE: Record<Locale, RegExp[]> = {
  vi: [/mục đích/i, /(hạn lưu|thời hạn lưu|lưu trữ)/i, /(ai xem|người xem|được xem bởi|truy cập)/i, /xoá|xóa/i],
  en: [/purpose/i, /(retention|retain|stored for)/i, /(who (can )?(see|access)|access)/i, /(delete|erasure|deletion)/i],
};
for (const locale of ['vi', 'en'] as Locale[]) {
  test(`PRIV-01 Trang chính sách có ở ${locale} (@S25)`, async ({ page }) => {
    const r = await open(page, 'privacy', locale);
    expect(r).toBeUndefined();
    expect(await htmlLang(page)).toBe(locale);
    const t = await bodyText(page);
    expect(t).toMatch(/\d+\.\d+/); // số phiên bản
    expect(t).toMatch(locale === 'vi' ? /\d{2}\/\d{2}\/\d{4}/ : /\d{1,2} [A-Z][a-z]+ \d{4}/); // ngày hiệu lực theo locale
    for (const re of PURPOSE[locale]) expect(t).toMatch(re);
  });
}

const BASIS: Array<[Locale, string]> = [['vi', 'Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15'], ['en', '91/2025/QH15']];
for (const [locale, basis] of BASIS) {
  test(`PRIV-02 Chính sách dẫn đúng căn cứ đang hiệu lực (${locale}) (@S25 @kiem-luc-build)`, () => {
    const r = buildSite(companyFile({ legalName: 'Công ty Mẫu GMS' })); // N27 [giả định — chờ khách]: tên mẫu
    expect(r.ok, r.log).toBe(true);
    const t = htmlOf(r, path('privacy', locale))!.replace(/<[^>]+>/g, ' ');
    expect(t).toContain(basis);
    expect(t).not.toContain('13/2023');
    expect(t).toContain('Công ty Mẫu GMS');
    expect(t).toMatch(locale === 'vi' ? /rút (lại )?đồng ý/i : /withdraw (your )?consent/i);
    expect(t).toMatch(locale === 'vi' ? /\bxem\b[\s\S]*\bsửa\b[\s\S]*\bxoá|xóa\b/i : /access[\s\S]*(rectif|correct)[\s\S]*(delet|erasure)/i);
  });
}

test('PRIV-03 Chính sách ghi địa chỉ nhận yêu cầu về dữ liệu (@S25 @cho-khach:V14 @kiem-luc-build)', () => {
  const r = buildSite(companyFile({ privacyRequestEmail: 'dulieu@vi-du.test' }));
  expect(r.ok, r.log).toBe(true);
  expect(htmlOf(r, path('privacy', 'vi'))).toContain('dulieu@vi-du.test');
});

test('PRIV-04 Chính sách khai bên xử lý và nơi liên hệ nằm (@S25)', async ({ page }) => {
  await open(page, 'privacy', 'vi');
  const t = await bodyText(page);
  expect(t).toContain('Cloudflare');
  expect(t).toMatch(/hộp thư/i);
  expect(t).toMatch(/không lưu|không giữ/i);
});

test('PRIV-05 Liên kết cạnh ô đồng ý trỏ chính sách cùng ngôn ngữ (@S25)', async ({ page }) => {
  await open(page, 'contact', 'en'); // bản build mặc định có email nhận + tên pháp lý (XQ-21)
  const link = tid(page, 'contact-consent-block').locator('a').first();
  expect(new URL((await link.getAttribute('href'))!, page.url()).pathname).toBe(path('privacy', 'en'));
});

test('PRIV-06 Chính sách thiếu bản EN thì build đỏ (@S25 @kiem-luc-build @risk:untranslated)', async ({ page }) => {
  const r = buildSite({ 'policy/1.1.vi.md': '---\nversion: "1.1"\neffectiveFrom: "2026-11-01"\n---\nBản mới.\n' });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('Chính sách bảo mật 1.1');
  expect(r.log).toMatch(/thiếu bản "?en"?/);
  for (const locale of ['vi', 'en'] as Locale[]) { // bản đang chạy vẫn phục vụ 1.0
    await open(page, 'privacy', locale);
    const t = await bodyText(page);
    expect(t).toMatch(/1\.0/);
    expect(t).not.toMatch(/\b1\.1\b/);
  }
});

test('PRIV-07 Thiếu email nhận yêu cầu về dữ liệu thì build đỏ (@S25 @kiem-luc-build @cho-khach:V14)', () => {
  const r = buildSite(companyFile({ privacyRequestEmail: null }));
  expect(r.ok).toBe(false);
  expect(r.log).toContain('email nhận yêu cầu về dữ liệu');
});
