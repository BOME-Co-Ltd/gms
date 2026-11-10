// Kiểm trang đã gỡ (CO-01): mỗi mã RETIRED_PAGE_ERROR có ca đỏ + ca xanh; public/_redirects khớp contract.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RETIRED_PAGE_ERROR,
  RETIRED_PAGE_REDIRECTS,
  RETIRED_PATH_PATTERN,
  retiredRedirectLine,
} from '../../../../contracts/routes.ts';
import {
  retiredAnchorErrors,
  retiredOutputErrors,
  retiredPathErrors,
  retiredRedirectErrors,
  retiredSlugErrors,
} from './retired.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const REDIRECTS = `${RETIRED_PAGE_REDIRECTS.map(retiredRedirectLine).join('\n')}\n`;
const tech = (lang: string, ids: string[]) =>
  `<html lang="${lang}"><body>${ids.map((i) => `<section id="${i}"></section>`).join('')}<a href="#${ids[0] ?? 'x'}">x</a></body></html>`;

function makeOut(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'retired-'));
  dirs.push(dir);
  const all: Record<string, string> = {
    _redirects: REDIRECTS,
    'cong-nghe.html': tech('vi', ['giai-phap']),
    'en/technology.html': tech('en', ['solutions']),
    ...files,
  };
  for (const [rel, body] of Object.entries(all)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}

describe('public/_redirects', () => {
  it('có đúng 4 dòng bằng retiredRedirectLine, theo thứ tự contract', () => {
    const file = readFileSync(join(import.meta.dirname, '..', '..', '..', '..', 'public', '_redirects'), 'utf8');
    expect(file.split('\n').filter(Boolean)).toEqual(RETIRED_PAGE_REDIRECTS.map(retiredRedirectLine));
    expect(RETIRED_PAGE_REDIRECTS).toHaveLength(4);
  });
});

describe(RETIRED_PAGE_ERROR.redirectMissing, () => {
  it('xanh khi đủ 4 dòng', () => expect(retiredRedirectErrors(makeOut())).toEqual([]));
  it('đỏ khi thiếu dòng có "/" cuối', () => {
    const out = makeOut({ _redirects: REDIRECTS.replace('/en/solutions/ /en/technology#solutions 301\n', '') });
    const errs = retiredRedirectErrors(out);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain(RETIRED_PAGE_ERROR.redirectMissing);
    expect(errs[0]).toContain('/en/solutions/');
  });
  it('đỏ khi không có tệp _redirects', () => {
    const out = makeOut();
    rmSync(join(out, '_redirects'));
    expect(retiredRedirectErrors(out)).toHaveLength(4);
  });
  it('đỏ khi có dòng khác cùng nguồn (đích có query)', () => {
    const out = makeOut({ _redirects: `${REDIRECTS}/giai-phap /cong-nghe?x=1#giai-phap 301\n` });
    expect(retiredRedirectErrors(out).join('\n')).toContain('/giai-phap /cong-nghe?x=1#giai-phap 301');
  });
});

describe(RETIRED_PAGE_ERROR.anchorMissing, () => {
  it('xanh khi hai trang Công nghệ có đúng một neo', () => expect(retiredAnchorErrors(makeOut())).toEqual([]));
  it('đỏ khi thiếu neo vi', () => {
    const errs = retiredAnchorErrors(makeOut({ 'cong-nghe.html': tech('vi', ['sang-tuyen']) }));
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('id="giai-phap"');
  });
  it('đỏ khi thiếu neo en (khối Giải pháp rỗng ⇒ ẩn)', () => {
    expect(retiredAnchorErrors(makeOut({ 'en/technology.html': tech('en', []) }))[0]).toContain('id="solutions"');
  });
  it('đỏ khi neo lặp hai lần', () => {
    expect(retiredAnchorErrors(makeOut({ 'cong-nghe.html': tech('vi', ['giai-phap', 'giai-phap']) }))[0]).toContain(
      'có 2',
    );
  });
  it('chip href="#giai-phap" không được tính là neo', () => {
    const html = '<html lang="vi"><a href="#giai-phap">Giải pháp</a></html>';
    expect(retiredAnchorErrors(makeOut({ 'cong-nghe.html': html }))[0]).toContain('có 0');
  });
  it('đỏ khi lang sai', () => {
    expect(retiredAnchorErrors(makeOut({ 'en/technology.html': tech('vi', ['solutions']) }))[0]).toContain('lang=vi');
  });
  it('nhận cả dạng X/index.html', () => {
    const out = makeOut();
    rmSync(join(out, 'cong-nghe.html'));
    mkdirSync(join(out, 'cong-nghe'));
    writeFileSync(join(out, 'cong-nghe', 'index.html'), tech('vi', ['giai-phap']));
    expect(retiredAnchorErrors(out)).toEqual([]);
  });
});

