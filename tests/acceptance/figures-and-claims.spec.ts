// figures-and-claims.feature → FIG-01..FIG-15 (S7, S17, S33). v0.3: luật duyệt CMS → luật kiểm lúc build (@kiem-luc-build).
// Mọi con số là DỮ LIỆU MẪU. [giả định — chờ khách] N6, N25, N14, N30, N17, N15, N16, N5, N22, N23.
// Ca @kiem-luc-build: chạy bản build trên nội dung giả (support/build.ts, XQ-21) rồi khẳng định thông báo/đầu ra.
import { expect, test } from '@playwright/test';
import { BASE_CONTENT, buildSite, newsFiles } from '../support/build';
import {
  bytesOfSize,
  figure,
  figuresFile,
  GIF_HEAD,
  IMAGE_MAX_BYTES,
  imageMeta,
  JPEG_HEAD,
  jpegWithExif,
  pageFile,
} from '../support/fixtures';
import { type Locale, PAGE_KEYS } from '../support/routes';
import { bodyText, open, tid } from '../support/ui';

// --- Ca kiểm lúc build ---------------------------------------------------------------------------------------------
test('FIG-02 Số liệu thiếu nguồn thì build đỏ (@S7 @kiem-luc-build @cho-khach:N14 @cho-khach:N30)', () => {
  const r = buildSite(
    figuresFile([
      figure({
        key: 'giam-the-tich',
        value: '90',
        unit: { vi: '%', en: '%' },
        label: { vi: 'Giảm thể tích', en: 'Volume reduction' },
        source: null,
      }),
    ]),
  );
  expect(r.ok).toBe(false);
  expect(r.log).toContain('Giảm thể tích');
  expect(r.log).toContain('tên tài liệu nguồn');
});

test('FIG-03 Số liệu "được công bố" = không thì không có trong bản build (@S7 @kiem-luc-build)', () => {
  const r = buildSite(
    figuresFile([
      figure({ key: 'cong-suat', value: '4815162342', label: { vi: 'Công suất', en: 'Capacity' }, public: false }),
    ]),
  );
  expect(r.ok, r.log).toBe(true);
  for (const f of r.files().filter((x) => /\.(html|json|txt|xml|js|css)$/.test(x))) {
    const t = r.read(f)!;
    expect(t, f).not.toContain('Công suất');
    expect(t, f).not.toContain('4815162342');
  }
});

test('FIG-05 Cụm tuyên bố môi trường chưa nguồn thì build đỏ (@S7 @kiem-luc-build @cho-khach:N6)', () => {
  const r = buildSite(pageFile('about', 'vi', 'Công nghệ tiệm cận không phát thải.'));
  expect(r.ok).toBe(false);
  expect(r.log).toContain('tiệm cận không phát thải');
  expect(r.log).toMatch(/about|gioi-thieu/);
});

test('FIG-08 Ảnh chưa khai loại thì build đỏ (@S17 @kiem-luc-build)', () => {
  const r = buildSite({
    ...imageMeta('xuong-01', { kind: null }),
    'images/xuong-01.jpg': bytesOfSize(2048, JPEG_HEAD),
  });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('xuong-01: thiếu loại ảnh (Ảnh chụp thật hoặc Ảnh dựng/AI)');
});

test('FIG-09 Ảnh có người chưa có đồng ý thì không có trong bản build (@S17 @kiem-luc-build @cho-khach:N16)', () => {
  const r = buildSite({
    ...imageMeta('le-khoi-cong', { hasPeople: true }),
    'images/le-khoi-cong.jpg': bytesOfSize(2048, JPEG_HEAD),
    ...newsFiles('khoi-cong', {
      vi: { title: 'Lễ khởi công', heroImage: 'images/le-khoi-cong.jpg' },
      en: { title: 'Groundbreaking', heroImage: 'images/le-khoi-cong.jpg' },
    }),
  });
  expect(r.ok, r.log).toBe(true); // build không đỏ: ảnh chỉ bị loại khỏi đầu ra (feature: "không có trong bản build")
  expect(r.files().filter((f) => f.includes('le-khoi-cong') && !/\.(html|txt)$/.test(f))).toEqual([]);
  const html = r
    .files()
    .filter((f) => f.endsWith('.html'))
    .map((f) => r.read(f)!)
    .join('\n');
  expect(html).not.toContain('le-khoi-cong');
});

test('FIG-10 Ảnh chưa khai có người hay không thì build đỏ (@S17 @kiem-luc-build)', () => {
  const r = buildSite({ ...imageMeta('le-01', { hasPeople: null }), 'images/le-01.jpg': bytesOfSize(2048, JPEG_HEAD) });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('le-01');
  expect(r.log).toContain('có người nhận diện được');
});

for (const [file, head, size, reason] of [
  ['so-do.gif', GIF_HEAD, 2048, 'loại tệp không cho phép'],
  ['anh-lon.jpg', JPEG_HEAD, IMAGE_MAX_BYTES + 1, 'vượt trần dung lượng'],
] as const) {
  test(`FIG-11 Ảnh "${file}" ${reason} thì build đỏ (@S17 @kiem-luc-build)`, () => {
    const name = file.replace(/\.[a-z]+$/, '');
    const r = buildSite({ ...imageMeta(name), [`images/${file}`]: bytesOfSize(size, [...head]) });
    expect(r.ok).toBe(false);
    expect(r.log).toContain(file);
    expect(r.log).toContain(reason);
  });
}

