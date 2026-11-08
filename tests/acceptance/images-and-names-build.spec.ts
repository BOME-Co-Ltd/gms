// test-plan.md 0k B/C/D/E — bậc BUILD (buildSite + soi out/), không cần Worker/trình duyệt.
//   IMG-04, 06–11, 13 · M40-01, 02 (bản thường), 03, 06 (hàng alt/Figure.source), 07, 09, 11 · ND-01, ND-02.
// Nguồn: content-pages.feature:10–66, figures-and-claims.feature:108–213, threat-model.md M40 (`Xanh Asian` chỉ là DỮ LIỆU của danh sách cấm).
// CHƯA viết (XQ-QA-M40-1 còn mở — cần fixture ngoài content/): M40-02 hàng public/, M40-04, M40-05, M40-06 hàng JSON-LD/SVG/i18n-client, E43-*, R-01.
import { expect, test } from '@playwright/test';
import { type BuildResult, buildSite, type Files, htmlOf, newsFiles } from '../support/build';
import { bytesOfSize, figure, figuresFile, imageMeta, jpegWithExif, PNG_1X1, WEBP_1X1 } from '../support/fixtures';
import { type Locale, path } from '../support/routes';

const ZW = String.fromCharCode(0x200b);
const NAME = 'Xanh Asian';
const build = (files: Files = {}, env: Record<string, string> = {}) => buildSite(files, { SITE_ENV: 'test', ...env });
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PLACEHOLDER = /chờ GMS gửi|đang cập nhật|awaiting|coming soon/i;

const slot = (name: string, ext: string, meta: Record<string, unknown> = {}): Files => ({
  ...imageMeta(name, meta),
  [`images/${name}.${ext}`]: ext === 'png' ? bytesOfSize(2048, PNG_HEAD) : jpegWithExif(),
});
const homes = (r: BuildResult) => [htmlOf(r, '') ?? '', htmlOf(r, 'en') ?? ''];

// --- B. Ô ảnh -------------------------------------------------------------------------------------------------------
test('IMG-04 Ô gms-sorting-line có hai tệp khác đuôi thì build đỏ IMAGE_SLOT_DUPLICATE, nêu ô và hai tệp', () => {
  const r = build({ ...slot('gms-sorting-line', 'jpg'), ...slot('gms-sorting-line', 'png') });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('IMAGE_SLOT_DUPLICATE');
  expect(r.log).toContain('gms-sorting-line');
  expect(r.log).toContain('gms-sorting-line.jpg');
  expect(r.log).toContain('gms-sorting-line.png');
});

for (const [only, other] of [
  ['gms-before', 'gms-after'],
  ['gms-after', 'gms-before'],
] as const) {
  test(`IMG-06 Chỉ có ô ${only}: build xanh, không cặp, không ảnh lẻ, không ô giữ chỗ (vi, en)`, () => {
    const r = build(slot(only, 'jpg'));
    expect(r.ok, r.log).toBe(true);
    for (const html of homes(r)) {
      expect(html.length, 'trang chủ phải có trong bản build').toBeGreaterThan(0);
      expect(html).not.toContain(only);
      expect(html).not.toContain(other);
      expect(html).not.toMatch(PLACEHOLDER);
    }
  });
}

test('IMG-07 gms-after khai kind "anh-dung-ai" thì build đỏ IMAGE_SLOT_KIND_INVALID, nêu ô, tệp, loại nhận, loại khai', () => {
  const r = build({ ...slot('gms-before', 'jpg'), ...slot('gms-after', 'jpg', { kind: 'anh-dung-ai' }) });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('IMAGE_SLOT_KIND_INVALID');
  expect(r.log).toContain('"gms-after"');
  expect(r.log).toContain('images/gms-after.jpg');
  expect(r.log).toContain('"anh-that"');
  expect(r.log).toContain('"anh-dung-ai"');
});

