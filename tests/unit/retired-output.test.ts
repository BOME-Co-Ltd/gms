// CO-01 / S32 — luật "trang đã gỡ" ở mức đơn vị (thay overlay public/ của SEO-19/20 vì bản build không chép public/ của bản chép).
// Dựng out/ tạm; gọi hàm output-check (src/components/site/build/retired.ts, chữ ký (outDir) ⇒ string[] dạng "[MÃ] mô tả").
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { retiredPathErrors, retiredRedirectErrors } from '../../src/components/site/build/retired.ts';
import { RETIRED_ERR, RETIRED_REDIRECTS } from '../support/routes';

const LINES = RETIRED_REDIRECTS.map((x) => `${x.from} ${x.to} 301`);
const dirs: string[] = [];
function out(files: Record<string, string>) {
  const d = mkdtempSync(join(tmpdir(), 'qa-retired-'));
  dirs.push(d);
  for (const [rel, data] of Object.entries(files)) {
    const p = join(d, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, data);
  }
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('CO-01 trang đã gỡ trên out/ tạm', () => {
  it('đối chứng: đủ 4 dòng, không tệp cũ ⇒ không lỗi', () => {
    const d = out({ '_redirects': `${LINES.join('\n')}\n`, 'index.html': '<p>x</p>' });
    expect(retiredRedirectErrors(d)).toEqual([]);
    expect(retiredPathErrors(d)).toEqual([]);
  });

  it('SEO-19 thiếu một dòng 301 ⇒ RETIRED_REDIRECT_MISSING', () => {
    const d = out({ '_redirects': `${LINES.slice(1).join('\n')}\n` });
    expect(retiredRedirectErrors(d).some((s) => s.includes(RETIRED_ERR.redirectMissing))).toBe(true);
  });

  it('SEO-19 _redirects chỉ có dòng không liên quan ⇒ RETIRED_REDIRECT_MISSING', () => {
    const d = out({ '_redirects': '# không có dòng nào của Giải pháp\n' });
    expect(retiredRedirectErrors(d).some((s) => s.includes(RETIRED_ERR.redirectMissing))).toBe(true);
  });

  for (const f of ['giai-phap.html', 'giai-phap/index.html', 'en/solutions.html', 'en/solutions/index.html']) {
    it(`SEO-20 có out/${f} ⇒ RETIRED_PATH_IN_OUTPUT`, () => {
      const d = out({ '_redirects': `${LINES.join('\n')}\n`, [f]: '<!doctype html><title>cũ</title>' });
      expect(retiredPathErrors(d).some((s) => s.includes(RETIRED_ERR.pathInOutput))).toBe(true);
    });
  }

  it('SEO-20 nội dung HTML còn nhắc /giai-phap ⇒ RETIRED_PATH_IN_OUTPUT', () => {
    const d = out({ '_redirects': `${LINES.join('\n')}\n`, 'a.html': '<a href="/giai-phap">x</a>' });
    expect(retiredPathErrors(d).some((s) => s.includes(RETIRED_ERR.pathInOutput))).toBe(true);
  });
});
