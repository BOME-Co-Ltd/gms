// _headers: mỗi URL một quy tắc và chặn vượt trần quy tắc của Cloudflare.
import { describe, expect, it } from 'vitest';
import { CLOUDFLARE_HEADERS_RULE_LIMIT, countHeaderRules, cspHeaderBlocks, headersRuleLimitErrors } from './verify.ts';

const page = (rel: string, script = '') => ({
  rel,
  html: `<html><body>${script ? `<script>${script}</script>` : ''}</body></html>`,
  canonical: null,
  noindex: false,
  lang: 'vi',
});
const rules = (out: string) => out.split('\n').filter((l) => l !== '' && !l.startsWith(' '));

describe('cspHeaderBlocks', () => {
  it('khử trùng /X và /X/: mỗi URL một quy tắc, trang chủ giữ /', () => {
    const errors: string[] = [];
    const out = cspHeaderBlocks(
      [
        page('/index.html'),
        page('/gioi-thieu.html'),
        page('/gioi-thieu/index.html'),
        page('/en/about.html'),
        page('/en/about/index.html'),
      ],
      errors,
    );
    expect(rules(out)).toEqual(['/', '/gioi-thieu', '/en/about']);
    expect(errors).toEqual([]);
  });

  it('trang chỉ có dạng X/index.html vẫn có quy tắc /X', () => {
    expect(rules(cspHeaderBlocks([page('/chi-index/index.html')]))).toEqual(['/chi-index']);
  });

  it('bỏ /_not-found', () => {
    expect(rules(cspHeaderBlocks([page('/_not-found.html'), page('/404.html')]))).toEqual(['/404']);
  });

  it('cùng URL mà CSP khác nhau ⇒ báo lỗi, không chọn bừa', () => {
    const errors: string[] = [];
    const out = cspHeaderBlocks([page('/a.html', 'var x=1'), page('/a/index.html', 'var x=2')], errors);
    expect(rules(out)).toEqual(['/a']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('[HEADERS_CSP_CONFLICT] /a');
  });
});

describe('trần quy tắc _headers', () => {
  const make = (n: number) =>
    `/*\n  X: 1\n${Array.from({ length: n - 1 }, (_, i) => `/p${i}\n  Content-Security-Policy: x\n`).join('')}`;

  it('đếm dòng không thụt, không rỗng', () => {
    expect(countHeaderRules('/*\n  A: 1\n/api/*\n  B: 2\n  # /api/*\n\n')).toBe(2);
  });

  it('đúng trần thì qua, vượt trần thì [HEADERS_RULE_LIMIT]', () => {
    expect(headersRuleLimitErrors(make(CLOUDFLARE_HEADERS_RULE_LIMIT))).toEqual([]);
    const errs = headersRuleLimitErrors(make(CLOUDFLARE_HEADERS_RULE_LIMIT + 1));
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('[HEADERS_RULE_LIMIT]');
  });
});
