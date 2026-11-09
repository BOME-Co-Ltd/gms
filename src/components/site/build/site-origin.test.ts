import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_URL, resolveSiteEnv, resolveSiteUrl } from './config.ts';

describe('resolveSiteUrl', () => {
  it('không biến nào ⇒ mặc định (máy/CI giữ nguyên)', () => {
    expect(resolveSiteUrl({})).toBe(DEFAULT_SITE_URL);
  });
  it('SITE_URL khai tường minh thắng, bỏ "/" cuối, kể cả trên Vercel', () => {
    expect(resolveSiteUrl({ SITE_URL: 'https://gms.vn/', VERCEL: '1', VERCEL_URL: 'a.vercel.app' })).toBe(
      'https://gms.vn',
    );
  });
  it('Vercel: ưu tiên VERCEL_PROJECT_PRODUCTION_URL, rồi VERCEL_URL, thêm https://', () => {
    expect(
      resolveSiteUrl({ VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'p.vercel.app', VERCEL_URL: 'd.vercel.app' }),
    ).toBe('https://p.vercel.app');
    expect(resolveSiteUrl({ VERCEL: '1', VERCEL_URL: 'gms-hungyen-web-roan.vercel.app' })).toBe(
      'https://gms-hungyen-web-roan.vercel.app',
    );
  });
  it('biến Vercel nhưng không phải build Vercel ⇒ bỏ qua; Vercel không có biến nào ⇒ mặc định', () => {
    expect(resolveSiteUrl({ VERCEL_URL: 'd.vercel.app' })).toBe(DEFAULT_SITE_URL);
    expect(resolveSiteUrl({ VERCEL: '1' })).toBe(DEFAULT_SITE_URL);
  });
});

describe('resolveSiteEnv (chọn robots: staging ⇒ noindex + Disallow /)', () => {
  it('máy/CI ⇒ test (index, follow)', () => {
    expect(resolveSiteEnv({})).toBe('test');
  });
  it('Vercel không có SITE_URL ⇒ staging', () => {
    expect(resolveSiteEnv({ VERCEL: '1', VERCEL_URL: 'd.vercel.app' })).toBe('staging');
  });
  it('Vercel có SITE_URL tường minh ⇒ không ép staging', () => {
    expect(resolveSiteEnv({ VERCEL: '1', SITE_URL: 'https://gms.vn' })).toBe('test');
  });
  it('SITE_ENV khai tường minh luôn được giữ', () => {
    expect(resolveSiteEnv({ VERCEL: '1', SITE_ENV: 'production' })).toBe('production');
    expect(resolveSiteEnv({ SITE_ENV: 'staging' })).toBe('staging');
  });
});