for (const [a, b, name] of [
  ['jpg', 'png', 'gms-before'],
  ['jpg', 'webp', 'gms-after'],
] as const) {
  test(`IMG-08 ${name}.${a} + ${name}.${b} thì build đỏ IMAGE_SLOT_DUPLICATE, nêu ô và hai tệp (không tự chọn)`, () => {
    const second: Files = {
      [`images/${name}.${b}`]: bytesOfSize(2048, b === 'png' ? PNG_HEAD : [0x52, 0x49, 0x46, 0x46]),
    };
    const r = build({ ...slot(name, a), ...second });
    expect(r.ok).toBe(false);
    expect(r.log).toContain('IMAGE_SLOT_DUPLICATE');
    expect(r.log).toContain(`${name}.${a}`);
    expect(r.log).toContain(`${name}.${b}`);
  });
}

test('IMG-09 gms-after có người nhưng thiếu ngày đồng ý: build xanh, trang chủ không có khối Trước/Sau, kể cả ảnh gms-before lẻ', () => {
  const r = build({ ...slot('gms-before', 'jpg'), ...slot('gms-after', 'jpg', { hasPeople: true }) });
  expect(r.ok, r.log).toBe(true);
  for (const html of homes(r)) {
    expect(html.length).toBeGreaterThan(0);
    expect(html).not.toContain('gms-before');
    expect(html).not.toContain('gms-after');
  }
});

for (const key of ['partnerAsset', 'techSourceAsset', 'keepTitleBlock'] as const) {
  test(`IMG-10/11 Khoá ảnh cũ "${key}" thì build đỏ, log nêu tên khoá`, () => {
    const val = key === 'keepTitleBlock' ? true : { partner: 'X', type: 'bản vẽ 3D' };
    const r = build({ ...imageMeta('so-do', { [key]: val }), 'images/so-do.jpg': jpegWithExif() });
    expect(r.ok).toBe(false);
    expect(r.log).toContain(key);
  });
}

test('IMG-13 Ảnh trong bản build không còn EXIF/XMP/IPTC/GPS (kể cả XMP/IPTC giả trong tệp nguồn)', () => {
  const seg = (marker: number, payload: Buffer) => {
    const len = payload.length + 2;
    return Buffer.concat([Buffer.from([0xff, marker, len >> 8, len & 255]), payload]);
  };
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(
      0xe1,
      Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>XmpSecretCreator GPSLatitude</x:xmpmeta>', 'latin1'),
    ),
    seg(0xed, Buffer.from('Photoshop 3.0\x008BIM\x04\x04IptcSecretCaption', 'latin1')),
    seg(0xe1, Buffer.from('Exif\0\0MM\0*GPSLatitude=21.0000 Make=FlycamX', 'latin1')),
    Buffer.from([0xff, 0xdb, 0, 3, 0, 0xff, 0xd9]),
  ]);
  const r = build({
    ...imageMeta('meta-01'),
    'images/meta-01.jpg': jpeg,
    ...newsFiles('meta', { vi: { heroImage: 'images/meta-01.jpg' }, en: { heroImage: 'images/meta-01.jpg' } }),
  });
  expect(r.ok, r.log).toBe(true);
  const out = r.files().filter((f) => f.includes('meta-01') && /\.(jpe?g|webp|png)$/.test(f));
  expect(out.length, 'ảnh phải có trong bản build').toBeGreaterThan(0);
  for (const f of out) {
    const bin = r.read(f) ?? '';
    for (const bad of ['Exif', 'GPS', 'FlycamX', 'ns.adobe.com', 'XmpSecret', 'Photoshop 3.0', 'IptcSecret', '8BIM']) {
      expect(bin, `${f} còn "${bad}"`).not.toContain(bad);
    }
  }
});

