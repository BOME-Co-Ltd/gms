// news-and-journey.feature → NEWS-01..NEWS-12 (S12, S13, S31). v0.3: Tin là file nội dung nguồn; luật = kiểm lúc build.
// [giả định — chờ khách] N18 (không bước nào "đang làm"), P21 (chưa bài fanpage nào được GMS chọn), P8.
// Ca đọc danh sách/ngày/404 dựng từ nội dung giả rồi đọc đầu ra build (support/build.ts, XQ-21): không cần trình duyệt.
import { expect, test } from '@playwright/test';
import { allHtml, buildSite, count, type Files, htmlOf, newsFiles } from '../support/build';
import { detailPath, newsPage, path } from '../support/routes';

const many = (n: number): Files =>
  Object.assign(
    {},
    ...Array.from({ length: n }, (_, i) => {
      const d = String(i + 1).padStart(2, '0');
      return newsFiles(`n${d}`, {
        vi: { title: `Tin n${d}`, date: `2026-09-${d}` },
        en: { title: `News n${d}`, date: `2026-09-${d}` },
      });
    }),
  );

// Lộ trình: content/journey-steps.yaml = JourneyStep[] {order, name{vi,en}, status?} (content-model.ts). Dựng từ nội dung giả rồi đọc HTML build
// (news-and-journey.feature dòng 9, 17, 23; spec v0.5 N18). Tên EN là dữ liệu mẫu của test (spec chỉ ghi tên vi).
const STEP_NAMES = [
  ['Đánh giá hiện trạng', 'Current-state assessment'],
  ['Tổ chức mặt bằng', 'Site organisation'],
  ['Cải tạo hạ tầng', 'Infrastructure upgrade'],
  ['Triển khai công nghệ', 'Technology rollout'],
  ['Hoàn thiện hệ thống vận hành', 'Operations system completion'],
];
const journeyFile = (statuses: Array<string | null>): Files => ({
  'journey-steps.yaml': STEP_NAMES.map(
    ([vi, en], i) =>
      `- order: ${i + 1}\n  name:\n    vi: "${vi}"\n    en: "${en}"\n${statuses[i] ? `  status: "${statuses[i]}"\n` : ''}`,
  ).join(''),
});
// Tách các phần tử data-testid="journey-step" (phần tử cuối cắt tại thẻ đóng danh sách/khu vực kế tiếp).
const stepTexts = (html: string): string[] =>
  html
    .split('data-testid="journey-step"')
    .slice(1)
    .map((chunk, i, all) => (i === all.length - 1 ? chunk.split(/<\/(?:ol|ul|section)>/i)[0] : chunk))
    .map((chunk) =>
      chunk
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );

test('NEWS-01 Trang Tin tức có lộ trình 5 bước, bước 1–3 mang nhãn "đang làm", bước 4–5 không nhãn (@S12 @kiem-luc-build @cho-khach:N18)', () => {
  const r = buildSite(journeyFile(['đang làm', 'đang làm', 'đang làm', null, null]));
  expect(r.ok, r.log).toBe(true);
  const texts = stepTexts(htmlOf(r, path('news', 'vi'))!);
  expect(texts, 'đúng 5 bước').toHaveLength(5);
  STEP_NAMES.forEach(([vi], i) => {
    expect(texts[i], `bước ${i + 1} đúng thứ tự tên`).toContain(vi);
  });
  texts.forEach((t, i) => {
    const labelled = /đang làm/i.test(t);
    expect(labelled, `bước ${i + 1} (${STEP_NAMES[i][0]}): nhãn "đang làm"`).toBe(i < 3);
    expect(t, `bước ${i + 1}: không nhãn khác`).not.toMatch(/đã xong|chưa tới/i);
  });
  expect(
    texts.filter((t) => /đang làm/i.test(t)),
    'đúng 3 nhãn "đang làm"',
  ).toHaveLength(3);
});

// news-and-journey.feature dòng 17. Nhãn vi theo chữ spec; nhãn EN spec không ghi ⇒ khớp theo nghĩa (điểm mơ hồ gửi PM).
test('NEWS-13 Bước đã xong mang nhãn "đã xong", bước đang làm mang nhãn "đang làm" ở cả vi và en (@S12 @kiem-luc-build)', () => {
  const r = buildSite(journeyFile(['đã xong', 'đang làm', null, null, null]));
  expect(r.ok, r.log).toBe(true);
  const vi = stepTexts(htmlOf(r, path('news', 'vi'))!);
  const en = stepTexts(htmlOf(r, path('news', 'en'))!);
  expect(vi, 'vi: 5 bước').toHaveLength(5);
  expect(en, 'en: 5 bước').toHaveLength(5);
  expect(vi[0], 'vi: Đánh giá hiện trạng').toContain('đã xong');
  expect(vi[0]).not.toMatch(/đang làm/i);
  expect(vi[1], 'vi: Tổ chức mặt bằng').toContain('đang làm');
  expect(vi[1]).not.toMatch(/đã xong/i);
  expect(en[0], 'en: bước 1 nhãn hoàn thành').toMatch(/\b(done|completed?|finished)\b/i);
  expect(en[0]).not.toMatch(/in progress|ongoing|under way|underway|in the works/i);
  expect(en[1], 'en: bước 2 nhãn đang làm').toMatch(/in progress|ongoing|under way|underway|in the works|current/i);
  expect(en[1]).not.toMatch(/\b(done|completed?|finished)\b/i);
});

