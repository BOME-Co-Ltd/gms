// Biểu tượng, hover, thẻ quy trình U17, thẻ tuyển dụng U18 — nguồn kỳ vọng: ux-spec v0.5 §13b luật 6 và 8, §14a, §14c,
// V25, bảng kiểm J19–J23 (design_approved duyệt lại, gates seq 45, wireframes/footer.html). Truy vết ở test-plan.md mục 0j.
// Selector chỉ dùng thứ spec đặt tên hoặc cấu trúc: <footer data-testid="footer">, <address>, <nav>, <article>, <ol><li>, <figure>,
// <h3>, <svg>, aria-hidden. KHÔNG dùng tên class nội bộ (.ft-*, .stp-*, .fab-*): spec không cam kết. Phần tử đích tìm theo hành vi
// (liên kết zalo.me / tel: có tổ tiên position:fixed là nút nổi).
import { expect, type Locator, type Page, test } from '@playwright/test';
import { listTargets } from '../support/perf';
import { type Locale, type PageKey, path } from '../support/routes';
import { open } from '../support/ui';

const LOCALES: Locale[] = ['vi', 'en'];

// ───────────────────────── Nút nổi + hàng chân trang: tìm đích theo hành vi ─────────────────────────

type Key = 'fab-zalo' | 'fab-call' | 'footer-zalo' | 'footer-phone' | 'footer-nav' | 'header-link' | 'main-button';
const REQUIRED: Key[] = ['fab-zalo', 'fab-call', 'footer-zalo', 'footer-phone', 'footer-nav', 'header-link'];

/** Gắn thuộc tính data-qa-target lên các phần tử đích (chỉ trong trang đang chạy, không đổi sản phẩm). */
async function markTargets(page: Page): Promise<Key[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const fixed = (e: Element) => {
      for (let p: Element | null = e; p; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return true;
      return false;
    };
    const mark = (key: string, e: Element | null | undefined) => {
      if (!e) return;
      e.setAttribute('data-qa-target', key);
      out.push(key);
    };
    const all = Array.from(document.querySelectorAll('a[href]'));
    const inFooter = (e: Element) => !!e.closest('[data-testid="footer"]');
    mark(
      'fab-zalo',
      all.find((a) => /zalo\.me/.test(a.getAttribute('href') ?? '') && !inFooter(a) && fixed(a) && shown(a)),
    );
    mark(
      'fab-call',
      all.find((a) => (a.getAttribute('href') ?? '').startsWith('tel:') && !inFooter(a) && fixed(a) && shown(a)),
    );
    mark(
      'footer-zalo',
      all.find((a) => /zalo\.me/.test(a.getAttribute('href') ?? '') && inFooter(a)),
    );
    mark(
      'footer-phone',
      all.find((a) => (a.getAttribute('href') ?? '').startsWith('tel:') && inFooter(a)),
    );
    mark(
      'footer-nav',
      Array.from(document.querySelectorAll('[data-testid="footer"] nav a:not([aria-current])')).find(shown),
    );
    mark('header-link', Array.from(document.querySelectorAll('header nav a:not([aria-current])')).find(shown));
    mark(
      'main-button',
      Array.from(document.querySelectorAll('main a[class*="btn" i], main button[class*="btn" i]')).find(shown),
    );
    return out as never;
  });
}

const target = (page: Page, key: Key) => page.locator(`[data-qa-target="${key}"]`).first();

// ───────────────────────── FT-17: logo Zalo thật (J20, §13b luật 6) ─────────────────────────