// --- D. M40 ---------------------------------------------------------------------------------------------------------
const DENY_CASES: Array<[string, Files, Record<string, string>]> = [
  ['không có tệp, SITE_ENV=test', { 'denylist.yaml': null }, { SITE_ENV: 'test' }],
  ['không có tệp, SITE_ENV=staging', { 'denylist.yaml': null }, { SITE_ENV: 'staging' }],
  [
    'không có tệp, SITE_ENV=production',
    { 'denylist.yaml': null },
    { SITE_ENV: 'production', WORKERS_CI_BRANCH: 'production' },
  ],
  ['names: [], SITE_ENV=test', { 'denylist.yaml': 'names: []\n' }, { SITE_ENV: 'test' }],
  [
    'names: [], SITE_ENV=production',
    { 'denylist.yaml': 'names: []\n' },
    { SITE_ENV: 'production', WORKERS_CI_BRANCH: 'production' },
  ],
  ['names là chuỗi, SITE_ENV=test', { 'denylist.yaml': `names: "${NAME}"\n` }, { SITE_ENV: 'test' }],
  ['khoá lạ "ten", SITE_ENV=test', { 'denylist.yaml': `ten:\n  - "${NAME}"\n` }, { SITE_ENV: 'test' }],
];
for (const [label, files, env] of DENY_CASES) {
  test(`M40-01 denylist: ${label} thì build đỏ DENYLIST_MISSING`, () => {
    const r = build(files, env);
    expect(r.ok).toBe(false);
    expect(r.log).toContain('DENYLIST_MISSING');
    expect(r.log).toContain('denylist.yaml');
    expect(r.log).toContain('names');
  });
}

test('M40-02 Bản build thường: out/ không có tệp tên denylist.yaml và không tệp văn bản nào chứa "denylist"', () => {
  const r = build();
  expect(r.ok, r.log).toBe(true);
  expect(r.files().filter((f) => /(^|\/)denylist\.yaml$/.test(f))).toEqual([]);
  const textFile = /\.(html|txt|xml|json|js|mjs|css|svg|map|webmanifest)$|(^|\/)_(headers|redirects)$/;
  for (const f of r.files().filter((x) => textFile.test(x))) {
    expect(r.read(f) ?? '', f).not.toMatch(/denylist/i);
  }
});

test('M40-03 alt.en của ảnh so-do-sang-tuyen nêu tên thì build đỏ FORBIDDEN_NAME_IN_CONTENT, nêu tệp, locale en, trường alt.en, cụm', () => {
  const r = build({
    ...imageMeta('so-do-sang-tuyen', { alt: { vi: 'Sơ đồ sàng tuyển', en: `Based on ${NAME} documents` } }),
    'images/so-do-sang-tuyen.jpg': jpegWithExif(),
  });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('FORBIDDEN_NAME_IN_CONTENT');
  expect(r.log).toContain('images/so-do-sang-tuyen.yaml');
  expect(r.log).toContain('"en"');
  expect(r.log).toContain('alt.en');
  expect(r.log).toContain(NAME);
});

const VARIANTS = ['Xanh Asian', 'XANH ASIAN', 'Xanhasian', 'Xạnh Ásian'];
for (const v of VARIANTS) {
  // XQ-QA-M40-2 ý 2 (architect, lượt 18): tên ở alt / Figure.source đi qua content/ ⇒ đúng mã FORBIDDEN_NAME_IN_CONTENT;
  // build dừng ở bước nạp nội dung nên cùng lần build KHÔNG có FORBIDDEN_NAME_IN_OUTPUT (contracts/build.ts §8 luật (6)(a)).
  test(`M40-06 "${v}" trong alt của ảnh thì build đỏ FORBIDDEN_NAME_IN_CONTENT, nêu tên trong danh sách`, () => {
    const r = build({
      ...imageMeta('minh-hoa', { alt: { vi: `Ảnh ${v}`, en: `Photo ${v}` } }),
      'images/minh-hoa.jpg': jpegWithExif(),
      ...newsFiles('mh', { vi: { heroImage: 'images/minh-hoa.jpg' }, en: { heroImage: 'images/minh-hoa.jpg' } }),
    });
    expect(r.ok).toBe(false);
    expect(r.log).toContain('FORBIDDEN_NAME_IN_CONTENT');
    expect(r.log).not.toContain('FORBIDDEN_NAME_IN_OUTPUT');
    expect(r.log).toContain('alt');
    expect(r.log).toContain(NAME);
  });
  test(`M40-06 "${v}" trong Figure.source thì build đỏ FORBIDDEN_NAME_IN_CONTENT, nêu tên trong danh sách`, () => {
    const r = build(figuresFile([figure({ key: 'dt', source: `Tài liệu ${v}` })]));
    expect(r.ok).toBe(false);
    expect(r.log).toContain('FORBIDDEN_NAME_IN_CONTENT');
    expect(r.log).not.toContain('FORBIDDEN_NAME_IN_OUTPUT');
    expect(r.log).toContain('source');
    expect(r.log).toContain(NAME);
  });
}