test('FIG-12 Ảnh trong bản build không còn EXIF (@S17 @kiem-luc-build)', () => {
  const r = buildSite({
    ...imageMeta('flycam-01'),
    'images/flycam-01.jpg': jpegWithExif(),
    ...newsFiles('bay', { vi: { heroImage: 'images/flycam-01.jpg' }, en: { heroImage: 'images/flycam-01.jpg' } }),
  });
  expect(r.ok, r.log).toBe(true);
  const out = r.files().filter((f) => f.includes('flycam-01') && /\.(jpe?g|webp|png)$/.test(f));
  expect(out.length, 'ảnh phải có trong bản build').toBeGreaterThan(0);
  for (const f of out) {
    const bin = r.read(f)!;
    expect(bin, f).not.toContain('Exif');
    expect(bin, f).not.toContain('GPS');
    expect(bin, f).not.toContain('FlycamX');
  }
});

// FIG-13/14/16/17/18/19 đã bỏ ở lượt 0k (V38/V39: thực thể Đối tác và mã PARTNER_* không còn trong contract).
// Thay bằng IMG-10/IMG-11 và M40-10 (xem test-plan.md 0k A).

test('FIG-20 FormStatus: thiếu CONTACT_MAIL_READY ⇒ out/form-status.json open=false; "true" + đủ V3/V14/N27 ⇒ open=true (@S19 build.ts §9)', () => {
  const closed = buildSite({}, { CONTACT_MAIL_READY: 'false' });
  expect(closed.ok, closed.log).toBe(true);
  expect(JSON.parse(closed.read('form-status.json') ?? '{}').open).toBe(false);
  const open = buildSite({}, { CONTACT_MAIL_READY: 'true' });
  const st = JSON.parse(open.read('form-status.json') ?? '{}');
  expect(st).toHaveProperty('open');
  expect(Array.isArray(st.reasons)).toBe(true);
});

test('FIG-15 Bảng so sánh có số thiếu nguồn thì build đỏ (@S33 @kiem-luc-build @cho-khach:N6 @cho-khach:N25)', () => {
  const rows = ['nhiet-phan', 'dot', 'chon-lap', 'u-compost'];
  const figs = rows.map((k) =>
    figure({ key: `so-sanh-${k}`, label: { vi: k, en: k }, source: k === 'dot' ? null : 'Nguồn mẫu' }),
  );
  const table = '| Phương pháp | Số |\n|---|---|\n' + rows.map((k) => `| ${k} | {{figure:so-sanh-${k}}} |`).join('\n');
  const r = buildSite({
    ...figuresFile(figs),
    ...pageFile('technology', 'vi', table),
    ...pageFile('technology', 'en', table),
  });
  expect(r.ok).toBe(false);
  expect(r.log).toMatch(/bảng so sánh/i);
  expect(r.log).toContain('đốt');
  expect(r.log).toMatch(/nguồn/i);
});

// --- Ca đọc bản build đang chạy (static + wrangler dev) --------------------------------------------------------------
test('FIG-01 Số liệu có nguồn đã xác nhận thì hiện (@S7 @cho-khach:N6 @cho-khach:N25)', async ({ page }) => {
  // Trình duyệt mở site dựng từ nội dung có 1 Số liệu hợp lệ (SITE_FIXTURE=figure-ok, XQ-21).
  await open(page, 'home', 'vi');
  const strip = tid(page, 'figures-strip');
  await expect(strip).toContainText('5 ha');
  await expect(strip).toContainText('Diện tích nhà máy');
});

test('FIG-04 Không có Số liệu nào được phép thì dải số liệu ẩn hẳn (@S7)', async ({ page }) => {
  for (const l of ['vi', 'en'] as Locale[]) {
    await open(page, 'home', l);
    await expect(tid(page, 'figures-strip')).toHaveCount(0);
    expect(await bodyText(page)).not.toMatch(/đang cập nhật|updating/i);
  }
});

test('FIG-06 Không trang công khai nào có tuyên bố môi trường chưa nguồn (@S7 @cho-khach:N6)', async ({ page }) => {
  const banned = /không phát thải|tiệm cận không phát thải|zero[- ]emission|giảm hơn 90\s?%|>\s?90\s?%|&gt;\s?90\s?%/i;
  for (const l of ['vi', 'en'] as Locale[])
    for (const key of PAGE_KEYS) {
      await open(page, key, l);
      expect(`${l}/${key}: ${await bodyText(page)}`).not.toMatch(banned);
    }
});

for (const [locale, label] of [
  ['vi', 'Phối cảnh dự kiến'],
  ['en', "Artist's impression"],
] as Array<[Locale, string]>) {
  test(`FIG-07 Ảnh dựng/AI luôn có nhãn nhìn thấy (${locale}) (@S17 @cho-khach:N17)`, async ({ page }) => {
    await open(page, 'home', locale); // SITE_FIXTURE có ảnh "cover" kind "anh-dung-ai" ở trang chủ (XQ-21)
    const fig = tid(page, 'home-cover');
    await expect(fig).toBeVisible();
    // Feature @S17: chữ nhãn nhìn thấy được ngay trên/dưới ảnh, không chỉ nằm trong alt.
    const caption = fig.locator('figcaption, [data-testid="photo-label"]').first();
    await expect(caption).toBeVisible();
    expect((await caption.innerText()).trim()).toContain(label);
  });
}

void BASE_CONTENT;
