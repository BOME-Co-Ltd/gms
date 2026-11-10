// privacy-policy.feature → PRIV-01..PRIV-07 (S25). v0.3: chính sách là file nội dung nguồn; xoá theo yêu cầu = GMS xoá thư trong hộp thư (G9).
// [giả định — chờ khách] V8, V9, V11 · [cần luật sư] · [cần hỏi admin] XQ-1(4a): nội dung thật chưa chốt;
// test chỉ kiểm sự có mặt của căn cứ/phiên bản/quyền, không kiểm câu chữ pháp lý.
import { expect, test } from '@playwright/test';
import { buildSite, htmlOf } from '../support/build';
import { companyFile } from '../support/fixtures';
import { type Locale, path } from '../support/routes';
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

const BASIS: Array<[Locale, string]> = [
  ['vi', 'Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15'],
  ['en', '91/2025/QH15'],
];
for (const [locale, basis] of BASIS) {
  test(`PRIV-02 Chính sách dẫn đúng căn cứ đang hiệu lực (${locale}) (@S25 @kiem-luc-build)`, () => {
    const r = buildSite(companyFile({ legalName: 'Công ty Mẫu GMS' })); // N27 [giả định — chờ khách]: tên mẫu
    expect(r.ok, r.log).toBe(true);
    const t = htmlOf(r, path('privacy', locale))!.replace(/<[^>]+>/g, ' ');
    expect(t).toContain(basis);
    expect(t).not.toContain('13/2023');
    expect(t).toContain('Công ty Mẫu GMS');
    expect(t).toMatch(locale === 'vi' ? /rút (lại )?đồng ý/i : /withdraw (your )?consent/i);
    expect(t).toMatch(
      locale === 'vi'
        ? /\bxem\b[\s\S]*\bsửa\b[\s\S]*\bxoá|xóa\b/i
        : /access[\s\S]*(rectif|correct)[\s\S]*(delet|erasure)/i,
    );
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
  for (const locale of ['vi', 'en'] as Locale[]) {
    // bản đang chạy vẫn phục vụ 1.0
    await open(page, 'privacy', locale);
    const t = await bodyText(page);
    expect(t).toMatch(/1\.0/);
    expect(t).not.toMatch(/\b1\.1\b/);
  }
});

// privacy-policy.feature dòng 72–78 (spec v0.5, duyệt 04/11): thiếu email ⇒ build XANH, không dòng email trống, form tạm đóng.
// (Bản cũ của test này đòi build ĐỎ — trái spec đã duyệt, đã bỏ.) taxId đủ + CONTACT_MAIL_READY=true để lý do DUY NHẤT
// khiến form đóng là thiếu email (contracts/build.ts §9 FormStatus), không lẫn với thiếu MST (INFO-06).
test('PRIV-07 Thiếu email nhận yêu cầu về dữ liệu thì build xanh, chính sách không có dòng email trống, form tạm đóng (@S25 @kiem-luc-build @cho-khach:V14)', () => {
  const r = buildSite(companyFile({ privacyRequestEmail: null, taxId: '0900123456' }), { CONTACT_MAIL_READY: 'true' });
  expect(r.ok, r.log).toBe(true);
  const emailWord = { vi: /e-?mail|thư điện tử/i, en: /e-?mail/i };
  for (const locale of ['vi', 'en'] as Locale[]) {
    const html = htmlOf(r, path('privacy', locale));
    expect(html, `chính sách ${locale} phải có trong bản build`).not.toBeNull();
    expect(html, `${locale}: không liên kết mailto: rỗng`).not.toMatch(/mailto:\s*(["'?#]|$)/);
    const lines = html!
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<\/?(br|p|li|h[1-6]|div|tr|td|dt|dd)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .split('\n')
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const emptyEmailLines = lines.filter(
      (l) => emailWord[locale].test(l) && (/[:：]\s*$/.test(l) || /^(e-?mail|thư điện tử)\s*[:：]?$/i.test(l)),
    );
    expect(emptyEmailLines, `${locale}: dòng nhãn email không có địa chỉ`).toEqual([]);
    expect(lines.join('\n'), `${locale}: không lộ giá trị rỗng`).not.toMatch(/\bundefined\b|\bnull\b|\[object|\{\{/);
    expect(htmlOf(r, path('contact', locale)), `form ${locale} tạm đóng`).not.toContain('data-testid="contact-form"');
  }
  const status = JSON.parse(r.read('form-status.json') ?? '{}');
  expect(status.open).toBe(false);
  expect(status.reasons, 'chỉ một lý do: thiếu email nhận yêu cầu dữ liệu').toEqual(['no-privacy-email']);
});

const sentencesOf = (t: string): string[] =>
  t
    .split(/[.\n]/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

// privacy-policy.feature dòng 48–58 (v0.5.1): hạn 7 ngày (liên hệ chưa gửi được thư) và 14 ngày (bản khôi phục của Cloudflare).
const RETENTION: Array<[Locale, string, string]> = [
  ['vi', '7 ngày', '14 ngày'],
  ['en', '7 days', '14 days'],
];
for (const [locale, held, copy] of RETENTION) {
  test(`PRIV-08 Chính sách nêu hạn giữ liên hệ chưa gửi được thư (${held}) và hạn bản khôi phục kỹ thuật (${copy}) (${locale}) (@S25 @risk:pii-log)`, async ({
    page,
  }) => {
    await open(page, 'privacy', locale);
    const t = await bodyText(page);
    const sentences = sentencesOf(t);
    const heldAt = sentences.flatMap((s, i) => (s.includes(held) ? [i] : []));
    expect(heldAt.length, `phải có câu nêu "${held}"`).toBeGreaterThan(0);
    // Spec: "bị web giữ tối đa <mốc> rồi xoá" — không đòi "giữ" và "xoá" nằm cùng một câu ⇒ xét câu có mốc và câu liền sau (cách ngắt câu là giả định của test, không phải của spec).
    // Hai bản cùng một tiêu chí: vi khớp gốc từ "giữ|lưu"; en khớp theo gốc từ cho mọi dạng chia (held/kept/stored/retained/retention…), không chỉ dạng nguyên mẫu.
    expect(
      heldAt.some((i) => {
        const s = `${sentences[i]} ${sentences[i + 1] ?? ''}`;
        return locale === 'vi'
          ? /(giữ|lưu)/i.test(s) && /xoá|xóa/i.test(s)
          : /(hold|held|keep|kept|stor|retain|retention|saved?)/i.test(s) &&
              /(delet|remov|erase|erasure|purg|discard)/i.test(s);
      }),
      `"${held}": câu nêu việc giữ rồi xoá. Các câu chứa mốc (cùng câu liền sau): ${JSON.stringify(
        heldAt.map((i) => `${sentences[i]} ${sentences[i + 1] ?? ''}`.trim()),
      )}`,
    ).toBe(true);
    const copySentence = sentences.filter((s) => s.includes(copy));
    expect(copySentence.length, `phải có câu nêu "${copy}"`).toBeGreaterThan(0);
    expect(
      copySentence.some((s) => s.includes('Cloudflare') || /khôi phục|restor|recover|backup|copy|bản sao/i.test(s)),
      `"${copy}": câu nêu bản khôi phục kỹ thuật của Cloudflare`,
    ).toBe(true);
    expect(t, 'bản khôi phục tự hết hạn').toMatch(locale === 'vi' ? /(tự )?hết hạn/i : /expire/i);
    expect(t, 'tính từ lúc nhận liên hệ').toMatch(
      locale === 'vi' ? /từ (lúc|khi) (nhận|tiếp nhận)/i : /(from|since|after).{0,40}(receiv|submi|receipt)/i,
    );
    const encClaim = sentences.filter((s) =>
      locale === 'vi'
        ? /mã hoá|mã hóa/i.test(s) && /(lưu|giữ|D1|liên hệ)/i.test(s)
        : /encrypt/i.test(s) && /(stor|held|retain|contact)/i.test(s),
    );
    expect(encClaim, 'không nêu dữ liệu liên hệ lưu phía web được mã hoá').toEqual([]);
  });
}

// privacy-policy.feature dòng 41–46 và 48–58: thời hạn lưu liên hệ chỉ có ba mốc — 24 tháng (hộp thư GMS), 7 ngày (web giữ khi chưa gửi được thư),
// 14 ngày (bản khôi phục của Cloudflare). Quyết định admin 05/11: câu "24 giờ / 24 hours" về lưu/xoá liên hệ (khối chữ cứng trong renderPrivacyPage) trái spec.
const RETENTION_ONCE: Array<[Locale, string, string, string, string, RegExp, RegExp]> = [
  ['vi', '7 ngày', '14 ngày', '24 tháng', '24 giờ', /(?<![\d.,])24 giờ(?!\p{L})/iu, /(giữ|lưu|xoá|xóa|hết hạn)/i],
  [
    'en',
    '7 days',
    '14 days',
    '24 months',
    '24 hours',
    /(?<![\d.,])24[- ]hours?(?![\p{L}])/iu,
    /(hold|held|keep|kept|stor|retain|retention|delet|remov|erase|purg|expire)/i,
  ],
];
for (const [locale, held, copy, mailbox, dayHours, hoursRe, keepRe] of RETENTION_ONCE) {
  test(`PRIV-09 Chính sách không còn mốc "${dayHours}" về lưu liên hệ, có hạn lưu hộp thư GMS "${mailbox}", mốc "${held}"/"${copy}" mỗi mốc một lần (${locale}) (@S25 @risk:pii-log)`, async ({
    page,
  }) => {
    await open(page, 'privacy', locale);
    const t = await bodyText(page);
    const sentences = sentencesOf(t);
    const countOf = (needle: string) => {
      const [n, unit] = needle.split(' ');
      return sentences.filter((s) => new RegExp(`(?<![\\d.,])${n} ${unit}(?![\\p{L}])`, 'iu').test(s)).length;
    };

    // (1) Không còn câu "24 giờ" nói về lưu/giữ/xoá liên hệ (trái dòng 51: web giữ tối đa 7 ngày rồi xoá; dòng 46: hộp thư 24 tháng).
    const dayHourRetention = sentences.filter((s) => hoursRe.test(s) && keepRe.test(s));
    expect(dayHourRetention, `câu nêu "${dayHours}" gắn với lưu/giữ/xoá liên hệ trái spec`).toEqual([]);

    // (2) Hạn lưu thư liên hệ trong hộp thư GMS là tối đa 24 tháng (dòng 46) — mốc và "hộp thư/mailbox" trong cùng câu hoặc câu liền kề.
    const mailboxAt = sentences.flatMap((s, i) => (s.includes(mailbox) ? [i] : []));
    expect(mailboxAt.length, `phải có câu nêu "${mailbox}"`).toBeGreaterThan(0);
    expect(
      mailboxAt.some((i) =>
        (locale === 'vi' ? /hộp thư/i : /(mailbox|inbox)/i).test(
          [sentences[i - 1], sentences[i], sentences[i + 1]].filter(Boolean).join(' '),
        ),
      ),
      `"${mailbox}": câu nêu hạn lưu trong hộp thư GMS. Các câu chứa mốc: ${JSON.stringify(mailboxAt.map((i) => sentences[i]))}`,
    ).toBe(true);

    // (3) Mốc 7 ngày và 14 ngày mỗi mốc xuất hiện đúng một câu — không câu nhắc lại/mâu thuẫn.
    expect(countOf(held), `số câu chứa "${held}"`).toBe(1);
    expect(countOf(copy), `số câu chứa "${copy}"`).toBe(1);
  });
}