test('M40-07 Tên dịch vụ do chức năng/luật buộc (Cloudflare, Zalo, Messenger, Facebook) thì build xanh; Chính sách vi có "Cloudflare"', () => {
  const r = build({
    'policy/1.0.vi.md':
      '---\nversion: "1.0"\neffectiveFrom: "2026-01-01"\n---\nChúng tôi dùng Cloudflare để phân phối trang và nhận biểu mẫu.\n',
    'company.yaml': `legalName: "Công ty Mẫu GMS"\naddress:\n  vi: "Hưng Yên"\n  en: "Hung Yen"\nphone: "+84900000000"\nprivacyRequestEmail: "quyen@vi-du.test"\nsocial: [{"name":"Zalo","url":"https://zalo.me/0900000000"},{"name":"Messenger","url":"https://m.me/gms.mau"},{"name":"Facebook","url":"https://www.facebook.com/gms.mau"}]\n`,
  });
  expect(r.ok, r.log).toBe(true);
  const policy = htmlOf(r, 'chinh-sach-bao-mat') ?? '';
  expect(policy, 'trang Chính sách vi phải có trong bản build').not.toBe('');
  expect(policy).toContain('Cloudflare');
});

test('M40-09 Bản build thường: không tệp nào của out/ có tên chứa "sorting-line-3d"', () => {
  const r = build();
  expect(r.ok, r.log).toBe(true);
  expect(r.files().filter((f) => f.includes('sorting-line-3d'))).toEqual([]);
});

test('M40-11 (qa thêm) Tên viết liền trong TÊN TỆP ảnh nguồn thì build đỏ, log nêu đường dẫn', () => {
  const r = build({ ...imageMeta('xanhasian-so-do'), 'images/xanhasian-so-do.jpg': jpegWithExif() });
  expect(r.ok).toBe(false);
  // XQ-QA-L18-1 (architect lượt 19, contracts/build.ts §8 luật (6)(a)): tên cấm trong TÊN TỆP ảnh nguồn
  // ⇒ đúng một mã FORBIDDEN_NAME_IN_CONTENT, không có FORBIDDEN_NAME_IN_OUTPUT (như ND-01).
  expect(r.log).toContain('FORBIDDEN_NAME_IN_CONTENT');
  expect(r.log).not.toContain('FORBIDDEN_NAME_IN_OUTPUT');
  expect(r.log).toContain('xanhasian-so-do');
});

// --- E. Q14-4 qua loader thật ------------------------------------------------------------------------------------------
test('ND-01 Thân bài Tin có "Xa&shy;nh Asian" thì build đỏ FORBIDDEN_NAME_IN_CONTENT, nêu tệp, trường "thân bài" và cụm', () => {
  const r = build(newsFiles('nd-01', { body: 'Hợp tác với Xa&shy;nh Asian.' }));
  expect(r.ok).toBe(false);
  expect(r.log).toContain('FORBIDDEN_NAME_IN_CONTENT');
  expect(r.log).not.toContain('FORBIDDEN_NAME_IN_OUTPUT');
  expect(r.log).toContain('news/nd-01.');
  expect(r.log).toContain('thân bài'); // XQ-QA-M40-2: tên trường của thân bài Markdown (architect, lượt 18)
  expect(r.log).toContain(NAME);
});

test('ND-02 alt.en = "Xanh"+U+200B+"Asian" (byte thật) thì build đỏ FORBIDDEN_NAME_IN_CONTENT, nêu tệp ảnh, locale en, trường alt.en', () => {
  const r = build({
    ...imageMeta('nd-02', { alt: { vi: 'Ảnh mẫu', en: `Xanh${ZW}Asian` } }),
    'images/nd-02.jpg': jpegWithExif(),
  });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('FORBIDDEN_NAME_IN_CONTENT');
  expect(r.log).toContain('images/nd-02.yaml');
  expect(r.log).toContain('"en"');
  expect(r.log).toContain('alt.en');
  expect(r.log).toContain(NAME);
});