// news-and-journey.feature dòng 23.
test('NEWS-14 Trạng thái bước ngoài danh sách cho phép thì build đỏ, thông báo nêu bước và trạng thái (@S12 @kiem-luc-build)', () => {
  const r = buildSite(journeyFile([null, null, 'sắp xong', null, null]));
  expect(r.ok).toBe(false);
  expect(r.log).toContain('bước 3 có trạng thái "sắp xong" không thuộc "chưa tới", "đang làm", "đã xong"');
});

test('NEWS-02 Danh sách Tin mới nhất trước, phân trang 12 bài (@S12 @kiem-luc-build)', () => {
  const r = buildSite(many(13));
  expect(r.ok, r.log).toBe(true);
  const p1 = htmlOf(r, path('news', 'vi'))!;
  expect(count(p1, 'data-testid="news-item"')).toBe(12);
  expect(p1.indexOf('Tin n13')).toBeGreaterThan(-1);
  expect(p1.indexOf('Tin n13')).toBeLessThan(p1.indexOf('Tin n12')); // mới nhất đứng đầu
  expect(p1).not.toContain('Tin n01');
  const p2 = htmlOf(r, newsPage(2, 'vi'))!;
  expect(count(p2, 'data-testid="news-item"')).toBe(1);
  expect(p2).toContain('Tin n01');
});

test('NEWS-03 Số trang vượt quá thì trả 404 (@S12 @kiem-luc-build)', () => {
  const r = buildSite(many(13));
  expect(r.ok, r.log).toBe(true);
  expect(htmlOf(r, newsPage(5, 'en')), 'không sinh trang 5 ⇒ Static Assets trả 404.html').toBeNull();
  expect(htmlOf(r, newsPage(1, 'en')), 'trang 1 chỉ ở /en/news').toBeNull();
});

for (const [locale, shown] of [
  ['vi', '30/10/2026'],
  ['en', '30 October 2026'],
] as const) {
  test(`NEWS-04 Ngày đăng theo định dạng locale ${locale} (@S13 @kiem-luc-build)`, () => {
    const r = buildSite(
      newsFiles('hanh-trinh-08', {
        vi: { slug: 'hanh-trinh-08', date: '2026-10-30' },
        en: { slug: 'journey-08', date: '2026-10-30' },
      }),
    );
    expect(r.ok, r.log).toBe(true);
    expect(htmlOf(r, detailPath('news', locale === 'vi' ? 'hanh-trinh-08' : 'journey-08', locale))).toContain(shown);
  });
}

test('NEWS-05 Tin đánh dấu không đăng thì không có trong bản build (@S13 @kiem-luc-build)', () => {
  const r = buildSite(
    newsFiles('hanh-trinh-09', {
      vi: { slug: 'hanh-trinh-09', title: 'Hành trình 09', published: false },
      en: { slug: 'journey-09', title: 'Journey 09', published: false },
    }),
  );
  expect(r.ok, r.log).toBe(true);
  expect(r.has('tin-tuc/hanh-trinh-09/index.html') || r.has('tin-tuc/hanh-trinh-09.html')).toBe(false);
  expect(r.has('en/news/journey-09/index.html') || r.has('en/news/journey-09.html')).toBe(false);
  for (const f of r.files().filter((x) => /\.(html|xml|json|txt|js)$/.test(x)))
    expect(r.read(f), f).not.toContain('Hành trình 09');
});

test('NEWS-06 Tin được đăng thiếu bản EN thì build đỏ (@S13 @kiem-luc-build @risk:untranslated)', () => {
  const f = newsFiles('hanh-trinh-10', { vi: { title: 'Hành trình 10' } });
  delete f['news/hanh-trinh-10.en.md'];
  const r = buildSite(f);
  expect(r.ok).toBe(false);
  expect(r.log).toContain('Hành trình 10');
  expect(r.log).toMatch(/thiếu bản "?en"?/);
});

