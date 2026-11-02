// content-pages.feature → PAGE-01..PAGE-15 (S6, S8–S11, S14–S16). v0.3: nội dung là file nguồn, không còn CMS.
// [giả định — chờ khách] P2, P16, P8, P19, N3, N19, N4, N21, N5, N16, N26, P31..P35. QA kiểm sự CÓ MẶT của khối, không kiểm bố cục.
// Ca "đọc trang trên bản đang chạy" dùng bản build mặc định (SITE_FIXTURE, XQ-21); ca cần nội dung riêng dựng bằng buildSite.
import { expect, test } from '@playwright/test';
import { allHtml, buildSite, count, type Files, htmlOf, newsFiles } from '../support/build';
import { pageFile, yamlItem } from '../support/fixtures';
import { detailPath, type Locale, path } from '../support/routes';
import { bodyText, open, tid, VN_DIACRITIC } from '../support/ui';

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const OUTPUT_NAMES: Array<[string, 'sang-tuyen' | 'vpd']> = [
  ['nilon', 'sang-tuyen'],
  ['mùn hữu cơ', 'sang-tuyen'],
  ['RDF', 'sang-tuyen'],
  ['syngas', 'vpd'],
  ['than hoạt tính', 'vpd'],
  ['dầu tái chế', 'vpd'],
];

test('PAGE-01 Trang chủ có đủ khối bắt buộc (@S6 @cho-khach:P2 @cho-khach:P16)', async ({ page }) => {
  await open(page, 'home', 'vi'); // bản build mặc định có ≥ 4 Tin (XQ-21)
  const t = await bodyText(page);
  expect(t).toContain('Giải pháp thông minh – Kiến tạo giá trị xanh');
  for (const p of ['Công nghệ VPD', 'Sàng tuyển', 'Tái tạo tài nguyên']) expect(t).toContain(p);
  await expect(tid(page, 'home-branches')).toBeVisible();
  await expect(tid(page, 'home-outputs').locator('li, [data-testid="output-row"]')).toHaveCount(6);
  await expect(tid(page, 'home-journey')).toBeVisible();
  const items = tid(page, 'home-news').locator('[data-testid="news-item"]');
  await expect(items).toHaveCount(3);
  expect(await page.locator(`a[href="${path('contact', 'vi')}"]`).count()).toBeGreaterThan(0);
});

test('PAGE-01b Trang chủ: 3 Tin mới nhất, mới nhất đứng đầu (@S6 @kiem-luc-build)', () => {
  const files: Files = {};
  for (const n of ['01', '02', '03', '04'])
    Object.assign(
      files,
      newsFiles(`t${n}`, {
        vi: { title: `Tin ${n}`, date: `2026-10-${n}` },
        en: { title: `News ${n}`, date: `2026-10-${n}` },
      }),
    );
  const r = buildSite(files);
  expect(r.ok, r.log).toBe(true);
  const home = htmlOf(r, path('home', 'vi'))!;
  expect(count(home, 'data-testid="news-item"')).toBe(3);
  expect(home.indexOf('Tin 04')).toBeGreaterThan(-1);
  expect(home.indexOf('Tin 04')).toBeLessThan(home.indexOf('Tin 03'));
  expect(home).not.toContain('Tin 01');
});

test('PAGE-02 Trang chủ khi chưa có Tin nào (@S6 @kiem-luc-build)', () => {
  const r = buildSite({});
  expect(r.ok, r.log).toBe(true);
  const home = htmlOf(r, path('home', 'en'))!;
  expect(home).not.toContain('data-testid="home-news"');
  expect(home).not.toMatch(/lorem/i);
});

test('PAGE-03 Giới thiệu ẩn khối chứng nhận khi không có chứng nhận (@S8 @cho-khach:N26 @cho-khach:N16)', async ({
  page,
}) => {
  await open(page, 'about', 'vi');
  await expect(tid(page, 'about-who')).toBeVisible();
  await expect(tid(page, 'about-journey')).toBeVisible();
  await expect(tid(page, 'about-values').locator('li, [data-testid="value-card"]')).toHaveCount(4);
  await expect(tid(page, 'about-certificates')).toHaveCount(0);
});

test('PAGE-04 Mỗi việc ở trang Giải pháp có lời mời liên hệ (@S9 @cho-khach:P31)', async ({ page }) => {
  await open(page, 'solutions', 'en');
  const jobs = tid(page, 'solution-item');
  await expect(jobs).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(jobs.nth(i).locator(`a[href="${path('contact', 'en')}"]`)).toHaveCount(1);
});

