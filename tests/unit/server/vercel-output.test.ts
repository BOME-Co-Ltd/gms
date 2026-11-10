// Unit test cho scripts/deploy/vercel-output.ts: kỳ vọng theo mô tả ở đầu file (Build Output API v3, _headers/_redirects Cloudflare).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildVercelConfig,
  headerPathToSrc,
  parseHeadersFile,
  parseRedirectsFile,
  writeVercelOutput,
} from '../../../scripts/deploy/vercel-output';

describe('headerPathToSrc', () => {
  it('thoát ký tự regex và đổi * thành .*', () => {
    expect(headerPathToSrc('/a.b/*')).toBe('^/a\\.b/.*$');
    const re = new RegExp(headerPathToSrc('/_next/static/*'));
    expect(re.test('/_next/static/x/y.js')).toBe(true);
    expect(re.test('/other')).toBe(false);
  });
});

describe('parseHeadersFile', () => {
  it('đọc khối, bỏ chú thích/dòng trống, nối header trùng tên bằng dấu phẩy', () => {
    const text = [
      '# chú thích',
      '',
      '/*',
      '  X-Frame-Options: DENY',
      '  Link: <a>',
      '  Link: <b>',
      '  dong-khong-co-dau-hai-cham',
      '/trong',
      '# khối không header',
      '/lien-he',
      "  Content-Security-Policy: default-src 'self'",
      '',
    ].join('\n');
    expect(parseHeadersFile(text)).toEqual([
      { src: '^/.*$', headers: { 'X-Frame-Options': 'DENY', Link: '<a>, <b>' }, continue: true },
      { src: '^/lien-he$', headers: { 'Content-Security-Policy': "default-src 'self'" }, continue: true },
    ]);
  });

  it('bỏ qua dòng thụt vào khi chưa có khối và file rỗng', () => {
    expect(parseHeadersFile('  X: y\n')).toEqual([]);
    expect(parseHeadersFile('')).toEqual([]);
  });
});

describe('parseRedirectsFile', () => {
  it('đổi 301/308 hợp lệ thành route, bỏ dòng sai cú pháp, chú thích, // và mã khác', () => {
    const text = [
      '# c',
      '',
      '/cu /moi 301',
      '/a/ /b 308',
      '/ /home 301',
      '//evil /x 301',
      '/x //evil 301',
      '/y /z 302',
      'rac',
    ].join('\n');
    expect(parseRedirectsFile(text)).toEqual([
      { src: '^/cu/?$', status: 301, headers: { Location: '/moi' } },
      { src: '^/a/?$', status: 308, headers: { Location: '/b' } },
      { src: '^//?$', status: 301, headers: { Location: '/home' } },
    ]);
  });
});

describe('buildVercelConfig', () => {
  it('đặt route theo thứ tự: redirect, bỏ "/" cuối, header, filesystem, .html, 404', () => {
    const cfg = buildVercelConfig('/*\n  X-A: 1\n', '/cu /moi 301\n');
    expect(cfg.version).toBe(3);
    expect(cfg.routes.map((r) => r.src ?? r.handle)).toEqual([
      '^/cu/?$',
      '^/(.+)/$',
      '^/.*$',
      'filesystem',
      '^/(.+)$',
      'error',
      '^/.*$',
    ]);
    expect(cfg.routes.at(-1)).toMatchObject({ dest: '/404.html', status: 404 });
  });

  it('redirectsText mặc định rỗng', () => {
    expect(buildVercelConfig('').routes).toHaveLength(5);
  });
});

describe('writeVercelOutput', () => {
  let tmp: string;
  let out: string;
  let target: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'vercel-output-'));
    out = join(tmp, 'out');
    target = join(tmp, '.vercel', 'output');
    mkdirSync(join(out, 'gioi-thieu'), { recursive: true });
    writeFileSync(join(out, 'index.html'), '<html></html>');
    writeFileSync(join(out, 'gioi-thieu', 'index.html'), 'gt');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('báo lỗi khi thiếu index.html', () => {
    rmSync(join(out, 'index.html'));
    expect(() => writeVercelOutput(out, target)).toThrow(/index\.html/);
  });

  it('chép out/ vào static, bỏ _headers/_redirects, ghi config.json', () => {
    writeFileSync(join(out, '_headers'), '/*\n  X-A: 1\n');
    writeFileSync(join(out, '_redirects'), '/cu /moi 301\n');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'cu.txt'), 'x');
    writeVercelOutput(out, target);
    expect(existsSync(join(target, 'cu.txt'))).toBe(false);
    expect(existsSync(join(target, 'static', 'index.html'))).toBe(true);
    expect(existsSync(join(target, 'static', 'gioi-thieu', 'index.html'))).toBe(true);
    expect(existsSync(join(target, 'static', '_headers'))).toBe(false);
    expect(existsSync(join(target, 'static', '_redirects'))).toBe(false);
    const cfg = JSON.parse(readFileSync(join(target, 'config.json'), 'utf8'));
    expect(cfg.routes[0].src).toBe('^/cu/?$');
    expect(cfg.routes.some((r: { continue?: boolean }) => r.continue === true)).toBe(true);
    expect(console.log).toHaveBeenCalledOnce();
  });

  it('không có _headers/_redirects vẫn chạy', () => {
    writeVercelOutput(out, target);
    const cfg = JSON.parse(readFileSync(join(target, 'config.json'), 'utf8'));
    expect(cfg.routes).toHaveLength(5);
  });
});