test('NEWS-07 HTML thô trong thân bài không ra trang (@S13 @kiem-luc-build)', () => {
  const body = '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n';
  const r = buildSite(newsFiles('hanh-trinh-11', { vi: { slug: 'hanh-trinh-11' }, body }));
  // Hai cách chấp nhận (design §6f G1): build đỏ vì token lạ, HOẶC build xanh và không có thẻ/thuộc tính chạy được.
  if (r.ok) {
    const html = htmlOf(r, detailPath('news', 'hanh-trinh-11', 'vi'))!;
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    expect(main).not.toMatch(/<script/i);
    expect(main).not.toMatch(/onerror\s*=/i);
  } else {
    expect(r.log).toMatch(/HTML|thẻ|token/i);
  }
});

test('NEWS-08 Liên kết mailto có tham số "cc" thì build đỏ (@S13 @kiem-luc-build)', () => {
  const r = buildSite(
    newsFiles('hanh-trinh-12', { body: '[viết thư](mailto:lienhe@vi-du.test?subject=Hoi&cc=khac@vi-du.test)\n' }),
  );
  expect(r.ok).toBe(false);
  expect(r.log).toMatch(/mailto/i);
  expect(r.log).toContain('cc');
});

const fan = (n: number, over: Record<string, unknown> = {}): Files =>
  newsFiles(`fanpage-0${n}`, {
    vi: { slug: `fanpage-0${n}`, title: `Fanpage ${n}`, origin: `fanpage#0${n}`, ...over },
    en: { slug: `fanpage-0${n}-en`, title: `Fanpage ${n} EN`, origin: `fanpage#0${n}`, ...over },
  });

test('NEWS-09 Chỉ bài fanpage GMS chọn mới lên (@S31 @kiem-luc-build @cho-khach:P21 @cho-khach:P8)', () => {
  const files: Files = {};
  for (let n = 1; n <= 7; n++)
    Object.assign(files, fan(n, n === 3 || n === 5 ? { gmsSelected: true } : { published: false }));
  const r = buildSite(files);
  expect(r.ok, r.log).toBe(true);
  const list = htmlOf(r, path('news', 'vi'))!;
  expect(count(list, 'data-testid="news-item"')).toBe(2);
  for (const n of [3, 5]) expect(list).toContain(`Fanpage ${n}`);
  for (const n of [1, 2, 4, 6, 7]) {
    expect(
      r.has(`tin-tuc/fanpage-0${n}/index.html`) || r.has(`tin-tuc/fanpage-0${n}.html`),
      `bài #0${n} không có URL`,
    ).toBe(false);
    expect(allHtml(r)).not.toContain(`Fanpage ${n}`);
  }
});

test('NEWS-10 Chưa bài fanpage nào được chọn thì không bài nào lên (@S31 @kiem-luc-build @cho-khach:P21)', () => {
  const files: Files = {};
  for (let n = 1; n <= 7; n++) Object.assign(files, fan(n, { published: false }));
  const r = buildSite(files);
  expect(r.ok, r.log).toBe(true);
  expect(count(htmlOf(r, path('news', 'vi')) ?? '', 'data-testid="news-item"')).toBe(0);
  expect(allHtml(r)).not.toMatch(/Fanpage \d/);
});

test('NEWS-11 Bài nhập giữ ảnh AI có nhãn, ảnh có alt không rỗng (@S31 @kiem-luc-build)', () => {
  const imgs: Files = {
    'images/fan-07.yaml': 'alt:\n  vi: ""\n  en: "x"\nkind: "anh-dung-ai"\nhasPeople: false\nsource: "fanpage#07"\n',
    'images/fan-07.jpg': Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0xff, 0xd9]),
  };
  const r = buildSite({ ...imgs, ...fan(7, { published: true, gmsSelected: true, heroImage: 'images/fan-07.jpg' }) });
  // alt "vi" rỗng ⇒ build phải đỏ nêu ảnh (feature: "mọi ảnh của 7 bài có mô tả thay thế không rỗng ở vi").
  expect(r.ok).toBe(false);
  expect(r.log).toContain('fan-07');
  expect(r.log).toMatch(/alt|mô tả thay thế/i);
  const ok = buildSite({
    ...imgs,
    'images/fan-07.yaml': imgs['images/fan-07.yaml'].toString().replace('vi: ""', 'vi: "Phối cảnh"'),
    ...fan(7, { gmsSelected: true, heroImage: 'images/fan-07.jpg' }),
  });
  expect(ok.ok, ok.log).toBe(true);
  expect(allHtml(ok)).toMatch(/Phối cảnh dự kiến/);
});

test('NEWS-12 Nguồn gốc fanpage trùng thì build đỏ (@S31 @kiem-luc-build)', () => {
  const a = newsFiles('trung-a', {
    vi: { origin: 'fanpage#04', gmsSelected: true },
    en: { origin: 'fanpage#04', gmsSelected: true },
  });
  const b = newsFiles('trung-b', {
    vi: { origin: 'fanpage#04', gmsSelected: true },
    en: { origin: 'fanpage#04', gmsSelected: true },
  });
  const r = buildSite({ ...a, ...b });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('#04');
  expect(r.log).toMatch(/trùng/);
});