test('PAGE-05 Việc thứ 4 thiếu bản EN thì build đỏ (@S9 @kiem-luc-build @risk:untranslated)', async ({ page }) => {
  const r = buildSite({
    'solutions-items/viec-4.vi.md':
      '---\nkey: "viec-4"\ntitle: "Việc thứ tư"\npublished: true\nslug: "viec-4"\n---\nNội dung.\n',
  });
  expect(r.ok).toBe(false);
  expect(r.log).toMatch(/Giải pháp|solutions/i);
  expect(r.log).toMatch(/thiếu bản "?en"?/);
  for (const l of ['vi', 'en'] as Locale[]) {
    await open(page, 'solutions', l);
    await expect(tid(page, 'solution-item')).toHaveCount(3);
  } // bản đang chạy giữ nguyên
});

test('PAGE-06 Sơ đồ Công nghệ là chữ thật, song ngữ (@S10 @cho-khach:N4 @cho-khach:N21 @cho-khach:N5)', async ({
  page,
}) => {
  await open(page, 'technology', 'en');
  const d = tid(page, 'tech-diagram');
  await expect(d.locator('[data-branch="screening"]')).toHaveCount(1);
  await expect(d.locator('[data-branch="vpd"]')).toHaveCount(1);
  const text = await d.innerText();
  expect(text).not.toMatch(VN_DIACRITIC);
  expect(text.trim().length).toBeGreaterThan(20);
  expect(await d.locator('img').count(), 'nhãn không nằm trong ảnh').toBe(0);
  const alt = (await d.getAttribute('aria-label')) ?? (await d.locator('title, desc').allInnerTexts()).join(' ');
  expect(alt.trim().length).toBeGreaterThan(0);
  expect(alt).not.toMatch(VN_DIACRITIC);
  expect(text + (await bodyText(page))).not.toMatch(/Xanh\s?Asian/i);
});

test('PAGE-07 Sơ đồ đọc được ở khổ hẹp 375px (@S10)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await open(page, 'technology', 'vi');
  const sizes = await tid(page, 'tech-diagram')
    .locator('[data-stage]')
    .evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) expect(s).toBeGreaterThanOrEqual(14);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test('PAGE-08 Sáu dòng đầu ra có nhãn trạng thái (@S11 @cho-khach:N3 @cho-khach:N19)', async ({ page }) => {
  await open(page, 'products', 'vi');
  const rows = tid(page, 'output-row');
  await expect(rows).toHaveCount(6);
  const groups: Record<string, string[]> = {
    'Sàng tuyển': ['nilon', 'mùn hữu cơ', 'RDF'],
    'Công nghệ VPD': ['syngas', 'than hoạt tính', 'dầu tái chế'],
  };
  for (const [g, names] of Object.entries(groups)) {
    const group = page.locator('[data-testid="output-group"]', { hasText: g });
    for (const n of names)
      await expect(group.locator('[data-testid="output-row"]', { hasText: new RegExp(escRe(n), 'i') })).toHaveCount(1);
  }
  for (const t of await rows.allInnerTexts()) expect(t).toContain('Định hướng');
  await open(page, 'products', 'en');
  for (const t of await tid(page, 'output-row').allInnerTexts()) expect(t).toContain('Planned');
});

test('PAGE-09 Dòng đầu ra không có trạng thái thì build đỏ (@S11 @kiem-luc-build)', () => {
  const lines =
    OUTPUT_NAMES.map(([name, group]) =>
      yamlItem({
        key: name.replace(/\s/g, '-').replace(/[^ -~]/g, 'x'),
        group,
        state: name === 'dầu tái chế' ? null : 'dinh-huong',
        name: { vi: name, en: name },
        desc: { vi: 'mô tả', en: 'desc' },
      }),
    ).join('\n') + '\n';
  const r = buildSite({ 'output-lines.yaml': lines });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('dầu tái chế: chưa khai trạng thái Định hướng hay Đã có');
});

test('PAGE-10 Thư viện có mục và xem ảnh (@S14 @cho-khach:P35 @kiem-luc-build)', () => {
  const files: Files = {};
  const proj = (key: string, title: string, date: string, imgs: string[]) =>
    ['vi', 'en'].map(
      (loc) =>
        [
          `projects/${key}.${loc}.md`,
          `---\nslug: "${key}-${loc}"\nkey: "${key}"\ntitle: "${title}"\npublished: true\nsummary: "s"\ndate: "${date}"\ncategory: "c"\n---\n${imgs.map((i) => `![${loc === 'vi' ? 'Ảnh mẫu' : 'Sample'}](images/${i}.jpg)`).join('\n')}\n`,
        ] as const,
    );
  const imgs = Array.from({ length: 24 }, (_, i) => `mau-${i}`);
  for (const [k, v] of [
    ...proj('muc-cu', 'Mục cũ', '2026-09-01', imgs.slice(0, 3)),
    ...proj('muc-moi', 'Mục mới', '2026-10-01', imgs),
  ])
    files[k] = v;
  for (const i of imgs) {
    files[`images/${i}.yaml`] =
      'alt:\n  vi: "Ảnh mẫu"\n  en: "Sample"\nkind: "anh-that"\nhasPeople: false\nsource: "mẫu"\n';
    files[`images/${i}.jpg`] = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0xff, 0xd9]);
  }
  const r = buildSite(files);
  expect(r.ok, r.log).toBe(true);
  const list = htmlOf(r, path('projects', 'vi'))!;
  expect(count(list, 'data-testid="list-item"')).toBe(2);
  expect(list.indexOf('Mục mới')).toBeLessThan(list.indexOf('Mục cũ'));
  const detail = htmlOf(r, detailPath('projects', 'muc-moi-vi', 'vi'))!;
  expect(count(detail, /<img [^>]*alt="[^"]+"/)).toBeGreaterThanOrEqual(24);
});

