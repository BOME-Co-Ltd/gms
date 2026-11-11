import { describe, expect, it } from 'vitest';
import { apiProxyRoutes, buildVercelConfig, parseRedirectsFile } from '../../scripts/deploy/vercel-output.ts';

describe('vercel-output: /api → Worker', () => {
  it('không khai GMS_API_ORIGIN ⇒ không có route proxy', () => {
    expect(apiProxyRoutes(undefined)).toEqual([]);
    expect(apiProxyRoutes({ origin: '' })).toEqual([]);
  });

  it('route proxy đứng đầu, gắn x-gms-proxy khi có secret', () => {
    const cfg = buildVercelConfig('', '/giai-phap /cong-nghe#giai-phap 301\n', {
      origin: 'https://gms-contact.vi-du.workers.dev/',
      secret: 's3cret',
    });
    expect(cfg.routes[0]).toEqual({
      src: '^/api/(.*)$',
      dest: 'https://gms-contact.vi-du.workers.dev/api/$1',
      transforms: [{ type: 'request.headers', op: 'set', target: { key: 'x-gms-proxy' }, args: 's3cret' }],
    });
    expect(cfg.routes[1]).toEqual(parseRedirectsFile('/giai-phap /cong-nghe#giai-phap 301')[0]);
  });

  it('origin phải là https không có đường dẫn', () => {
    expect(() => apiProxyRoutes({ origin: 'http://x.workers.dev' })).toThrow(/GMS_API_ORIGIN/);
    expect(() => apiProxyRoutes({ origin: 'https://x.workers.dev/api' })).toThrow(/GMS_API_ORIGIN/);
  });
});