// --- F. XQ-44 — khung "Dây chuyền sàng tuyển" dùng ô đã nạp, mọi đuôi contract cho phép (jpg|jpeg|png|webp) ---------------
// Nguồn: contracts/content-model.ts "Ô ảnh cố định"; figures-and-claims.feature:189–213; design.md XQ-44 (lượt 18).
// Ảnh PNG/WebP là ảnh 1x1 HỢP LỆ (bản build có thể giải mã/xoá metadata); khung nhận diện bằng chuỗi "tech-drawing".
const LABEL: Record<Locale, string> = { vi: 'Phối cảnh dự kiến', en: "Artist's impression" };
// bỏ <style>/<script> để tên lớp CSS nằm trong khai báo không làm khung "hiện" giả
const techPage = (r: BuildResult, l: Locale) =>
  (htmlOf(r, path('technology', l)) ?? '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '');
const frameWindow = (html: string) => {
  const at = html.indexOf('tech-drawing');
  return at < 0 ? '' : html.slice(at, at + 4000);
};
// Một hàm giải mã thực thể HTML cho cả XQ-44a và XQ-44b (nháy: &#x27; &#39; &apos;), để hai ca không bất đối xứng.
const decodeEntities = (s: string) =>
  s
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
const firstImgSrc = (html: string) => /<img\b[^>]*?\ssrc="([^"]+)"/i.exec(html)?.[1] ?? '';

for (const locale of ['vi', 'en'] as Locale[]) {
  test(`XQ-44a (${locale}) Ô gms-sorting-line.png kind "anh-dung-ai": khung tech-drawing hiện, src đuôi .png, có nhãn phối cảnh`, () => {
    const r = build({
      ...imageMeta('gms-sorting-line', { kind: 'anh-dung-ai' }),
      'images/gms-sorting-line.png': PNG_1X1,
    });
    expect(r.ok, r.log).toBe(true);
    const html = techPage(r, locale);
    expect(html.length, 'trang Công nghệ phải có trong bản build').toBeGreaterThan(0);
    const frame = frameWindow(html);
    expect(frame, 'khung tech-drawing phải hiện khi có ô ảnh .png').not.toBe('');
    const src = firstImgSrc(frame);
    expect(src.split(/[?#]/)[0], `src ảnh trong khung: "${src}"`).toMatch(/\.png$/i);
    expect(decodeEntities(frame), 'nhãn nhìn thấy trong khung, không chỉ trong alt').toContain(LABEL[locale]);
  });

  test(`XQ-44b (${locale}) Ô gms-sorting-line.webp kind "anh-that": khung hiện, src đuôi .webp, KHÔNG có nhãn phối cảnh`, () => {
    const r = build({
      ...imageMeta('gms-sorting-line', { kind: 'anh-that' }),
      'images/gms-sorting-line.webp': WEBP_1X1,
    });
    expect(r.ok, r.log).toBe(true);
    const html = techPage(r, locale);
    const frame = frameWindow(html);
    expect(frame, 'khung tech-drawing phải hiện khi có ô ảnh .webp').not.toBe('');
    expect(firstImgSrc(frame).split(/[?#]/)[0]).toMatch(/\.webp$/i);
    expect(decodeEntities(html), 'ảnh thật không có nhãn phối cảnh').not.toContain(LABEL[locale]);
  });

  test(`XQ-44c (${locale}) Không có ô gms-sorting-line: khung tech-drawing ẩn, không ô giữ chỗ`, () => {
    const r = build();
    expect(r.ok, r.log).toBe(true);
    const html = techPage(r, locale);
    expect(html.length, 'trang Công nghệ phải có trong bản build').toBeGreaterThan(0);
    expect(html).not.toContain('tech-drawing');
    expect(html).not.toMatch(PLACEHOLDER);
  });
}
