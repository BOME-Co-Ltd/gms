// test-plan.md 0m.2 — output-check ở mức đơn vị (thay tests/acceptance/names-public-overlay.spec.ts).
//   M40-02 (denylist.yaml trong out/) · M40-04a/b/c · M40-05 · M40-06 (SVG ×4) · ca ảnh trong out/img/.
// Kỳ vọng từ contracts/build.ts §8 luật (6)(b)(c) và appsec M40; chữ ký (outDir, names) ⇒ [{code,message}] đo bằng gọi thử.
// Dựng out/ tạm chứa đúng các tệp; không ghi gì vào out/, public/, content/ thật. "Xanh Asian" chỉ là DỮ LIỆU danh sách cấm.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanOutputForForbiddenNames } from '../../src/content/rules/names.ts';

const NAME = 'Xanh Asian';
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const dirs: string[] = [];
function scan(files: Record<string, string | Buffer>) {
  const out = mkdtempSync(join(tmpdir(), 'qa-out-'));
  dirs.push(out);
  for (const [rel, data] of Object.entries(files)) {
    const p = join(out, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, data);
  }
  return scanOutputForForbiddenNames(out, [NAME]) as { code: string; message: string }[];
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('M40 output-check trên out/ tạm', () => {
  it('M40-02 denylist.yaml ở gốc hoặc thư mục con của out/ ⇒ DENYLIST_IN_OUTPUT, nêu tệp', () => {
    for (const rel of ['denylist.yaml', 'assets/denylist.yaml']) {
      const r = scan({ [rel]: `names:\n  - "${NAME}"\n` });
      expect(
        r.some((i) => i.code === 'DENYLIST_IN_OUTPUT' && i.message.includes('denylist.yaml')),
        rel,
      ).toBe(true);
    }
  });

  it('M40-04a tên trong meta description của HTML ⇒ FORBIDDEN_NAME_IN_OUTPUT, nêu tệp', () => {
    const r = scan({
      'qa-meta.html': `<!doctype html><html lang="en"><head><meta name="description" content="Based on ${NAME} documents"></head><body>x</body></html>`,
    });
    expect(r.some((i) => i.code === 'FORBIDDEN_NAME_IN_OUTPUT' && i.message.includes('qa-meta.html'))).toBe(true);
  });

  it('M40-04b tên viết liền "xanhasian" trong sitemap ⇒ FORBIDDEN_NAME_IN_OUTPUT, nêu tệp', () => {
    const r = scan({
      'qa-sitemap.xml':
        '<?xml version="1.0"?><urlset><url><loc>https://gms.example.test/xanhasian</loc></url></urlset>',
    });
    expect(r.some((i) => i.code === 'FORBIDDEN_NAME_IN_OUTPUT' && i.message.includes('qa-sitemap.xml'))).toBe(true);
  });

  it('M40-04c tên viết liền trong TÊN TỆP ảnh (đuôi nhị phân) ⇒ FORBIDDEN_NAME_IN_OUTPUT, nêu đường dẫn', () => {
    const r = scan({ 'XanhAsian.png': PNG_1X1 });
    expect(r.some((i) => i.code === 'FORBIDDEN_NAME_IN_OUTPUT' && i.message.includes('XanhAsian.png'))).toBe(true);
  });

  it('M40-img ảnh trong out/img/ có tên cấm trong tên tệp ⇒ FORBIDDEN_NAME_IN_OUTPUT (đường public/img là đường chép thật)', () => {
    const r = scan({ 'img/xanh-asian-so-do.png': PNG_1X1 });
    expect(r.some((i) => i.code === 'FORBIDDEN_NAME_IN_OUTPUT' && i.message.includes('xanh-asian-so-do.png'))).toBe(
      true,
    );
  });

  it('M40-05 tệp .js dưới _next/ chứa tên ⇒ FORBIDDEN_NAME_IN_OUTPUT, nêu tệp .js', () => {
    const r = scan({ '_next/static/chunks/qa-fixture.js': `window.__qa="${NAME}";\n` });
    expect(r.some((i) => i.code === 'FORBIDDEN_NAME_IN_OUTPUT' && i.message.includes('qa-fixture.js'))).toBe(true);
  });

  for (const v of ['Xanh Asian', 'XANH ASIAN', 'Xanhasian', 'Xạnh Ásian']) {
    it(`M40-06 (SVG) "${v}" trong SVG ⇒ FORBIDDEN_NAME_IN_OUTPUT, nêu tệp SVG, không có FORBIDDEN_NAME_IN_CONTENT`, () => {
      const r = scan({
        'qa-logo.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="0" y="5">${v}</text></svg>`,
      });
      expect(r.some((i) => i.code === 'FORBIDDEN_NAME_IN_OUTPUT' && i.message.includes('qa-logo.svg'))).toBe(true);
      expect(r.some((i) => i.code === 'FORBIDDEN_NAME_IN_CONTENT')).toBe(false);
    });
  }

  it('M40-0x (đối chứng) out/ chỉ có tệp sạch ⇒ không lỗi nào', () => {
    const r = scan({
      'qa-clean.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="0" y="5">GMS</text></svg>',
      'img/gms-line.png': PNG_1X1,
    });
    expect(r).toEqual([]);
  });
});