for (const locale of LOCALES) {
  test(`FT-17 ${locale}: nút nổi Zalo và hàng Zalo chân trang dùng logo Zalo thật (SVG path, #0068FF), không <text>, không message-circle (J20)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await open(page, 'home', locale);
    await markTargets(page);
    const read = async (key: Key) =>
      target(page, key).evaluate((a) => {
        const svg = a.querySelector('svg');
        if (!svg) return null;
        let markup = svg.outerHTML;
        for (const u of Array.from(svg.querySelectorAll('use'))) {
          const id = (u.getAttribute('href') ?? u.getAttribute('xlink:href') ?? '').replace(/^#/, '');
          const sym = id ? document.getElementById(id) : null;
          if (sym) markup += sym.outerHTML;
        }
        const fills = [svg, ...Array.from(svg.querySelectorAll('*')), a].flatMap((e) => {
          const s = getComputedStyle(e);
          return [s.fill, s.backgroundColor];
        });
        const r = svg.getBoundingClientRect();
        const box = [svg.parentElement as Element, a].map((e) => {
          const b = e.getBoundingClientRect();
          return { w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 };
        });
        return {
          box,
          markup,
          fills,
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
          name: `${a.getAttribute('aria-label') ?? ''} ${a.textContent ?? ''}`,
        };
      });
    for (const key of ['fab-zalo', 'footer-zalo'] as const) {
      const m = await read(key);
      expect(m, `${key}: không có <svg> trong liên kết Zalo`).not.toBeNull();
      if (!m) continue;
      expect(m.markup, `${key}: có <path> (logo thật)`).toMatch(/<path\b/i);
      expect(m.markup, `${key}: không có <text> (hình giữ chỗ)`).not.toMatch(/<text\b/i);
      expect(m.markup, `${key}: không dùng biểu tượng message-circle`).not.toMatch(/message-circle/i);
      const blue = /#0068ff/i.test(m.markup) || m.fills.some((f) => f === 'rgb(0, 104, 255)');
      expect(blue, `${key}: màu thương hiệu #0068FF (fill/nền: ${m.fills.join(' | ')})`).toBe(true);
      expect(m.name, `${key}: tên truy cập có "Zalo"`).toMatch(/zalo/i);
    }
    const fab = await read('fab-zalo');
    const row = await read('footer-zalo');
    // V33 (admin 06/11, thay §13b luật 6): logo Zalo trong nút nổi 36px. V36: logo chân trang 22px trong ô 24px (admin trả lời XQ-QA-0q-1, 08/11).
    expect(
      fab && Math.abs(fab.w - 36) <= 1 && Math.abs(fab.h - 36) <= 1,
      `logo Zalo nút nổi 36px (đo: ${fab?.w}x${fab?.h})`,
    ).toBe(true);
    expect(
      row && Math.abs(row.w - 22) <= 1 && Math.abs(row.h - 22) <= 1,
      `logo Zalo chân trang 22px (V36; đo: ${row?.w}x${row?.h})`,
    ).toBe(true);
    expect(
      row?.box.some((b) => Math.abs(b.w - 24) <= 1 && Math.abs(b.h - 24) <= 1),
      `ô chứa logo Zalo chân trang 24px (V36; đo: ${JSON.stringify(row?.box)})`,
    ).toBe(true);
  });

  // Số đo spec nêu thẳng (nút nổi tròn V32; logo chân trang bo 6px). Viền trắng 2px quanh logo chân trang đã BỎ: chân trang nền
  // trắng (V26/V27), admin trả lời XQ-QA-0q-1 08/11. Bo có thể nằm trong path của logo thay vì CSS: nếu đỏ, xem ảnh trước khi kết luận.
  test(`FT-17b ${locale}: nút nổi Zalo tròn (V32); logo Zalo chân trang bo 6px [dự đoán]`, async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await open(page, 'home', locale);
    await markTargets(page);
    const radius = (key: Key) =>
      target(page, key).evaluate((a) => {
        const svg = a.querySelector('svg') as SVGElement;
        const chain = [a, svg, svg.parentElement as Element];
        const px = (e: Element) => Number.parseFloat(getComputedStyle(e).borderTopLeftRadius);
        return { radii: chain.map(px) };
      });
    const fab = await radius('fab-zalo');
    expect(
      fab.radii.some((r) => r >= 26), // V32 (admin 06/11): nút tròn 52/56px
      `nút nổi Zalo tròn (đo: ${fab.radii.join(',')})`,
    ).toBe(true);
    const row = await radius('footer-zalo');
    expect(
      row.radii.some((r) => Math.abs(r - 6) <= 0.5),
      `logo Zalo chân trang bo 6px (đo: ${row.radii.join(',')})`,
    ).toBe(true);
  });
}

// ───────────────────────── FT-18 / FT-19: hover chỉ phóng to (V25, J21, J21b) ─────────────────────────

const PROPS = [
  'backgroundColor',
  'color',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'textDecorationLine',
  'textDecorationThickness',
  'textDecorationColor',
  'boxShadow',
] as const;