const EMPTY: Array<[string, 'projects' | 'careers' | 'faq', string]> = [
  ['Mục Dự án/Thư viện', 'projects', 'Dự án / Thư viện'],
  ['Tin tuyển dụng', 'careers', 'Tuyển dụng'],
  ['Câu hỏi thường gặp', 'faq', 'FAQ'],
];
for (const [kind, key, label] of EMPTY) {
  test(`PAGE-11 Trang rỗng "${label}" hiện câu trạng thái rỗng (${kind}) (@S14 @S15 @S16 @kiem-luc-build)`, () => {
    const r = buildSite({});
    expect(r.ok, r.log).toBe(true);
    const html = htmlOf(r, path(key, 'vi'));
    expect(html, 'trang rỗng vẫn được sinh (200)').not.toBeNull();
    expect(html).toMatch(/data-testid="empty-state"/);
    expect(count(html!, 'data-testid="list-item"')).toBe(0);
    expect(html).toMatch(/noindex/); // seo: trang rỗng noindex, ngoài sitemap
  });
}

const job = (validThrough: string): Files => ({
  ...['vi', 'en'].reduce(
    (a, loc) => ({
      ...a,
      [`jobs/ky-thuat-vien.${loc}.md`]: `---\nslug: "ky-thuat-vien"\nkey: "ky-thuat-vien"\ntitle: "${loc === 'vi' ? 'Kỹ thuật viên vận hành' : 'Operations technician'}"\npublished: true\nvalidThrough: "${validThrough}"\nemploymentType: "FULL_TIME"\n---\n${loc === 'vi' ? 'Gửi hồ sơ tới email nhận hồ sơ' : 'Send your application to the recruiting email'}\n`,
    }),
    {},
  ),
});

test('PAGE-12 Tin tuyển dụng quá hạn tự ẩn (@S15 @kiem-luc-build @cho-khach:P33 @cho-khach:P34)', () => {
  const r = buildSite(job('2026-11-15'), { DATE_OVERRIDE: '2026-11-16' }); // ngày build theo Asia/Ho_Chi_Minh
  expect(r.ok, r.log).toBe(true);
  expect(allHtml(r)).not.toContain('Kỹ thuật viên vận hành');
  expect(htmlOf(r, detailPath('careers', 'ky-thuat-vien', 'vi'))).toBeNull();
});

test('PAGE-13 Tin tuyển dụng còn hạn hiện cách ứng tuyển (@S15 @kiem-luc-build)', () => {
  const r = buildSite(job('2026-11-15'), { DATE_OVERRIDE: '2026-11-01' });
  expect(r.ok, r.log).toBe(true);
  const html = htmlOf(r, detailPath('careers', 'ky-thuat-vien', 'vi'))!;
  expect(html).toContain('Hạn nộp: 15/11/2026');
  expect(html).toContain('Gửi hồ sơ tới email nhận hồ sơ');
  expect(html).not.toMatch(/type="file"/);
});

test('PAGE-14 FAQ hiện theo thứ tự đặt (@S16 @cho-khach:P32 @kiem-luc-build)', () => {
  const faq = (loc: 'vi' | 'en') =>
    [3, 1, 2]
      .map((i) =>
        yamlItem({
          key: `c${i}`,
          order: i,
          question: loc === 'vi' ? `Câu ${i}` : `Question ${i}`,
          answer: loc === 'vi' ? `Đáp ${i}` : `Answer ${i}`,
        }),
      )
      .join('\n') + '\n';
  const r = buildSite({ 'faq.vi.yaml': faq('vi'), 'faq.en.yaml': faq('en') });
  expect(r.ok, r.log).toBe(true);
  const html = htmlOf(r, path('faq', 'en'))!;
  const pos = [1, 2, 3].map((i) => html.indexOf(`Question ${i}`));
  expect(pos.every((p) => p > -1)).toBe(true);
  expect(pos[0]).toBeLessThan(pos[1]);
  expect(pos[1]).toBeLessThan(pos[2]);
});

void pageFile;
