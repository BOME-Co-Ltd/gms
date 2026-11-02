// seo-technical.feature → SEO-01..SEO-14 (S32). Tên miền chính thức = CANONICAL_ORIGIN [giả định — chờ khách] P12.
// x-default → bản vi của chính trang [giả định — chờ khách] P2, P20. Hết hạn tuyển dụng P33. Staging/production: SITE_ENV khi build (XQ-21).
// v0.3: không còn xuất bản/gỡ qua CMS — mọi thay đổi nội dung = một lần build mới; ca đọc sitemap/head dựng nội dung giả rồi đọc đầu ra build.
import { expect, type Page, test } from '@playwright/test';
import { allHtml, type BuildResult, buildSite, type Files, htmlOf, newsFiles } from '../support/build';
import { CANONICAL_ORIGIN } from '../support/env';
import { companyFile, yamlItem } from '../support/fixtures';
import { detailPath, type Locale, PAGE_KEYS, type PageKey, path } from '../support/routes';
import { open, VN_DIACRITIC } from '../support/ui';

const abs = (p: string) => (/^https?:/.test(p) ? p : CANONICAL_ORIGIN + p);
const attr = (html: string, re: RegExp) => [...html.matchAll(re)].map((m) => m[1]);
const hreflangs = (html: string) => {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<link[^>]*rel="alternate"[^>]*>/g)) {
    const h = m[0].match(/hreflang="([^"]+)"/)?.[1];
    const href = m[0].match(/href="([^"]+)"/)?.[1];
    if (h && href) out[h] = href;
  }
  return out;
};
const canonical = (html: string) => attr(html, /<link[^>]*rel="canonical"[^>]*href="([^"]+)"/g);
const meta = (html: string, key: string) =>
  html.match(new RegExp(`<meta[^>]*(?:name|property)="${key}"[^>]*content="([^"]*)"`))?.[1] ?? '';