/** Phóng to hiệu dụng (transform + thuộc tính scale) lớn nhất của phần tử và con cháu; cùng ảnh chụp thuộc tính màu. */
async function snap(loc: Locator) {
  return loc.evaluate(
    (el, props) => {
      const scaleOf = (e: Element) => {
        const s = getComputedStyle(e);
        let k = 1;
        const m = /^matrix(?:3d)?\(([^)]+)\)/.exec(s.transform);
        if (m) {
          const v = m[1].split(',').map(Number);
          k *= Math.hypot(v[0], v[1]);
        }
        if (s.scale && s.scale !== 'none') k *= Number(s.scale.split(' ')[0]);
        return k;
      };
      const nodes = [el, ...Array.from(el.querySelectorAll('*'))];
      return {
        scale: Math.max(...nodes.map(scaleOf)),
        hovered: el.matches(':hover'),
        style: nodes.map((e) =>
          props.map((p) => (getComputedStyle(e) as unknown as Record<string, string>)[p]).join('|'),
        ),
      };
    },
    PROPS as unknown as string[],
  );
}

async function hoverResults(page: Page, reduced: boolean) {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await open(page, 'home', 'vi');
  const found = await markTargets(page);
  const missing = REQUIRED.filter((k) => !found.includes(k));
  const bad: string[] = [];
  if (missing.length) bad.push(`không tìm thấy đích hover: ${missing.join(', ')}`);
  for (const key of found) {
    const loc = target(page, key);
    await loc.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const rest = await snap(loc);
    await loc.hover();
    await expect.poll(async () => (await snap(loc)).hovered, { message: `${key}: :hover áp dụng` }).toBe(true);
    if (!reduced)
      await expect
        .poll(async () => (await snap(loc)).scale, { message: `${key}: phóng to khi hover`, timeout: 4000 })
        .toBeGreaterThan(1.0399);
    // chờ thuộc tính ổn định rồi mới so (hai lần đọc liên tiếp bằng nhau)
    let prev = '';
    await expect
      .poll(
        async () => {
          const cur = JSON.stringify((await snap(loc)).style);
          const same = cur === prev;
          prev = cur;
          return same;
        },
        { timeout: 4000 },
      )
      .toBe(true);
    const hot = await snap(loc);
    if (reduced) {
      if (hot.scale > 1.001) bad.push(`${key}: reduced-motion mà vẫn phóng to ${hot.scale.toFixed(3)} (J21b)`);
    } else if (hot.scale < 1.0399 || hot.scale > 1.0801) {
      bad.push(`${key}: phóng to ${hot.scale.toFixed(3)} ngoài 1.04–1.08 (J21)`);
    }
    if (JSON.stringify(rest.style) !== JSON.stringify(hot.style)) {
      const i = rest.style.findIndex((s, n) => s !== hot.style[n]);
      bad.push(`${key}: hover đổi màu/viền/gạch/bóng (V25): ${rest.style[i]} → ${hot.style[i]}`);
    }
  }
  return bad;
}

test('FT-18 Hover chỉ phóng to 1.04–1.08: nền, chữ, viền, gạch chân, bóng không đổi — nút nổi, hàng chân trang, menu chân trang, menu đầu trang (V25, J21)', async ({
  page,
}) => {
  const bad = await hoverResults(page, false);
  expect(bad, bad.join('\n')).toEqual([]);
});

test('FT-19 prefers-reduced-motion: reduce — hover không phóng to và không đổi màu (V25, V23, J21b)', async ({
  page,
}) => {
  const bad = await hoverResults(page, true);
  expect(bad, bad.join('\n')).toEqual([]);
});

test('FT-20 Focus bàn phím của nút nổi gọi/Zalo có viền >= 3px, độc lập với hover (J22, §5.2)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page, 'home', 'vi');
  await markTargets(page);
  await page.mouse.move(0, 0);
  for (const key of ['fab-zalo', 'fab-call'] as const) {
    await target(page, key).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement;
      const s = getComputedStyle(e);
      return {
        key: e.getAttribute('data-qa-target'),
        style: s.outlineStyle,
        width: Number.parseFloat(s.outlineWidth),
        hovered: e.matches(':hover'),
      };
    });
    expect(ring.key, `${key}: focus trở lại đúng nút`).toBe(key);
    expect(ring.hovered, `${key}: không hover (độc lập)`).toBe(false);
    expect(ring.style, `${key}: kiểu viền`).not.toBe('none');
    expect(ring.width, `${key}: độ dày viền`).toBeGreaterThanOrEqual(3);
  }
});