describe(RETIRED_PAGE_ERROR.pathInOutput, () => {
  it('xanh với neo #giai-phap, /giai-phap-moi, giai-phap.jpg và en/news/solutions', () => {
    const body =
      '<a href="#giai-phap">a</a><a href="/giai-phap-moi">b</a><img src="/img/giai-phap.jpg"><a href="/en/news/solutions">c</a>';
    expect(retiredPathErrors(makeOut({ 'index.html': body }))).toEqual([]);
  });
  for (const bad of [
    '/giai-phap',
    '/giai-phap/',
    '/giai-phap?utm=1',
    '/giai-phap#x',
    '/en/solutions',
    'https://gms.vn/en/solutions/',
  ]) {
    it(`đỏ khi nội dung còn ${bad}`, () => {
      const errs = retiredPathErrors(makeOut({ 'index.html': `<a href="${bad}">x</a>` }));
      expect(errs).toHaveLength(1);
      expect(errs[0]).toContain(RETIRED_PAGE_ERROR.pathInOutput);
    });
  }
  it('đỏ khi sitemap chứa đường cũ', () => {
    expect(retiredPathErrors(makeOut({ 'sitemap.xml': '<loc>https://x.vn/giai-phap</loc>' }))).toHaveLength(1);
  });
  it('không đếm chính _redirects', () => expect(retiredPathErrors(makeOut())).toEqual([]));
  for (const f of ['giai-phap.html', 'giai-phap/index.html', 'en/solutions.html', 'en/solutions/index.html']) {
    it(`đỏ khi có tệp ${f}`, () => {
      const errs = retiredPathErrors(makeOut({ [f]: '<html></html>' }));
      expect(errs.some((e) => e.includes(`tệp phục vụ đường đã gỡ: ${f}`))).toBe(true);
    });
  }
  it('mẫu RETIRED_PATH_PATTERN không bắt /tin-tuc/giai-phap-moi', () => {
    expect(RETIRED_PATH_PATTERN.test('/tin-tuc/giai-phap-moi')).toBe(false);
  });
});

describe(RETIRED_PAGE_ERROR.slugReserved, () => {
  const item = (slug: string) => ({ slug });
  const none = { vi: [], en: [] };
  it('xanh khi slug thường; en/news/solutions không bị cấm', () => {
    expect(
      retiredSlugErrors({
        news: { vi: [item('tin-1')], en: [item('solutions')] },
        projects: none,
        jobs: none,
      } as never),
    ).toEqual([]);
  });
  it('đỏ khi slug vi là giai-phap ở Tin, Dự án hoặc Tuyển dụng', () => {
    const errs = retiredSlugErrors({
      news: { vi: [item('giai-phap')], en: [] },
      projects: { vi: [item('giai-phap')], en: [] },
      jobs: { vi: [item('giai-phap')], en: [] },
    } as never);
    expect(errs).toHaveLength(3);
    expect(errs[0]).toContain(RETIRED_PAGE_ERROR.slugReserved);
  });
});

describe('retiredOutputErrors', () => {
  it('gộp ba kiểm; out/ sạch ⇒ rỗng', () => expect(retiredOutputErrors(makeOut())).toEqual([]));
});