const hasNoindex = (html: string) => /<meta[^>]*name="robots"[^>]*noindex/i.test(html);
const sitemapLocs = (r: BuildResult) =>
  [...(r.read('sitemap.xml') ?? '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
const NEWS = newsFiles('hanh-trinh-08', { vi: { slug: 'hanh-trinh-08' }, en: { slug: 'journey-08' } });

test('SEO-01 Bản vi khai hreflang tự tham chiếu, en và x-default (@S32 @risk:hreflang @cho-khach:P2 @cho-khach:P20 @kiem-luc-build)', () => {
  const r = buildSite({});
  expect(r.ok, r.log).toBe(true);
  const h = hreflangs(htmlOf(r, path('technology', 'vi'))!);
  expect(h['vi']).toBe(abs(path('technology', 'vi')));
  expect(h['en']).toBe(abs(path('technology', 'en')));
  expect(h['x-default']).toBe(abs(path('technology', 'vi')));
  expect(h['x-default']).not.toBe(abs(path('home', 'vi')));
});

test('SEO-02 Bản en khai hreflang tự tham chiếu, vi và x-default (@S32 @risk:hreflang @cho-khach:P2 @cho-khach:P20 @kiem-luc-build)', () => {
  const r = buildSite({});
  const h = hreflangs(htmlOf(r, path('technology', 'en'))!);
  expect(h['en']).toBe(abs(path('technology', 'en')));
  expect(h['vi']).toBe(abs(path('technology', 'vi')));
  expect(h['x-default']).toBe(abs(path('technology', 'vi')));
  expect(h['x-default']).not.toBe(abs(path('home', 'vi')));
  expect(h['x-default']).not.toBe(abs(path('technology', 'en')));
});

test('SEO-03 Tin không đăng không có URL nào trong sitemap hay trang công khai (@S32 @risk:hreflang @kiem-luc-build)', () => {
  const hidden = newsFiles('hanh-trinh-09', {
    vi: { slug: 'hanh-trinh-09', published: false },
    en: { slug: 'journey-09', published: false },
  });
  const r = buildSite({ ...NEWS, ...hidden });
  expect(r.ok, r.log).toBe(true);
  expect((r.read('sitemap.xml') ?? '') + allHtml(r)).not.toMatch(/hanh-trinh-09|journey-09/);
});

test('SEO-04 Title, description, canonical đúng ngôn ngữ (@S32 @kiem-luc-build)', () => {
  const r = buildSite({});
  const html = htmlOf(r, path('products', 'en'))!;
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  const desc = meta(html, 'description');
  expect(title.trim().length).toBeGreaterThan(0);
  expect(desc.trim().length).toBeGreaterThan(0);
  expect(title).not.toMatch(VN_DIACRITIC);
  expect(desc).not.toMatch(VN_DIACRITIC);
  expect(canonical(html)).toEqual([abs(path('products', 'en'))]);
});

test('SEO-05 UTM vẫn canonical về URL sạch (@S32)', async ({ page }) => {
  await page.goto(path('technology', 'vi') + '?utm_source=facebook&utm_medium=social&utm_campaign=hanh-trinh-08');
  const html = await page.content();
  expect(canonical(html)).toEqual([abs(path('technology', 'vi'))]);
  const h = hreflangs(html);
  for (const href of Object.values(h)) expect(href).not.toMatch(/utm_|\?/);
  expect(Object.keys(h).length).toBeGreaterThanOrEqual(3);
});

test('SEO-06 Sitemap chỉ có trang có nội dung, không 404, không noindex (@S32 @kiem-luc-build)', () => {
  const faq = (l: 'vi' | 'en') =>
    [1, 2, 3].map((i) => yamlItem({ key: `c${i}`, order: i, question: `Q${i}`, answer: 'a' })).join('\n') + '\n';
  const proj: Files = {};
  for (const i of [1, 2])
    for (const l of ['vi', 'en'])
      proj[`projects/m${i}.${l}.md`] =
        `---\nslug: "m${i}-${l}"\nkey: "m${i}"\ntitle: "Mục ${i}"\npublished: true\nsummary: "s"\ndate: "2026-10-0${i}"\ncategory: "c"\n---\nNội dung\n`;
  const r = buildSite(
    { ...NEWS, ...proj, 'faq.vi.yaml': faq('vi'), 'faq.en.yaml': faq('en') },
    { DATE_OVERRIDE: '2026-11-01' },
  );
  expect(r.ok, r.log).toBe(true);
  const locs = sitemapLocs(r);
  for (const l of ['vi', 'en'] as Locale[]) {
    for (const key of PAGE_KEYS.filter((k) => k !== 'careers'))
      expect(locs, `${l}/${key}`).toContain(abs(path(key, l)));
    expect(locs).not.toContain(abs(path('careers', l)));
    expect(locs).toContain(abs(detailPath('news', l === 'vi' ? 'hanh-trinh-08' : 'journey-08', l)));
    expect(locs).toContain(abs(detailPath('projects', `m1-${l}`, l)));
  }
  expect(locs.some((u) => /404/.test(u))).toBe(false);
  expect(new Set(locs).size, 'không URL trùng').toBe(locs.length);
  for (const u of locs) {
    const html = htmlOf(r, u.replace(CANONICAL_ORIGIN, ''));
    expect(html, u).not.toBeNull();
    expect(hasNoindex(html!), u).toBe(false);
  }
});

const EMPTY: Array<[string, PageKey, Files]> = [
  [
    'Mục Dự án/Thư viện',
    'projects',
    Object.fromEntries(
      ['vi', 'en'].map((l) => [
        `projects/m1.${l}.md`,
        `---\nslug: "m1-${l}"\nkey: "m1"\ntitle: "Mục 1"\npublished: true\nsummary: "s"\ndate: "2026-10-01"\ncategory: "c"\n---\nx\n`,
      ]),
    ),
  ],
  [
    'Tin tuyển dụng còn hạn',
    'careers',
    Object.fromEntries(
      ['vi', 'en'].map((l) => [
        `jobs/kt.${l}.md`,
        `---\nslug: "kt"\nkey: "kt"\ntitle: "Kỹ thuật viên"\npublished: true\nvalidThrough: "2099-01-01"\nemploymentType: "FULL_TIME"\n---\nGửi hồ sơ\n`,
      ]),
    ),
  ],
  [
    'Câu hỏi thường gặp',
    'faq',
    {
      'faq.vi.yaml': yamlItem({ key: 'h', order: 1, question: 'Hỏi', answer: 'Đáp' }) + '\n',
      'faq.en.yaml': yamlItem({ key: 'h', order: 1, question: 'Q', answer: 'A' }) + '\n',
    },
  ],
];
for (const [kind, key, files] of EMPTY) {
  test(`SEO-07 Trang rỗng "${kind}" noindex, có mục đầu tiên thì index (@S32 @kiem-luc-build)`, () => {
    const empty = buildSite({});
    expect(empty.ok, empty.log).toBe(true);
    for (const l of ['vi', 'en'] as Locale[]) {
      const html = htmlOf(empty, path(key, l));
      expect(html, `${l} rỗng vẫn 200`).not.toBeNull();
      expect(hasNoindex(html!), `${l} rỗng`).toBe(true);
    }
    expect(sitemapLocs(empty)).not.toContain(abs(path(key, 'vi')));
    const filled = buildSite(files, { DATE_OVERRIDE: '2026-11-01' });
    expect(filled.ok, filled.log).toBe(true);
    for (const l of ['vi', 'en'] as Locale[])
      expect(hasNoindex(htmlOf(filled, path(key, l))!), `${l} có mục`).toBe(false);
    expect(sitemapLocs(filled)).toEqual(expect.arrayContaining([abs(path(key, 'vi')), abs(path(key, 'en'))]));
  });
}

test('SEO-08 Tin bị gỡ ra khỏi sitemap, hreflang và URL (@S32 @S13 @risk:hreflang @kiem-luc-build)', () => {
  const before = buildSite(NEWS);
  expect(htmlOf(before, detailPath('news', 'hanh-trinh-08', 'vi'))).not.toBeNull();
  const after = buildSite({
    ...newsFiles('hanh-trinh-08', {
      vi: { slug: 'hanh-trinh-08', published: false },
      en: { slug: 'journey-08', published: false },
    }),
  });
  expect(after.ok, after.log).toBe(true);
  expect(htmlOf(after, detailPath('news', 'hanh-trinh-08', 'vi')), 'URL vi ⇒ 404').toBeNull();
  expect(htmlOf(after, detailPath('news', 'journey-08', 'en')), 'URL en ⇒ 404').toBeNull();
  expect((after.read('sitemap.xml') ?? '') + allHtml(after)).not.toMatch(/hanh-trinh-08|journey-08/);
});

test('SEO-09 Tin tuyển dụng hết hạn ra khỏi sitemap và không mở được (@S32 @S15 @cho-khach:P33 @kiem-luc-build)', () => {
  const jobs = Object.fromEntries(
    ['vi', 'en'].map((l) => [
      `jobs/kt.${l}.md`,
      `---\nslug: "kt"\nkey: "kt"\ntitle: "Kỹ thuật viên vận hành"\npublished: true\nvalidThrough: "2026-11-15"\nemploymentType: "FULL_TIME"\n---\nx\n`,
    ]),
  );
  const r = buildSite(jobs, { DATE_OVERRIDE: '2026-11-16' });
  expect(r.ok, r.log).toBe(true);
  for (const l of ['vi', 'en'] as Locale[]) expect(htmlOf(r, detailPath('careers', 'kt', l))).toBeNull();
  expect(r.read('sitemap.xml') ?? '').not.toContain('/kt');
});

const SHARE: Array<[string, PageKey | '404', Locale]> = [
  ['Trang chủ', 'home', 'vi'],
  ['Trang chủ', 'home', 'en'],
  ['Công nghệ', 'technology', 'vi'],
  ['Công nghệ', 'technology', 'en'],
  ['Liên hệ', 'contact', 'en'],
  ['404', '404', 'vi'],
  ['404', '404', 'en'],
];
const OG_LOCALE: Record<Locale, RegExp> = { vi: /^vi[_-]VN$/i, en: /^en[_-](US|GB)?$/i };
for (const [label, key, locale] of SHARE) {
  test(`SEO-10 Thẻ chia sẻ đúng ngôn ngữ: ${label} / ${locale} (@S32 @kiem-luc-build)`, () => {
    const r = buildSite({});
    expect(r.ok, r.log).toBe(true);
    // 404 có hai bản ngôn ngữ: kiểu đường dẫn 404 theo locale CHƯA có trong contract ⇒ XQ-22 (đọc /404.html và /en/404.html).
    const html = (key === '404' ? r.read(locale === 'vi' ? '404.html' : 'en/404.html') : htmlOf(r, path(key, locale)))!;
    expect(html, `${label}/${locale}`).toBeTruthy();
    const t = meta(html, 'og:title');
    const d = meta(html, 'og:description');
    expect(t.trim().length).toBeGreaterThan(0);
    expect(d.trim().length).toBeGreaterThan(0);
    if (locale === 'en') {
      expect(t).not.toMatch(VN_DIACRITIC);
      expect(d).not.toMatch(VN_DIACRITIC);
    }
    expect(meta(html, 'og:locale')).toMatch(OG_LOCALE[locale]);
    const img = meta(html, 'og:image');
    expect(img).not.toBe('');
    expect(r.has(img.replace(CANONICAL_ORIGIN, '').replace(/^\//, '')), 'og:image có trong bản build ⇒ 200').toBe(true);
  });
}

test('SEO-11 Ảnh chia sẻ không dùng ảnh người chưa đồng ý hay ảnh dựng (@S32 @S17 @cho-khach:N16 @cho-khach:N17 @kiem-luc-build)', () => {
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0xff, 0xd9]);
  const meta2 = (extra: string) => `alt:\n  vi: "Ảnh"\n  en: "Photo"\nhasPeople: ${extra}\nsource: "mẫu"\n`;
  const r = buildSite({
    'images/le-khoi-cong.yaml': meta2('true') + 'kind: "anh-that"\n',
    'images/le-khoi-cong.jpg': jpg,
    'images/phoi-canh.yaml': meta2('false') + 'kind: "anh-dung-ai"\n',
    'images/phoi-canh.jpg': jpg,
    ...newsFiles('khoi-cong', {
      vi: { slug: 'khoi-cong', heroImage: 'images/le-khoi-cong.jpg' },
      en: { slug: 'groundbreaking', heroImage: 'images/le-khoi-cong.jpg' },
    }),
    ...newsFiles('phoi-canh', {
      vi: { slug: 'phoi-canh', heroImage: 'images/phoi-canh.jpg' },
      en: { slug: 'rendering', heroImage: 'images/phoi-canh.jpg' },
    }),
  });
  expect(r.ok, r.log).toBe(true);
  for (const [l, slugs] of [
    ['vi', ['khoi-cong', 'phoi-canh']],
    ['en', ['groundbreaking', 'rendering']],
  ] as const)
    for (const s of slugs) {
      const img = meta(htmlOf(r, detailPath('news', s, l))!, 'og:image');
      expect(img).not.toMatch(/le-khoi-cong|phoi-canh/);
      expect(r.has(img.replace(CANONICAL_ORIGIN, '').replace(/^\//, '')), s).toBe(true);
    }
});

test('SEO-12 Dữ liệu có cấu trúc chỉ dùng trường đã có (@S32 @cho-khach:N27 @kiem-luc-build)', () => {
  const r = buildSite(companyFile({ address: null, taxId: null }));
  const html = htmlOf(r, path('home', 'vi'))!;
  const blocks = attr(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g).map((b) => JSON.parse(b));
  const org = blocks
    .flatMap((j) => (Array.isArray(j) ? j : (j['@graph'] ?? [j])))
    .find((o: { '@type'?: string }) => o['@type'] === 'Organization');
  expect(org, 'có Organization').toBeTruthy();
  for (const k of ['address', 'taxID', 'vatID']) {
    const v = org[k];
    if (v === undefined) continue;
    expect(JSON.stringify(v).replace(/["{}:,\s]|PostalAddress|@type/g, '')).not.toBe('');
  }
  expect(JSON.stringify(org)).not.toMatch(/"(taxID|vatID)":\s*""|lorem|0000000/i);
});

for (const [l, key] of [
  ['vi', 'home'],
  ['en', 'home'],
  ['vi', 'contact'],
  ['en', 'contact'],
] as Array<[Locale, PageKey]>) {
  test(`SEO-13 Staging không lập chỉ mục: ${key}/${l} (@S32 @kiem-luc-build)`, () => {
    const r = buildSite(NEWS, { SITE_ENV: 'staging' });
    expect(r.ok, r.log).toBe(true);
    const headers = r.read('_headers') ?? '';
    for (const u of [path(key, l), detailPath('news', l === 'vi' ? 'hanh-trinh-08' : 'journey-08', l)]) {
      const html = htmlOf(r, u)!;
      expect(hasNoindex(html) || /X-Robots-Tag:\s*noindex/i.test(headers), u).toBe(true);
    }
    expect(r.read('sitemap.xml') ?? '').not.toContain(CANONICAL_ORIGIN);
  });
}

test('SEO-14 Production được lập chỉ mục (@S32 @kiem-luc-build)', () => {
  const r = buildSite({}, { SITE_ENV: 'production' });
  expect(r.ok, r.log).toBe(true);
  for (const l of ['vi', 'en'] as Locale[])
    for (const key of ['home', 'technology'] as PageKey[])
      expect(hasNoindex(htmlOf(r, path(key, l))!), `${l}/${key}`).toBe(false);
  expect(r.read('_headers') ?? '').not.toMatch(/X-Robots-Tag:\s*noindex[^\n]*\n?(?![\s\S]*\/api)/i); // header noindex chỉ được dành cho /api/*
  const robots = r.read('robots.txt') ?? '';
  expect(robots).not.toMatch(/^\s*Disallow:\s*\/\s*$/im);
  for (const key of PAGE_KEYS)
    for (const l of ['vi', 'en'] as Locale[]) {
      const p = path(key, l);
      for (const m of robots.matchAll(/^\s*Disallow:\s*(\S+)/gim))
        expect(p.startsWith(m[1]), `${p} bị chặn bởi ${m[1]}`).toBe(false);
    }
  expect(robots).toMatch(
    new RegExp(`^\\s*Sitemap:\\s*${CANONICAL_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap\\.xml`, 'im'),
  );
});

void (null as unknown as Page);
void open;
