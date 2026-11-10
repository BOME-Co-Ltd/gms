// performance-and-accessibility.feature → PERF-05..PERF-10 (S4, S5). Chạy trên cùng danh sách trang đo.
// [giả định — chờ khách] D6 (mức hiệu ứng khi KHÔNG bật giảm chuyển động) — test chỉ kiểm nhánh reduce.
// Phụ thuộc cần cài (pha 2): @axe-core/playwright.

import { listTargets } from '../support/perf';
import { type Locale, path } from '../support/routes';
import { expect, test } from '../support/turnstile-stub';
import { bodyText, expectNoHorizontalScroll, tid } from '../support/ui';

const axeModule = '@axe-core/playwright'; // import động: pha 1 chưa có package
// v0.3: site tĩnh ⇒ không còn dựng dữ liệu đo bằng cổng điều khiển; trang đo lấy từ bản build mẫu (support/perf.ts, XQ-21).

for (const width of [375, 320]) {
  test(`PERF-05 Không cuộn ngang, chữ >= 16px, vùng bấm >= 24x24 ở ${width}px (@S4)`, async ({ page }) => {
    const targets = listTargets();
    await page.setViewportSize({ width, height: 800 });
    for (const t of targets) {
      await page.goto(t.url);
      await expectNoHorizontalScroll(page);
      const body = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
      expect(body, `${t.url} cỡ chữ thân bài`).toBeGreaterThanOrEqual(16);
      const small = await page.locator('a, button, input, select, textarea, summary').evaluateAll((els) =>
        els
          .filter((e) => {
            const r = (e as HTMLElement).getBoundingClientRect();
            return (
              r.width > 0 &&
              r.height > 0 &&
              (r.width < 24 || r.height < 24) &&
              getComputedStyle(e).visibility !== 'hidden' &&
              (e as HTMLInputElement).type !== 'hidden'
            );
          })
          .map((e) => (e as HTMLElement).outerHTML.slice(0, 80)),
      );
      expect(small, `${t.url} vùng bấm nhỏ`).toEqual([]);
    }
  });
}

test('PERF-06 Bảng dài ở 375px không làm cả trang cuộn ngang, không cắt chữ (@S4)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(path('products', 'en')); // bản mẫu có tên đầu ra dài nhất (XQ-21)
  await expectNoHorizontalScroll(page);
  const clipped = await page.locator('[data-testid="output-row"] *').evaluateAll((els) =>
    els
      .filter((e) => {
        const s = getComputedStyle(e);
        const el = e as HTMLElement;
        return el.scrollWidth > el.clientWidth + 1 && s.overflowX !== 'auto' && s.overflowX !== 'scroll';
      })
      .map((e) => (e as HTMLElement).innerText.slice(0, 60)),
  );
  expect(clipped, 'chữ bị cắt').toEqual([]);
  const textClip = await page
    .locator('[data-testid="output-row"] *')
    .evaluateAll((els) => els.filter((e) => getComputedStyle(e).textOverflow === 'ellipsis').length);
  expect(textClip, 'không dùng ellipsis che chữ').toBe(0);
});