// ───────────────────────── FT-21 / FT-24: biểu tượng cùng hàng với chữ (J19, §13b luật 8) ─────────────────────────

type IconRow = {
  at: string;
  w: number;
  dy: number;
  beside: boolean;
  flex: boolean;
  gap: string;
  textLeft: number;
  right: number;
};

/**
 * Đo mọi biểu tượng (<svg> <= 40px) đi kèm chữ nhìn thấy trong phạm vi luật 8: chân trang, <address>, liên kết/nút ngắn
 * (<= 96px cao), nhãn bước hành trình, thẻ tuyển dụng (`articleScope`). Bỏ: đầu trang, nút chỉ-biểu-tượng, accordion
 * (summary/aria-expanded — không thuộc danh sách §13b luật 8).
 */
async function iconRows(page: Page, articleScope: boolean): Promise<IconRow[]> {
  return page.evaluate((withArticles) => {
    const shown = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const textRects = (root: Element) => {
      const out: DOMRect[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const p = n.parentElement;
        if (!(n.textContent ?? '').trim() || !p || p.closest('svg') || !shown(p)) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        const r = rg.getBoundingClientRect();
        if (r.width > 1 && r.height > 1) out.push(r);
      }
      return out;
    };
    const scope = [
      'footer svg',
      'address svg',
      'a svg',
      'button svg',
      '[data-testid="journey-step"] svg',
      ...(withArticles ? ['article svg'] : []),
    ].join(',');
    const rows: IconRow[] = [];
    for (const svg of Array.from(document.querySelectorAll(scope))) {
      const r = svg.getBoundingClientRect();
      if (r.width < 1 || r.width > 40 || r.height > 40 || svg.closest('header')) continue;
      const ctl = svg.closest('a, button, summary');
      if (svg.closest('summary, [aria-expanded], details')) continue;
      let row: Element | null = null;
      if (ctl && !svg.closest('footer, address, article, [data-testid="journey-step"]')) {
        if (ctl.getBoundingClientRect().height > 96) continue; // thẻ lớn bọc cả khối, không phải nút/liên kết ngắn
        row = textRects(ctl).length ? ctl : null;
      } else {
        let p = svg.parentElement;
        for (let depth = 0; p && depth < 4 && p !== document.body; depth++, p = p.parentElement)
          if (textRects(p).length) {
            row = p;
            break;
          }
      }
      if (!row) continue; // biểu tượng chỉ-biểu-tượng
      const tr = textRects(row);
      const top = Math.min(...tr.map((x) => x.top));
      const bottom = Math.max(...tr.map((x) => x.bottom));
      const left = Math.min(...tr.map((x) => x.left));
      const right = Math.max(...tr.map((x) => x.right));
      let flex = false;
      let gap = '';
      for (let p: Element | null = svg.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/flex|grid/.test(s.display) && s.alignItems === 'center') {
          flex = true;
          gap = s.columnGap;
          break;
        }
        if (p === row) break;
      }
      rows.push({
        at: `${svg.outerHTML.slice(0, 40)} … «${(row.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)}»`,
        w: Math.round(r.width),
        dy: Math.round(r.top + r.height / 2 - (top + bottom) / 2),
        beside: r.right <= left + 1 || r.left >= right - 1,
        flex,
        gap,
        textLeft: Math.round(left),
        right: Math.round(r.right),
      });
    }
    return rows;
  }, articleScope);
}

