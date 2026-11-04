// Stub Turnstile cho e2e (bàn giao 05/11, bước 1). Chặn mạng ra challenges.cloudflare.com và trả một api.js giả
// hành xử như sitekey thử `1x00000000000000000000AA` của Cloudflare: render(explicit) gọi callback với token thử, reset() cấp token mới.
// Không đổi điều kiện kiểm: script giả nạp ĐÚNG URL thật nên CSP, nạp-khi-chạm (ux-spec §5.3) và onload của trang vẫn bị kiểm.
// Worker bản test vẫn quyết đạt/không theo control.humanCheck(mode) như trước. Muốn dùng widget thật: TURNSTILE_REAL=1.
import { test as base, expect } from '@playwright/test';
import { TURNSTILE_TEST_TOKEN } from './env';

const stubScript = (onload: string) => `(() => {
  const TOKEN = ${JSON.stringify(TURNSTILE_TEST_TOKEN)};
  const widgets = {};
  let n = 0;
  const issue = (id) => { const o = widgets[id]; if (o && typeof o.callback === 'function') setTimeout(() => o.callback(TOKEN), 50); };
  window.turnstile = {
    render(el, opts) { const id = 'stub-' + ++n; widgets[id] = opts || {}; issue(id); return id; },
    reset(id) { issue(id); },
    remove(id) { delete widgets[id]; },
    getResponse() { return TOKEN; },
    ready(fn) { fn(); },
  };
  const cb = ${JSON.stringify(onload)};
  if (cb && typeof window[cb] === 'function') window[cb]();
})();`;

export const test = base.extend<{ turnstileStub: void }>({
  turnstileStub: [
    async ({ context }, use) => {
      if (process.env.TURNSTILE_REAL !== '1') {
        await context.route('https://challenges.cloudflare.com/**', (route) => {
          const url = new URL(route.request().url());
          if (!url.pathname.startsWith('/turnstile/v0/api.js')) return route.fulfill({ status: 204, body: '' });
          return route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: stubScript(url.searchParams.get('onload') ?? ''),
          });
        });
      }
      await use();
    },
    { auto: true },
  ],
});
export { expect };
