// test-plan.md 0k/0l — tên không được nêu ở tệp TĨNH dưới public/ (bậc BUILD, không cần Worker/trình duyệt).
//   M40-02 (hàng public/) · M40-04 · M40-05 · M40-06 (hàng SVG).
// Cách đặt fixture (admin quyết 07/11, XQ-QA-M40-1): tệp được chèn vào BẢN CHÉP thư mục nền ở thư mục tạm (buildSite 3 tham số);
// không ghi gì vào public/, src/, content/ thật. "Xanh Asian" chỉ là DỮ LIỆU của danh sách cấm (BASE_CONTENT denylist.yaml).
// Chênh với test-plan 0k: M40-04 hàng "meta description trang Công nghệ en" và "sitemap" là chữ do khuôn/mã sinh; qa không sửa mã,
// nên dùng tệp tĩnh public/ có cùng nội dung (meta description, sitemap) — đúng đường "tệp tĩnh đưa vào" của feature :161–174.
import { expect, test } from '@playwright/test';
import { buildSite, type Files } from '../support/build';
import { PNG_1X1 } from '../support/fixtures';

const NAME = 'Xanh Asian';
const build = (overlay: Record<string, string | Buffer>, files: Files = {}) =>
  buildSite(files, { SITE_ENV: 'test' }, overlay);

test('M40-02 (public/) Tệp denylist.yaml chép vào public/ hoặc public/assets/ thì build đỏ DENYLIST_IN_OUTPUT, nêu tệp', () => {
  for (const rel of ['public/denylist.yaml', 'public/assets/denylist.yaml']) {
    const r = build({ [rel]: `names:\n  - "${NAME}"\n` });
    expect(r.ok, `${rel}: build phải đỏ`).toBe(false);
    expect(r.log, rel).toContain('DENYLIST_IN_OUTPUT');
    expect(r.log, rel).toContain('denylist.yaml');
  }
});

test('M40-04a Tên trong meta description của tệp HTML tĩnh thì build đỏ FORBIDDEN_NAME_IN_OUTPUT, nêu tệp đầu ra', () => {
  const r = build({
    'public/qa-meta.html': `<!doctype html><html lang="en"><head><meta name="description" content="Based on ${NAME} documents"></head><body>x</body></html>`,
  });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('FORBIDDEN_NAME_IN_OUTPUT');
  expect(r.log).toContain('qa-meta.html');
});

test('M40-04b Tên viết liền "xanhasian" trong tệp sitemap tĩnh thì build đỏ FORBIDDEN_NAME_IN_OUTPUT, nêu tệp', () => {
  const r = build({
    'public/qa-sitemap.xml':
      '<?xml version="1.0"?><urlset><url><loc>https://gms.example.test/xanhasian</loc></url></urlset>',
  });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('FORBIDDEN_NAME_IN_OUTPUT');
  expect(r.log).toContain('qa-sitemap.xml');
});

test('M40-04c Tên viết liền trong TÊN TỆP ảnh thì build đỏ FORBIDDEN_NAME_IN_OUTPUT, log nêu đường dẫn tệp', () => {
  const r = build({ 'public/img/XanhAsian.png': PNG_1X1 });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('FORBIDDEN_NAME_IN_OUTPUT');
  expect(r.log).toContain('XanhAsian.png');
});

test('M40-05 Tệp .js dưới _next/ chứa tên thì build đỏ FORBIDDEN_NAME_IN_OUTPUT, nêu tệp .js (đuôi không thuộc nhóm nhị phân)', () => {
  const r = build({ 'public/_next/static/chunks/qa-fixture.js': `window.__qa="${NAME}";\n` });
  expect(r.ok).toBe(false);
  expect(r.log).toContain('FORBIDDEN_NAME_IN_OUTPUT');
  expect(r.log).toContain('qa-fixture.js');
});

for (const v of ['Xanh Asian', 'XANH ASIAN', 'Xanhasian', 'Xạnh Ásian']) {
  test(`M40-06 (SVG) "${v}" trong tệp SVG ở public/ thì build đỏ FORBIDDEN_NAME_IN_OUTPUT, nêu tệp SVG`, () => {
    const r = build({
      'public/qa-logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="0" y="5">${v}</text></svg>`,
    });
    expect(r.ok).toBe(false);
    expect(r.log).toContain('FORBIDDEN_NAME_IN_OUTPUT');
    expect(r.log).not.toContain('FORBIDDEN_NAME_IN_CONTENT');
    expect(r.log).toContain('qa-logo.svg');
  });
}

// Đối chứng: cùng bản chép, tệp tĩnh KHÔNG có tên ⇒ build xanh và tệp có trong out/ (chứng minh public/ được chép sang out/,
// nên các ca đỏ ở trên đỏ vì tên chứ không vì lý do khác).
test('M40-0x (đối chứng) Tệp tĩnh public/ không chứa tên thì build xanh và được chép sang out/', () => {
  const r = build({
    'public/qa-clean.svg':
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="0" y="5">GMS</text></svg>',
  });
  expect(r.ok, r.log).toBe(true);
  expect(r.has('qa-clean.svg'), 'public/ phải được chép nguyên sang out/').toBe(true);
});