const ICON_PAGES: PageKey[] = ['home', 'technology', 'careers', 'contact', 'news'];
for (const width of [320, 375, 1200]) {
  test(`FT-21 ${width}px: mọi biểu tượng cạnh chữ (chân trang, NAP, nút, nhãn bước, thẻ tuyển dụng) cùng hàng, tâm dọc ở giữa khối chữ, cha là flex center (J19, §13b luật 8)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const bad: string[] = [];
    let measured = 0;
    for (const locale of LOCALES)
      for (const key of ICON_PAGES) {
        await open(page, key, locale);
        const rows = await iconRows(page, key === 'careers');
        measured += rows.length;
        for (const r of rows) {
          const why = [
            !r.beside ? 'biểu tượng nằm trên/dưới chữ (không cạnh chữ)' : '',
            Math.abs(r.dy) > 4 ? `lệch tâm dọc ${r.dy}px so với khối chữ` : '',
            !r.flex ? 'cha không phải flex/grid align-items:center' : '',
          ].filter(Boolean);
          if (why.length) bad.push(`${path(key, locale)}: ${why.join('; ')} — ${r.at}`);
        }
      }
    expect(measured, 'số biểu tượng đã đo (đo được 0 nghĩa là bộ chọn không bắt được gì)').toBeGreaterThan(20);
    expect(bad, bad.join('\n')).toEqual([]);
  });
}

// ───────────────────────── FT-22: thẻ tuyển dụng U18 (§14c) ─────────────────────────

for (const locale of LOCALES)
  for (const width of [320, 375, 1200]) {
    test(`FT-22 ${locale} ${width}px: thẻ tuyển dụng — map-pin/circle-alert 20px cạnh trái chữ cùng hàng, gap 8px, tiêu đề h3 ${width === 1200 ? 24 : 20}px, nhãn .sr-only (U18, V09)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, 'careers', locale);
      const cards = await page.evaluate(() => {
        const shown = (e: Element) => {
          const r = e.getBoundingClientRect();
          return r.width > 1 && r.height > 1;
        };
        return Array.from(document.querySelectorAll('main article')).map((a) => {
          const h3 = a.querySelector('h3');
          const icons = Array.from(a.querySelectorAll('svg')).filter((s) => s.getBoundingClientRect().width <= 40);
          const labels = Array.from(a.querySelectorAll('*'))
            .filter((e) => e.children.length === 0 && /:\s*$/.test(e.textContent ?? '') && !shown(e))
            .map((e) => (e.textContent ?? '').trim());
          return {
            h3: h3 ? Number.parseFloat(getComputedStyle(h3).fontSize) : null,
            icons: icons.map((s) => {
              const r = s.getBoundingClientRect();
              return { w: Math.round(r.width), h: Math.round(r.height), hidden: s.getAttribute('aria-hidden') };
            }),
            labels,
          };
        });
      });
      expect(
        cards.length,
        `${locale}: số thẻ tuyển dụng (article) ở trang Tuyển dụng — cần ít nhất 1 tin còn hạn`,
      ).toBeGreaterThan(0);
      for (const [i, c] of cards.entries()) {
        expect(c.h3, `thẻ ${i}: có h3 cỡ ${width === 1200 ? 24 : 20}px (V09)`).toBe(width === 1200 ? 24 : 20);
        expect(c.icons.length, `thẻ ${i}: số biểu tượng (địa điểm + hạn nộp)`).toBeGreaterThanOrEqual(2);
        for (const ic of c.icons) {
          expect(`${ic.w}x${ic.h}`, `thẻ ${i}: cỡ biểu tượng`).toBe('20x20');
          expect(ic.hidden, `thẻ ${i}: biểu tượng trang trí aria-hidden`).toBe('true');
        }
        expect(
          c.labels.length,
          `thẻ ${i}: nhãn .sr-only địa điểm/hạn nộp (có: ${JSON.stringify(c.labels)})`,
        ).toBeGreaterThanOrEqual(2);
        if (locale === 'vi') {
          expect(c.labels, `thẻ ${i}: nhãn VI`).toEqual(expect.arrayContaining(['Địa điểm:', 'Hạn nộp:']));
        }
      }
      const rows = (await iconRows(page, true)).filter((r) => r.w === 20);
      expect(rows.length, 'số hàng biểu tượng 20px đo được ở thẻ').toBeGreaterThanOrEqual(2 * cards.length);
      for (const r of rows) {
        expect(r.beside, `biểu tượng cạnh chữ: ${r.at}`).toBe(true);
        expect(r.right <= r.textLeft + 1, `biểu tượng bên TRÁI chữ: ${r.at}`).toBe(true);
        expect(r.gap, `gap 8px: ${r.at}`).toBe('8px');
      }
    });
  }

// ───────────────────────── FT-23 / FT-24: thẻ bước quy trình U17 (§14c, J23) ─────────────────────────