test('PERF-07 Không lỗi tiếp cận serious/critical trên mọi trang (@S4)', async ({ page }) => {
  test.setTimeout(300_000); // cuộn + chờ animation trên mọi trang vi/en
  const targets = listTargets();
  const { default: AxeBuilder } = (await import(axeModule)) as {
    default: new (a: {
      page: typeof page;
    }) => {
      analyze(): Promise<{
        violations: Array<{
          id: string;
          impact?: string | null;
          nodes: Array<{ target: unknown; any: Array<{ data?: Record<string, unknown> }> }>;
        }>;
      }>;
    };
  };
  const bad: string[] = [];
  for (const t of targets) {
    await page.goto(t.url);
    // Axe đo giữa chừng hoạt ảnh fade/reveal ra màu trộn với nền (node đổi giữa các lượt) và bỏ qua phần tử opacity 0:
    // cuộn kích hoạt mọi .reveal, chờ mọi animation kết thúc, kiểm không còn phần tử opacity != 1 rồi mới chạy axe.
    await page.evaluate(async () => {
      const frames = (n: number) =>
        new Promise<void>((r) => {
          const tick = (i: number) => (i <= 0 ? r() : requestAnimationFrame(() => tick(i - 1)));
          tick(n);
        });
      const step = Math.max(200, Math.floor(window.innerHeight * 0.5));
      // Cuộn từng đoạn từ đầu tới cuối; mỗi đoạn chờ vài khung hình cho IntersectionObserver chạy.
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await frames(4);
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      await frames(4);
      // Mỗi .reveal chưa có .in: cuộn tới nó rồi chờ theo khung hình (tối đa 120) tới khi observer gắn .in.
      for (const e of Array.from(document.querySelectorAll('.reveal'))) {
        if (e.classList.contains('in')) continue;
        e.scrollIntoView({ block: 'center' });
        for (let i = 0; i < 120 && !e.classList.contains('in'); i++) await frames(1);
      }
      window.scrollTo(0, 0);
      await frames(2);
    });
    // Chờ animation hữu hạn kết thúc (animation lặp vô hạn bị loại vì không bao giờ xong); lặp lại vì chuỗi có thể sinh animation mới.
    for (let round = 0; round < 3; round++)
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime as number))
            .map((a) => a.finished.catch(() => undefined)),
        ).then(() => undefined),
      );
    const notOpaque = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.reveal, .fade'))
        .filter((e) => getComputedStyle(e).opacity !== '1')
        .map(
          (e) =>
            `${e.tagName.toLowerCase()}.${Array.from(e.classList).join('.')} opacity=${getComputedStyle(e).opacity}`,
        ),
    );
    if (notOpaque.length > 0)
      bad.push(`${t.url} opacity != 1 sau khi chờ (x${notOpaque.length}): ${notOpaque.slice(0, 40).join(' | ')}`);
    const { violations } = await new AxeBuilder({ page }).analyze();
    for (const v of violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
      bad.push(
        `${t.url} ${v.id} (${v.impact}) x${v.nodes.length}\n` +
          v.nodes
            .slice(0, 40)
            .map((n) => {
              const d = n.any[0]?.data ?? {};
              return `    target=${JSON.stringify(n.target)} fgColor=${d.fgColor} bgColor=${d.bgColor} contrastRatio=${d.contrastRatio}`;
            })
            .join('\n'),
      );
    }
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('PERF-08 Chỉ dùng Tab/Shift+Tab/Enter đi hết trang Liên hệ, luôn có viền focus (@S4)', async ({ page }) => {
  await page.goto(path('contact', 'vi')); // bản build mẫu có email nhận + tên pháp lý ⇒ có form
  const want = [
    'nav-menu',
    'lang-switcher',
    'contact-name',
    'contact-email',
    'contact-phone',
    'contact-company',
    'contact-message',
    'contact-consent',
    'contact-submit',
  ];
  const seen = new Set<string>();
  const reached = () => want.filter((w) => [...seen].some((s) => s === w)).length;
  for (let i = 0; i < 120 && reached() < want.length; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e || e === document.body) return null;
      const s = getComputedStyle(e);
      const own = e.getAttribute('data-testid') ?? e.closest('[data-testid]')?.getAttribute('data-testid') ?? '';
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
      return { own, ring };
    });
    if (!info) continue;
    expect(info.ring, `focus không có viền ở ${info.own}`).toBe(true);
    seen.add(info.own);
  }
  for (const w of want) expect(seen.has(w), `Tab không tới ${w}`).toBe(true);
  // Shift+Tab đi ngược được và Enter bấm được nút gửi (form trống ⇒ hiện lỗi thay vì gửi)
  await page.keyboard.press('Shift+Tab');
  await tid(page, 'contact-submit').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/lien-he/);
});

test('PERF-09 Giảm chuyển động: không hiệu ứng, nội dung hiện đủ, sơ đồ tĩnh (@S5 @cho-khach:D6)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const l of ['vi', 'en'] as Locale[])
    for (const key of ['home', 'technology'] as const) {
      await page.goto(path(key, l));
      const before = (await bodyText(page)).length;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const longAnim = await page.evaluate(
        () =>
          document.getAnimations().filter((a) => {
            const t = a.effect?.getComputedTiming();
            return t && (Number(t.duration) > 10 || (a.playState === 'running' && Number(t.duration) > 10));
          }).length,
      );
      expect(longAnim, `${l}/${key} còn hoạt ảnh > 0,01s`).toBe(0);
      const slow = await page.evaluate(
        () =>
          [...document.querySelectorAll('*')].filter((e) => {
            const s = getComputedStyle(e);
            const d = (v: string) =>
              Math.max(...v.split(',').map((x) => parseFloat(x) * (x.trim().endsWith('ms') ? 0.001 : 1)));
            return d(s.transitionDuration) > 0.01 || d(s.animationDuration) > 0.01;
          }).length,
      );
      expect(slow, `${l}/${key} transition/animation > 0,01s`).toBe(0);
      const hidden = await page.evaluate(
        () => [...document.querySelectorAll('main *')].filter((e) => getComputedStyle(e).opacity === '0').length,
      );
      expect(hidden, 'khối ẩn chờ cuộn').toBe(0);
      expect((await bodyText(page)).length).toBe(before); // không có nội dung sinh thêm khi cuộn
    }
  await page.goto(path('technology', 'vi'));
  expect(await tid(page, 'tech-diagram').locator('[data-stage]').count()).toBeGreaterThan(0);
  await expect(tid(page, 'tech-diagram').locator('[data-stage]').first()).toBeVisible();
});

test('PERF-10 Tắt JavaScript vẫn thấy mọi khối nội dung (@S5)', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(path('home', 'vi'));
  const blocks = page.locator('main section, main [data-testid^="home-"]');
  const n = await blocks.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const b = blocks.nth(i);
    await expect(b).toBeVisible(); // visible = không display:none/visibility:hidden
    const op = await b.evaluate((e) => getComputedStyle(e).opacity).catch(() => '1');
    expect(op, `khối ${i} mờ chờ hiệu ứng`).not.toBe('0');
  }
  await ctx.close();
});