/** Trang có `ol > li` mà li chứa figure và h3 (cấu trúc U17); tìm trong mọi trang công khai, theo từng locale. */
async function stepPages(page: Page, locale: Locale): Promise<string[]> {
  const found: string[] = [];
  for (const t of listTargets().filter((x) => x.locale === locale)) {
    const res = await page.goto(t.url);
    if (!res || res.status() !== 200) continue;
    const n = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('ol > li')).filter(
          (li) => li.querySelector('figure') && li.querySelector('h3'),
        ).length,
    );
    if (n >= 3) found.push(t.url);
  }
  return found;
}

for (const locale of LOCALES) {
  test(`FT-23 ${locale}: có thẻ bước quy trình (ol > li gồm figure + h3, từ 3 bước) ở ít nhất một trang (U17, Q-UX-19)`, async ({
    page,
  }) => {
    const pages = await stepPages(page, locale);
    expect(pages, `${locale}: trang có thẻ bước quy trình`).not.toEqual([]);
  });
}

for (const locale of LOCALES)
  for (const width of [320, 375, 768, 1200]) {
    test(`FT-24 ${locale} ${width}px: thẻ bước — ảnh 16:9 vùng riêng, huy hiệu số 40px cùng hàng tiêu đề, không chữ/số đè ảnh, gap 32px, số cột đúng (U17, J23)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const pages = await stepPages(page, locale);
      expect(pages, `${locale}: trang có thẻ bước`).not.toEqual([]);
      const bad: string[] = [];
      const wantCols = width < 600 ? 1 : width < 900 ? 2 : 3;
      for (const url of pages) {
        await page.goto(url);
        const r = await page.evaluate(() => {
          const shown = (e: Element) => {
            const b = e.getBoundingClientRect();
            return b.width > 1 && b.height > 1;
          };
          const box = (e: Element) => {
            const b = e.getBoundingClientRect();
            return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height };
          };
          const hit = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
            a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;
          const doc = document.documentElement;
          const lis = Array.from(document.querySelectorAll('ol > li')).filter(
            (li) => li.querySelector('figure') && li.querySelector('h3'),
          );
          const steps = lis.map((li, n) => {
            const err: string[] = [];
            const fig = li.querySelector('figure') as HTMLElement;
            const h3 = li.querySelector('h3') as HTMLElement;
            const p = li.querySelector(':scope > p, :scope > div > p') as HTMLElement | null;
            const leaves = Array.from(li.querySelectorAll('*')).filter(
              (e) => e.children.length === 0 && (e.textContent ?? '').trim() && shown(e) && !e.closest('svg'),
            );
            const num = leaves.find((e) => /^\d{1,2}$/.test((e.textContent ?? '').trim()));
            const fb = box(fig);
            if (fb.h < 1) return { n, err: ['figure không có kích thước'], box: fb, t: 0 };
            if (Math.abs(fb.w / fb.h - 16 / 9) > 0.03) err.push(`ảnh tỉ lệ ${(fb.w / fb.h).toFixed(3)} (cần 16:9)`);
            if (!num) err.push('không có huy hiệu số');
            else {
              const nb = box(num);
              const nm = getComputedStyle(num);
              const hb = box(h3);
              if (Math.abs(nb.w - 40) > 1 || Math.abs(nb.h - 40) > 1)
                err.push(`huy hiệu ${Math.round(nb.w)}x${Math.round(nb.h)} (cần 40x40)`);
              if (!(nm.borderTopLeftRadius === '50%' || Number.parseFloat(nm.borderTopLeftRadius) >= 20))
                err.push(`huy hiệu không tròn (${nm.borderTopLeftRadius})`);
              if (nm.position === 'absolute' || nm.position === 'fixed')
                err.push('huy hiệu dùng position absolute/fixed');
              if (num.getAttribute('aria-hidden') !== 'true') err.push('huy hiệu thiếu aria-hidden="true"');
              if (hit(nb, fb)) err.push('huy hiệu số đè lên vùng ảnh');
              const cy = (nb.t + nb.b) / 2;
              if (!(cy >= hb.t - 1 && cy <= hb.b + 1)) err.push('huy hiệu không cùng hàng với tiêu đề');
              const gap = hb.l - nb.r;
              if (gap < 11 || gap > 13) err.push(`khoảng huy hiệu–tiêu đề ${Math.round(gap)}px (cần 12)`);
              const below = nb.t - fb.b;
              if (below < 15 || below > 17) err.push(`vùng chữ cách ảnh ${Math.round(below)}px (cần 16)`);
              if (p && box(p).t < Math.max(nb.b, hb.b) - 1) err.push('mô tả không nằm dưới hàng huy hiệu + tiêu đề');
            }
            for (const e of [h3, ...(p ? [p] : [])])
              if (hit(box(e), fb)) err.push(`<${e.tagName.toLowerCase()}> đè lên vùng ảnh`);
            const inside = leaves.filter((e) => fig.contains(e));
            if (inside.length > 1)
              err.push(`${inside.length} chữ nằm trên ảnh (chỉ cho phép nhãn "Phối cảnh dự kiến")`);
            for (const e of inside) {
              const b = box(e);
              if (!((b.l + b.r) / 2 < (fb.l + fb.r) / 2 && (b.t + b.b) / 2 > (fb.t + fb.b) / 2))
                err.push(`chữ trên ảnh «${(e.textContent ?? '').trim()}» không ở góc dưới trái`);
            }
            const sr = Array.from(h3.querySelectorAll('*')).find(
              (e) => e.children.length === 0 && /^\s*\S+\s+\d+\s*:\s*$/.test(e.textContent ?? ''),
            );
            if (!sr || shown(sr)) err.push('tiêu đề thiếu chữ .sr-only "Bước {n}: " (hoặc nó đang hiện)');
            return { n, err, box: box(li), t: fb.t };
          });
          const xs = Array.from(new Set(steps.map((s) => Math.round(s.box.l / 4) * 4)));
          const second = steps[1]?.box;
          const first = steps[0]?.box;
          return {
            steps,
            cols: xs.length,
            overflow: doc.scrollWidth - doc.clientWidth,
            gapH: first && second && Math.abs(second.t - first.t) < 4 ? Math.round(second.l - first.r) : null,
            gapV: first && second && second.t > first.b - 4 ? Math.round(second.t - first.b) : null,
          };
        });
        for (const s of r.steps) for (const e of s.err) bad.push(`${url} bước ${s.n + 1}: ${e}`);
        if (r.steps.length < 3) bad.push(`${url}: chỉ có ${r.steps.length} bước`);
        if (r.cols !== Math.min(wantCols, r.steps.length)) bad.push(`${url}: ${r.cols} cột (cần ${wantCols})`);
        if (width < 600 && r.overflow > 0) bad.push(`${url}: cuộn ngang +${r.overflow}px`);
        const gap = wantCols === 1 ? r.gapV : r.gapH;
        if (gap === null || Math.abs(gap - 32) > 1) bad.push(`${url}: khoảng cách giữa hai bước ${gap}px (cần 32)`);
      }
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }

for (const locale of LOCALES) {
  test(`FT-25 ${locale}: ảnh của thẻ bước tải được (không 404, là ảnh, kích thước tự nhiên > 0), object-fit cover (U17)`, async ({
    page,
  }) => {
    const pages = await stepPages(page, locale);
    expect(pages, `${locale}: trang có thẻ bước`).not.toEqual([]);
    const bad: string[] = [];
    for (const url of pages) {
      await page.goto(url);
      const figs = page.locator('ol > li:has(figure):has(h3) figure');
      const count = await figs.count();
      for (let i = 0; i < count; i++) {
        const fig = figs.nth(i);
        await fig.scrollIntoViewIfNeeded();
        const img = fig.locator('img').first();
        if ((await img.count()) === 0) {
          bad.push(`${url} bước ${i + 1}: có vùng ảnh (figure) mà không có <img> (spec: không có ảnh thì ẩn vùng ảnh)`);
          continue;
        }
        await expect
          .poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0), {
            message: `${url} bước ${i + 1}: ảnh đã tải`,
            timeout: 8000,
          })
          .toBe(true)
          .catch(() => bad.push(`${url} bước ${i + 1}: ảnh không tải được (naturalWidth 0)`));
        const src = await img.evaluate((e: HTMLImageElement) => e.currentSrc || e.src);
        const res = await page.request.get(src);
        const type = res.headers()['content-type'] ?? '';
        if (res.status() !== 200 || !type.startsWith('image/'))
          bad.push(`${url} bước ${i + 1}: ${src} → ${res.status()} ${type}`);
        const fit = await img.evaluate((e) => getComputedStyle(e).objectFit);
        if (fit !== 'cover') bad.push(`${url} bước ${i + 1}: object-fit ${fit} (cần cover)`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
}
