// Quyết định thị giác V (ux-spec §12) đo bằng getComputedStyle. Nguồn kỳ vọng: ux-spec.md §12 (V02..V37), §13 (T1), §5.2, §5.5,
// KHÔNG chép giá trị từ code sản phẩm. Truy vết V -> ca: test-plan.md, mục "Truy vết V → ca" (cập nhật 08/11/2026, task qa-20261108072520-415a).
// Mã V -> mã ca: VR-V02 .. VR-V37, VR-V29-*. Chưa chạy lúc viết (QA không có quyền chạy); ca nào theo spec mà sản phẩm có thể lệch thì ghi
// "[dự đoán lệch]" ngay trên ca. Selector chỉ dùng data-testid mà spec/ca cũ đã đặt tên, thẻ ngữ nghĩa, hoặc hành vi; lớp CSS nội bộ KHÔNG dùng
// (ngoại lệ: tên lớp nút `btn` theo cách visual-v05 đã dùng để tìm nút chính).
import { expect, type Locator, type Page } from '@playwright/test';
import { buildSite, htmlOf } from '../support/build';
import { control } from '../support/control';
import { companyFile } from '../support/fixtures';
import { type Locale, PAGE_KEYS, type PageKey, path } from '../support/routes';
import { test } from '../support/turnstile-stub';
import { fillAndSubmit, open, tid, VALID } from '../support/ui';

const LOCALES: Locale[] = ['vi', 'en'];

// ───────────────────────── Giá trị kỳ vọng (ux-spec §12/§13), viết thành chuỗi màu tính toán ─────────────────────────
const rgbOf = (hex: string) => {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const C = {
  brand900: rgbOf('#0F5838'), // V02
  brand700: rgbOf('#27673C'), // V02, V19, T1e
  brand500: rgbOf('#40773F'), // V03
  blue600: rgbOf('#1D6FB6'), // V02, T1g, §5.2
  blue800: rgbOf('#244999'), // V02
  logoBlue: rgbOf('#1C70B8'), // V28, V36
  lime400: rgbOf('#9FB43B'), // V03
  logoLime: rgbOf('#A4B93A'), // V28
  weak1: rgbOf('#368F3D'), // V05
  weak2: rgbOf('#48973C'), // V05
  error: rgbOf('#B3261E'), // V06
  white: 'rgb(255, 255, 255)',
};

type TextRow = {
  tag: string;
  text: string;
  color: string;
  size: number;
  weight: number;
  lh: number;
  top: number;
  x: number;
};

/** Mọi phần tử đang thấy có chữ trực tiếp: màu, cỡ, độ đậm, giãn dòng (đơn vị px) — dùng cho V03/V05/V09/V10/V11. */
async function collectText(page: Page, scope = 'body'): Promise<TextRow[]> {
  return page.evaluate((sel) => {
    const rows: TextRow[] = [];
    const root = document.querySelector(sel);
    if (!root) return rows;
    for (const e of Array.from(root.querySelectorAll('*'))) {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(e.tagName) || e.closest('svg')) continue;
      const own = Array.from(e.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      const size = Number.parseFloat(cs.fontSize);
      const lhRaw = Number.parseFloat(cs.lineHeight);
      rows.push({
        tag: e.tagName.toLowerCase(),
        text: own.slice(0, 40),
        color: cs.color,
        size,
        weight: Number.parseInt(cs.fontWeight, 10) || (cs.fontWeight === 'bold' ? 700 : 400),
        lh: Number.isNaN(lhRaw) ? Number.NaN : lhRaw / size,
        top: r.top + window.scrollY,
        x: r.left,
      });
    }
    return rows;
  }, scope);
}

const fmt = (rows: TextRow[]) =>
  rows.map((r) => `<${r.tag}> "${r.text}" ${r.color} ${r.size}px/${r.weight}`).join('; ');

// ═════════════════════════ V02 Màu chủ đạo ═════════════════════════

test('VR-V02 nút chính nền #27673C chữ trắng; liên kết chữ #1D6FB6; nền đậm dùng #0F5838 và #244999 (V02, T1e, T1g)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  // (1) Nút chính của form liên hệ.
  await open(page, 'contact', 'vi');
  const submit = await tid(page, 'contact-submit').evaluate((e) => {
    const cs = getComputedStyle(e);
    return { bg: cs.backgroundColor, color: cs.color };
  });
  expect(submit.bg, 'V02/T1e: nút chính nền brand-700').toBe(C.brand700);
  expect(submit.color, 'T1e: chữ trắng').toBe(C.white);

  // (2) Liên kết chữ nằm trong đoạn văn (Chính sách bảo mật có liên kết trong thân bài): màu blue-600.
  await open(page, 'privacy', 'vi');
  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main p a[href], main li a[href]'))
      .filter((a) => !a.closest('[data-testid="footer"]') && a.getBoundingClientRect().width > 1)
      .map((a) => ({ text: (a.textContent ?? '').trim().slice(0, 30), color: getComputedStyle(a).color })),
  );
  expect(links.length, 'có ít nhất một liên kết trong thân bài để đo').toBeGreaterThan(0);
  for (const l of links) expect.soft(l.color, `liên kết "${l.text}" màu blue-600 (V02)`).toBe(C.blue600);

  // (3) Nền đậm trang chủ: gradient #0F5838 -> #244999 (V04) — vừa kiểm V02 hai màu nền đậm.
  await open(page, 'home', 'vi');
  const gradient = await page.evaluate(() =>
    Array.from(document.querySelectorAll('body *'))
      .map((e) => getComputedStyle(e).backgroundImage)
      .filter((b) => /gradient/.test(b)),
  );
  const has = (re: RegExp) => gradient.some((g) => re.test(g));
  expect(has(/rgb\(15, 88, 56\)/), 'có nền gradient chứa brand-900 #0F5838').toBe(true);
  expect(has(/rgb\(36, 73, 153\)/), 'có nền gradient chứa blue-800 #244999').toBe(true);
});

// ═════════════════════════ V03 + V05 Màu phụ / màu không dùng cho chữ ═════════════════════════

for (const locale of LOCALES) {
  test(`VR-V03 ${locale}: lime không bao giờ là màu chữ (V03, T1m) — mọi trang`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1200, height: 900 });
    for (const key of PAGE_KEYS) {
      await open(page, key as PageKey, locale);
      const bad = (await collectText(page)).filter((r) => r.color === C.lime400 || r.color === C.logoLime);
      expect.soft(bad, `${key}/${locale}: chữ màu lime (${fmt(bad)})`).toEqual([]);
    }
  });

  test(`VR-V05 ${locale}: #368F3D và #48973C chỉ cho chữ lớn >= 24px (V05, T1k, T1l) — mọi trang`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1200, height: 900 });
    for (const key of PAGE_KEYS) {
      await open(page, key as PageKey, locale);
      const bad = (await collectText(page)).filter((r) => (r.color === C.weak1 || r.color === C.weak2) && r.size < 24);
      expect.soft(bad, `${key}/${locale}: chữ nhỏ dùng màu không đủ tương phản (${fmt(bad)})`).toEqual([]);
    }
  });
}

// ═════════════════════════ V04 Nền (bổ sung vế còn thiếu) ═════════════════════════

test('VR-V04 nền trang trắng #FFFFFF; có nền nhấn nhẹ đúng --mist #F2F6F1 (V04 v0.5.2, §12a)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  for (const key of ['home', 'about', 'technology'] as PageKey[]) {
    await open(page, key, 'vi');
    const base = await page.evaluate(() => {
      const bg = (e: Element) => getComputedStyle(e).backgroundColor;
      const b = bg(document.body);
      return b === 'rgba(0, 0, 0, 0)' ? bg(document.documentElement) : b;
    });
    expect(base, `${key}: nền trang`).toBe(C.white);
  }
  // Nền nhấn: ux-spec v0.5.2 V04 chốt MỘT giá trị --mist #F2F6F1 (bỏ rgb(15 88 56 / 0.05)); so đúng, không dung sai.
  let found = 0;
  for (const key of ['home', 'about', 'technology', 'products'] as PageKey[]) {
    await open(page, key, 'vi');
    found += await page.evaluate(() => {
      return Array.from(document.querySelectorAll('main *, section')).filter(
        (e) => e.getBoundingClientRect().width > 100 && getComputedStyle(e).backgroundColor === 'rgb(242, 246, 241)',
      ).length;
    });
  }
  expect(found, 'có ít nhất một khối nền nhấn --mist rgb(242, 246, 241) trong các trang mẫu').toBeGreaterThan(0);
  // Gradient nền đậm khi chữ trắng: xem VR-V02 (3).
});

// ═════════════════════════ V06 Lỗi / V07 Thành công ═════════════════════════

test.describe('trạng thái form (V06, V07, V37, V35)', () => {
  const TO = 'lienhe@vi-du.test';
  test.beforeEach(async () => {
    await control.reset();
    await control.recipient(TO);
    await control.policyVersion('1.0');
  });
  test.afterEach(async () => {
    await control.failStore(false);
  });

  for (const locale of LOCALES) {
    test(`VR-V06 ${locale}: lỗi form = đỏ #B3261E + biểu tượng + chữ, không chỉ màu (V06, T1i)`, async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 900 });
      await open(page, 'contact', locale);
      // Bỏ trống cả email lẫn điện thoại (FORM-03): lỗi từng ô + tóm tắt.
      await fillAndSubmit(page, { name: VALID.name, message: VALID.message, consent: true });
      await expect(tid(page, 'contact-error').first()).toBeVisible();
      const errs = await tid(page, 'contact-error').evaluateAll((els) =>
        els
          .filter((e) => e.getBoundingClientRect().width > 1)
          .map((e) => {
            // V06 v0.5.2: mỗi contact-error MANG <svg> (nằm trong phần tử) cùng hàng với chữ.
            const svg = e.querySelector('svg');
            let sameRow = false;
            if (svg) {
              const tn = document
                .createTreeWalker(e, NodeFilter.SHOW_TEXT, {
                  acceptNode: (n) =>
                    (n.textContent ?? '').trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
                })
                .nextNode();
              if (tn) {
                const range = document.createRange();
                range.selectNodeContents(tn);
                const t = range.getClientRects()[0];
                const s = svg.getBoundingClientRect();
                sameRow = !!t && s.top < t.bottom && s.bottom > t.top;
              }
            }
            const withIcon = !!svg && sameRow;
            const textEls = [e, ...Array.from(e.querySelectorAll('*'))].filter((n) =>
              Array.from(n.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? '').trim()),
            );
            return {
              withIcon,
              text: (e.textContent ?? '').trim().slice(0, 40),
              colors: textEls.map((n) => getComputedStyle(n).color),
            };
          }),
      );
      expect(errs.length, 'có khối lỗi hiện').toBeGreaterThan(0);
      expect(
        errs.some((e) => e.colors.includes(C.error)),
        `chữ lỗi màu #B3261E (đo: ${JSON.stringify(errs.map((e) => e.colors))})`,
      ).toBe(true);
      for (const e of errs) {
        expect.soft(e.withIcon, `"${e.text}": có <svg> trong khối lỗi, cùng hàng với chữ (V06)`).toBe(true);
        expect.soft(e.text.length, 'có chữ').toBeGreaterThan(0);
      }
    });
  }

  test('VR-V07 thành công = #0F5838 + dấu tick + chữ (V07)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await open(page, 'contact', 'vi');
    await fillAndSubmit(page, { ...VALID });
    const ok = tid(page, 'contact-success');
    await expect(ok).toBeVisible();
    const m = await ok.evaluate((e) => {
      // V07 v0.5.2: <svg> lucide circle-check nằm TRONG khối contact-success; chữ và biểu tượng đều #0F5838.
      const svg = e.querySelector('svg');
      const textEls = [e, ...Array.from(e.querySelectorAll('*'))].filter(
        (n) =>
          !n.closest('svg') && Array.from(n.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? '').trim()),
      );
      return {
        text: (e.textContent ?? '').trim().slice(0, 60),
        textColors: textEls.map((n) => getComputedStyle(n).color),
        iconColor: svg ? getComputedStyle(svg).color : '',
        iconStroke: svg ? getComputedStyle(svg).stroke : '',
        hasIcon: !!svg,
        // dấu tick lucide (check / circle-check): đường vẽ ngắn; kiểm gần đúng qua tên hoặc path
        markup: svg ? svg.outerHTML.slice(0, 400) : '',
      };
    });
    expect(m.hasIcon, 'có biểu tượng trong khối thành công').toBe(true);
    expect(m.text.length).toBeGreaterThan(0);
    expect(m.textColors.length, 'có chữ trong khối thành công').toBeGreaterThan(0);
    for (const c of m.textColors) expect.soft(c, `chữ thành công #0F5838 (không phải #067647)`).toBe(C.brand900);
    expect(
      m.iconColor === C.brand900 || m.iconStroke === C.brand900,
      `biểu tượng #0F5838 (đo: ${m.iconColor} | ${m.iconStroke})`,
    ).toBe(true);
    expect(m.markup, 'biểu tượng là lucide circle-check').toMatch(/circle-check|m9 12 2 2 4-4/i);
  });

  // ═══ V35 + V36(2): focus ô nhập. V36 thay màu V35 (g900+lá) bằng viền #1C70B8 + quầng xanh S 22 %; kiểm theo V36 vì là bản hiện hành. ═══
  test('VR-V35 focus ô nhập: viền #1C70B8 + quầng mềm 22 %, outline trong suốt; ô lỗi giữ viền đỏ; hiện dần .15s (V35, V36(2))', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await open(page, 'contact', 'vi');
    const read = async (id: string) => {
      await tid(page, id).focus();
      await page.waitForTimeout(350);
      return tid(page, id).evaluate((e) => {
        const cs = getComputedStyle(e);
        return {
          border: cs.borderTopColor,
          shadow: cs.boxShadow,
          outlineStyle: cs.outlineStyle,
          outlineWidth: cs.outlineWidth,
          outlineColor: cs.outlineColor,
          props: cs.transitionProperty.split(',').map((s) => s.trim()),
          durs: cs.transitionDuration.split(',').map((s) => s.trim()),
        };
      });
    };
    // V36(2) v0.5.2: viền + vòng 1px + quầng 4px cùng cấu trúc cho ô thường (#1C70B8, .22) và ô lỗi (#B3261E, .22);
    // outline: 2px solid transparent; transition: border-color .15s, box-shadow .15s.
    const checkFocus = (
      id: string,
      f: Awaited<ReturnType<typeof read>>,
      ring: string,
      halo: string,
      border: string,
      what: string,
    ) => {
      expect.soft(f.border, `${id}: viền ${what}`).toBe(border);
      expect.soft(f.shadow, `${id}: vòng 1px ${what}`).toContain(`${ring} 0px 0px 0px 1px`);
      expect.soft(f.shadow, `${id}: quầng 4px ${what}`).toContain(`${halo} 0px 0px 0px 4px`);
      expect.soft(f.outlineStyle, `${id}: outline solid (không gỡ, forced-colors vẫn thấy)`).toBe('solid');
      expect.soft(f.outlineWidth, `${id}: outline 2px`).toBe('2px');
      expect.soft(f.outlineColor, `${id}: outline trong suốt`).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      const t = Object.fromEntries(f.props.map((p, i) => [p, f.durs[i % f.durs.length]]));
      expect.soft(t['border-color'], `${id}: border-color chuyển 0.15s (đo ${JSON.stringify(t)})`).toBe('0.15s');
      expect.soft(t['box-shadow'], `${id}: box-shadow chuyển 0.15s (đo ${JSON.stringify(t)})`).toBe('0.15s');
    };
    for (const id of ['contact-name', 'contact-email', 'contact-phone', 'contact-message']) {
      const f = await read(id);
      checkFocus(id, f, 'rgb(28, 112, 184)', 'rgba(28, 112, 184, 0.22)', C.logoBlue, '#1C70B8 (V36)');
    }
    // Ô checkbox giữ focus cũ (§5.2): viền 3px #1D6FB6
    await tid(page, 'contact-consent').focus();
    const box = await tid(page, 'contact-consent').evaluate((e) => {
      const cs = getComputedStyle(e);
      return { w: cs.outlineWidth, c: cs.outlineColor, s: cs.outlineStyle };
    });
    expect.soft(box.s).not.toBe('none');
    expect.soft(box.w, 'checkbox: focus 3px (§5.2)').toBe('3px');
    expect.soft(box.c, 'checkbox: focus #1D6FB6 (§5.2)').toBe(C.blue600);

    // Ô đang lỗi khi focus: viền đỏ #B3261E + quầng đỏ nhạt
    await fillAndSubmit(page, { name: VALID.name, message: VALID.message, consent: true });
    await expect(tid(page, 'contact-error').first()).toBeVisible();
    const bad = await read('contact-email');
    checkFocus(
      'contact-email (lỗi)',
      bad,
      'rgb(179, 38, 30)',
      'rgba(179, 38, 30, 0.22)',
      C.error,
      '#B3261E (ô lỗi, V36(2))',
    );
  });

  test('VR-V35b hộp tóm tắt lỗi: MỘT viền 2px #1C70B8, tiêu đề đỏ + biểu tượng (V36(1))', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await open(page, 'contact', 'vi');
    await fillAndSubmit(page, { name: VALID.name, message: VALID.message, consent: true });
    const alert = page
      .locator('[role="alert"]')
      .filter({ has: page.locator('a[href^="#"]') })
      .first();
    await expect(alert).toBeVisible();
    const b = await alert.evaluate((e) => {
      const cs = getComputedStyle(e);
      return { w: cs.borderTopWidth, c: cs.borderTopColor, s: cs.borderTopStyle };
    });
    expect(b.s).toBe('solid');
    expect(b.w, 'viền 2px').toBe('2px');
    expect(b.c, 'viền #1C70B8').toBe(C.logoBlue);
  });

  // ═══ V37 Messenger cạnh Zalo ở trang Liên hệ ═══
  for (const locale of LOCALES) {
    test(`VR-V37 ${locale}: mọi chỗ có Zalo ở trang Liên hệ có Messenger ngay sau, m.me/gmshungyen, logo gradient (V37)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1200, height: 900 });
      await open(page, 'contact', locale);
      const r = await page.evaluate(() => {
        const main = document.querySelector('main');
        const links = Array.from(main?.querySelectorAll('a[href]') ?? []);
        const fixed = (e: Element) => {
          for (let p: Element | null = e; p; p = p.parentElement)
            if (getComputedStyle(p).position === 'fixed') return true;
          return false;
        };
        const zalo = links.filter((a) => /zalo\.me/.test(a.getAttribute('href') ?? '') && !fixed(a));
        const rows = zalo.map((z) => {
          const next = links[links.indexOf(z) + 1];
          return {
            zalo: z.getAttribute('href'),
            next: next?.getAttribute('href') ?? null,
            markup: next?.querySelector('svg')?.outerHTML ?? '',
          };
        });
        return {
          n: zalo.length,
          rows,
          messengerCount: links.filter((a) => /m\.me\/gmshungyen/.test(a.getAttribute('href') ?? '')).length,
        };
      });
      expect(r.n, 'trang Liên hệ có ít nhất một mục Zalo trong nội dung chính').toBeGreaterThan(0);
      for (const row of r.rows) {
        expect.soft(row.next, `mục Messenger ngay sau mục Zalo ${row.zalo}`).toBe('https://m.me/gmshungyen');
        expect.soft(row.markup, 'logo Messenger tô gradient chính hãng (#0099FF → #A033FF)').toMatch(/0099ff/i);
        expect.soft(row.markup).toMatch(/a033ff/i);
      }
      expect(r.messengerCount, 'số mục Messenger >= số mục Zalo').toBeGreaterThanOrEqual(r.n);
    });
  }

  test('VR-V37b Messenger không phụ thuộc số điện thoại: bỏ phone vẫn có Messenger (V37 "không gắn need-phone") (@kiem-luc-build)', () => {
    const r = buildSite(companyFile({ phone: null }));
    expect(r.ok, r.log).toBe(true);
    for (const locale of LOCALES) {
      const html = htmlOf(r, path('contact', locale))!;
      expect(html, `${locale}: không có tel:`).not.toMatch(/href="tel:/);
      expect(html, `${locale}: vẫn có Messenger`).toContain('m.me/gmshungyen');
    }
  });

  test('VR-V37c Messenger có trong danh sách kênh dự phòng khi lưu thất bại (F3c) (V37)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await control.failStore(true);
    await open(page, 'contact', 'vi');
    await fillAndSubmit(page, { ...VALID });
    const err = tid(page, 'contact-error').first();
    await expect(err).toBeVisible();
    const hrefs = await err.evaluate((e) =>
      Array.from(e.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') ?? ''),
    );
    // Zalo "khi đã công bố" (ux-spec §10): chỉ đòi Messenger ngay sau Zalo nếu Zalo có mặt.
    expect(
      hrefs.some((h) => /m\.me\/gmshungyen/.test(h)),
      `kênh dự phòng ở F3c phải có Messenger (đo: ${hrefs.join(', ')})`,
    ).toBe(true);
  });
});

// ═════════════════════════ V08 Họ font ═════════════════════════

test('VR-V08 họ font Be Vietnam Pro + dự phòng; tải được, phủ tiếng Việt, không tải font từ máy chủ ngoài (V08, V26)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const fontHosts: string[] = [];
  page.on('request', (rq) => {
    if (rq.resourceType() === 'font') fontHosts.push(new URL(rq.url()).origin);
  });
  await open(page, 'home', 'vi');
  await page.evaluate(() => document.fonts.ready);
  const stack = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  const names = stack.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
  expect(names[0], `họ đầu của body (${stack})`).toBe('Be Vietnam Pro');
  for (const fb of ['Segoe UI', 'system-ui', 'sans-serif']) expect(names, `dự phòng ${fb} (${stack})`).toContain(fb);

  const faces = await page.evaluate(() =>
    Array.from(document.fonts)
      .filter((f) => /Be Vietnam Pro/i.test(f.family))
      .map((f) => ({ status: f.status, range: f.unicodeRange, weight: f.weight })),
  );
  expect(faces.length, 'có @font-face Be Vietnam Pro').toBeGreaterThan(0);
  expect(
    faces.some((f) => f.status === 'loaded'),
    `ít nhất một mặt đã tải (${JSON.stringify(faces)})`,
  ).toBe(true);
  const covers = (range: string, cp: number) =>
    range
      .split(',')
      .map((s) => s.trim().replace(/^U\+/i, ''))
      .some((r) => {
        const [a, b] = r.split('-');
        const lo = Number.parseInt(a.replace('?', '0'), 16);
        const hi = b ? Number.parseInt(b, 16) : a.includes('?') ? Number.parseInt(a.replace('?', 'F'), 16) : lo;
        return cp >= lo && cp <= hi;
      });
  expect(
    faces.some((f) => covers(f.range, 0x41)),
    'có mặt phủ latin (A)',
  ).toBe(true);
  expect(
    faces.some((f) => covers(f.range, 0x1ea1)),
    'có mặt phủ tiếng Việt (ạ U+1EA1)',
  ).toBe(true);
  const self = new URL(page.url()).origin;
  expect(fontHosts.length, 'font được tải qua mạng (tự host)').toBeGreaterThan(0);
  expect(
    fontHosts.filter((h) => h !== self),
    'font tự host, không tải từ máy chủ ngoài',
  ).toEqual([]);
});

// ═════════════════════════ V09 Cỡ chữ (bổ sung H1/H2/H3, thân, chú thích) ═════════════════════════

const SIZE_PAGES: PageKey[] = ['home', 'about', 'technology', 'contact', 'privacy'];
for (const [w, h1, h2, h3] of [
  [375, 32, 24, 20],
  [1200, 48, 32, 24],
] as const) {
  test(`VR-V09 ${w}px: H1 ${h1} / H2 ${h2} / H3 ${h3}; thân 16–18; chú thích >= 14 (V09) [dự đoán lệch: H1 trang chủ có thể dùng clamp]`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: 800 });
    for (const key of SIZE_PAGES) {
      await open(page, key, 'vi');
      const m = await page.evaluate(() => {
        const size = (e: Element) => Number.parseFloat(getComputedStyle(e).fontSize);
        const inMain = (sel: string) =>
          Array.from(document.querySelectorAll(sel)).filter(
            (e) => !e.closest('[data-testid="footer"], header, nav') && e.getBoundingClientRect().width > 1,
          );
        return {
          h1: inMain('main h1').map(size),
          h2: inMain('main h2').map(size),
          h3: inMain('main h3').map(size),
          body: inMain('main p')
            .filter((p) => (p.textContent ?? '').trim().length > 60)
            .map(size),
          caption: inMain('main figcaption, main small').map(size),
        };
      });
      expect.soft(m.h1.length, `${key}: có H1`).toBeGreaterThan(0);
      for (const s of m.h1) expect.soft(s, `${key}@${w}: H1`).toBeCloseTo(h1, 0);
      for (const s of m.h2) expect.soft(s, `${key}@${w}: H2`).toBeCloseTo(h2, 0);
      for (const s of m.h3) expect.soft(s, `${key}@${w}: H3`).toBeCloseTo(h3, 0);
      for (const s of m.body) {
        expect.soft(s, `${key}@${w}: chữ thân >= 16`).toBeGreaterThanOrEqual(16);
        expect.soft(s, `${key}@${w}: chữ thân <= 18`).toBeLessThanOrEqual(18);
      }
      for (const s of m.caption) expect.soft(s, `${key}@${w}: chú thích >= 14`).toBeGreaterThanOrEqual(14);
    }
  });
}

// ═════════════════════════ V10 Độ đậm ═════════════════════════

test('VR-V10 chỉ hai độ đậm 400 và 700 trên mọi trang (V10)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1200, height: 900 });
  for (const locale of LOCALES)
    for (const key of PAGE_KEYS) {
      await open(page, key as PageKey, locale);
      const bad = (await collectText(page)).filter((r) => r.weight !== 400 && r.weight !== 700);
      expect.soft(bad, `${key}/${locale}: độ đậm ngoài {400,700} (${fmt(bad)})`).toEqual([]);
    }
});

// ═════════════════════════ V11 Giãn dòng + dài dòng ═════════════════════════

test('VR-V11 thân 17px/1.65 (mọi trang kể cả Chính sách), H1–H3 1.25 không ngoại lệ; dòng dài nhất <= 70 ký tự thật ở 375/768/1200 (V11 v0.5.3, §12b)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1200, height: 900 });
  for (const key of ['about', 'contact', 'technology', 'privacy', 'home'] as PageKey[]) {
    await open(page, key, 'vi');
    const m = await page.evaluate(() => {
      const ratio = (e: Element) => {
        const cs = getComputedStyle(e);
        return Number.parseFloat(cs.lineHeight) / Number.parseFloat(cs.fontSize);
      };
      const vis = (sel: string) =>
        Array.from(document.querySelectorAll(sel)).filter(
          (e) => !e.closest('[data-testid="footer"], header, nav') && e.getBoundingClientRect().width > 1,
        );
      return {
        body: vis('main p')
          .filter((p) => (p.textContent ?? '').trim().length > 60)
          .map(ratio),
        bodySize: vis('main p')
          .filter((p) => (p.textContent ?? '').trim().length > 60)
          .map((p) => Number.parseFloat(getComputedStyle(p).fontSize)),
        heads: vis('main h1, main h2, main h3').map((e) => ({ tag: e.tagName, r: ratio(e) })),
      };
    });
    for (const r of m.body) expect.soft(r, `${key}: line-height thân 1.65`).toBeCloseTo(1.65, 2);
    for (const s of m.bodySize) expect.soft(s, `${key}: cỡ chữ thân 17px`).toBe(17);
    for (const h of m.heads) expect.soft(h.r, `${key}: line-height ${h.tag}`).toBeCloseTo(1.25, 1);
  }

  // Dài dòng (v0.5.3): đếm ký tự THẬT mỗi dòng hiển thị (tính dấu cách), không đo max-width theo ch. Dòng dài nhất <= 70.
  for (const width of [375, 768, 1200]) {
    await page.setViewportSize({ width, height: 900 });
    for (const key of ['privacy', 'about', 'contact', 'technology', 'home'] as PageKey[]) {
      await open(page, key, 'vi');
      const worst = await page.evaluate(() => {
        const ps = Array.from(document.querySelectorAll('main p, main li')).filter(
          (p) =>
            !p.querySelector('p,li') &&
            !p.closest('[data-testid="footer"], header, nav') &&
            p.getBoundingClientRect().width > 1,
        );
        let best = { n: 0, text: '' };
        for (const p of ps) {
          const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
          const lines = new Map<number, number>();
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const t = n.textContent ?? '';
            const re = /\S+\s*/g;
            for (let m = re.exec(t); m; m = re.exec(t)) {
              const range = document.createRange();
              range.setStart(n, m.index);
              range.setEnd(n, m.index + m[0].replace(/\s+$/, '').length);
              const rects = range.getClientRects();
              if (!rects.length) continue;
              const top = Math.round(rects[0].top);
              lines.set(top, (lines.get(top) ?? 0) + m[0].length);
            }
          }
          for (const v of lines.values())
            if (v > best.n) best = { n: v, text: (p.textContent ?? '').trim().slice(0, 30) };
        }
        return best;
      });
      expect
        .soft(worst.n, `${key} @${width}px: dòng dài nhất (ký tự, kể cả dấu cách) trong "${worst.text}"`)
        .toBeLessThanOrEqual(70);
    }
  }
});

// ═════════════════════════ V13 + V19 Bo góc, nút ═════════════════════════

test('VR-V13 bo góc: nút/chip dạng pill, thẻ 16px (V13, V19)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  for (const key of ['home', 'news', 'careers', 'contact'] as PageKey[]) {
    await open(page, key, 'vi');
    const m = await page.evaluate(() => {
      const px = (v: string) => (v.endsWith('%') ? Number.POSITIVE_INFINITY : Number.parseFloat(v));
      const vis = (e: Element) => e.getBoundingClientRect().width > 1;
      const btns = Array.from(document.querySelectorAll('main a[class*="btn" i], main button[class*="btn" i]'))
        .filter(vis)
        .map((e) => ({
          text: (e.textContent ?? '').trim().slice(0, 24),
          h: e.getBoundingClientRect().height,
          r: px(getComputedStyle(e).borderTopLeftRadius),
        }));
      const cards = Array.from(document.querySelectorAll('main article'))
        .filter(vis)
        .map((e) => px(getComputedStyle(e).borderTopLeftRadius));
      const figs = Array.from(document.querySelectorAll('main figure'))
        .filter(vis)
        .map((e) => px(getComputedStyle(e).borderTopLeftRadius));
      return { btns, cards, figs };
    });
    for (const b of m.btns)
      expect
        .soft(b.r, `${key}: nút "${b.text}" dạng pill (r >= h/2 = ${b.h / 2})`)
        .toBeGreaterThanOrEqual(b.h / 2 - 0.5);
    for (const r of m.cards) expect.soft(r, `${key}: thẻ bo 16px`).toBe(16);
    // v0.5.2: §12a sửa 18px -> 16px theo V13; khung ảnh chỉ nhận 16.
    for (const r of m.figs) expect.soft(r, `${key}: khung ảnh bo 16px`).toBe(16);
  }
});

test('VR-V19 nút: cao >= 48px, pill; nút chính nền #27673C chữ trắng; nút trên nền tối nền trắng chữ #0F5838 (V19)', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  for (const key of ['home', 'technology', 'contact', 'about'] as PageKey[]) {
    await open(page, key, 'vi');
    const rows = await page.evaluate(() => {
      const hasGradientAncestor = (e: Element) => {
        for (let p = e.parentElement; p; p = p.parentElement)
          if (/gradient/.test(getComputedStyle(p).backgroundImage)) return true;
        return false;
      };
      return Array.from(document.querySelectorAll('main a[class*="btn" i], main button[class*="btn" i]'))
        .filter((e) => e.getBoundingClientRect().width > 1)
        .map((e) => {
          const cs = getComputedStyle(e);
          return {
            text: (e.textContent ?? '').trim().slice(0, 24),
            h: e.getBoundingClientRect().height,
            bg: cs.backgroundColor,
            color: cs.color,
            border: cs.borderTopWidth,
            dark: hasGradientAncestor(e),
          };
        });
    });
    for (const b of rows) {
      expect.soft(b.h, `${key}: nút "${b.text}" cao >= 48`).toBeGreaterThanOrEqual(47.5);
      if (b.dark) {
        // nút trên nền tối: nền trắng chữ #0F5838 (V19) — chấp nhận nút trong suốt viền trắng là nút phụ; chỉ kiểm nút nền đặc.
        if (b.bg === C.white) expect.soft(b.color, `${key}: nút trên nền tối "${b.text}" chữ #0F5838`).toBe(C.brand900);
      }
    }
    if (!rows.some((b) => b.dark))
      testInfo.annotations.push({ type: 'note', description: `${key}: không có nút trên nền tối để đo` });
  }
  await open(page, 'contact', 'vi');
  const s = await tid(page, 'contact-submit').evaluate((e) => {
    const cs = getComputedStyle(e);
    return { bg: cs.backgroundColor, color: cs.color, h: e.getBoundingClientRect().height };
  });
  expect(s.bg).toBe(C.brand700);
  expect(s.color).toBe(C.white);
  expect(s.h).toBeGreaterThanOrEqual(47.5);
});

// ═════════════════════════ V15 Khoảng cách, V16 Lưới ═════════════════════════

test('VR-V15 lề trang 16px (375) / 24px (768); khoảng cách `gap` thuộc thang 4·8·12·16·24·32·48·64 (V15) [dự đoán lệch]', async ({
  page,
}) => {
  for (const [w, margin] of [
    [375, 16],
    [768, 24],
  ] as const) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const key of ['about', 'contact', 'technology'] as PageKey[]) {
      await open(page, key, 'vi');
      const left = await page.evaluate(() => {
        const h = document.querySelector('main h1');
        return h ? h.getBoundingClientRect().left : Number.NaN;
      });
      expect.soft(left, `${key}@${w}: lề trái của H1`).toBeCloseTo(margin, 0);
    }
  }
  await page.setViewportSize({ width: 1200, height: 900 });
  const SCALE = new Set([0, 4, 8, 12, 16, 24, 32, 48, 64]);
  for (const key of ['home', 'about', 'technology', 'contact', 'news'] as PageKey[]) {
    await open(page, key, 'vi');
    const gaps = await page.evaluate(() => {
      const out: string[] = [];
      for (const e of Array.from(document.querySelectorAll('body *'))) {
        if (e.getBoundingClientRect().width < 1) continue;
        const cs = getComputedStyle(e);
        for (const v of [cs.rowGap, cs.columnGap])
          if (v !== 'normal' && v !== '0px') out.push(`${e.tagName.toLowerCase()}:${v}`);
      }
      return out;
    });
    const bad = gaps.filter((g) => !SCALE.has(Number.parseFloat(g.split(':')[1])));
    expect.soft(bad, `${key}: gap ngoài thang 4 (${bad.join(', ')})`).toEqual([]);
  }
});

test('VR-V16 khung nội dung <= 1200px, căn giữa; thẻ tin 1 cột (375) / 2 (768) / 3 (1200) (V16) [dự đoán lệch ở 768]', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  for (const key of ['about', 'technology', 'contact', 'home'] as PageKey[]) {
    await open(page, key, 'vi');
    const u = await page.evaluate(() => {
      const els = Array.from(
        document.querySelectorAll('main h2, main p, main li, main figure, main article, main h1'),
      ).filter((e) => e.getBoundingClientRect().width > 1 && !e.closest('[aria-hidden="true"]'));
      const left = Math.min(...els.map((e) => e.getBoundingClientRect().left));
      const right = Math.max(...els.map((e) => e.getBoundingClientRect().right));
      return { left, right, w: right - left, vw: document.documentElement.clientWidth };
    });
    expect.soft(u.w, `${key}: bề rộng nội dung <= 1200 (đo ${u.w})`).toBeLessThanOrEqual(1200.5);
    expect.soft(u.w, `${key}: khung dùng gần đủ 1200 (đo ${u.w})`).toBeGreaterThanOrEqual(1100);
    expect.soft(Math.abs(u.left - (u.vw - u.right)), `${key}: căn giữa`).toBeLessThanOrEqual(2);
  }
  const cols = async (w: number) => {
    await page.setViewportSize({ width: w, height: 900 });
    await open(page, 'home', 'vi');
    return tid(page, 'home-news').evaluate((s) => {
      const cards = Array.from(s.querySelectorAll('article')).filter((c) => c.getBoundingClientRect().width > 1);
      return { n: cards.length, lefts: new Set(cards.map((c) => Math.round(c.getBoundingClientRect().left))).size };
    });
  };
  const c375 = await cols(375);
  const c768 = await cols(768);
  const c1200 = await cols(1200);
  expect(c1200.n, 'trang chủ có >= 3 thẻ tin để đo cột').toBeGreaterThanOrEqual(3);
  expect(c375.lefts, '375px: 1 cột').toBe(1);
  expect(c768.lefts, '768px: 2 cột').toBe(2);
  expect(c1200.lefts, '1200px: 3 cột').toBe(3);
});

// ═════════════════════════ V20/V21/V22 Chuyển động (chế độ thường) ═════════════════════════

test('VR-V20 chuyển tiếp <= 300ms và chỉ opacity/transform (V20) — trừ ô nhập (V35), viên ngôn ngữ (V34), vệt bóng (V28)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1200, height: 900 });
  for (const key of ['about', 'contact', 'privacy', 'news', 'careers'] as PageKey[]) {
    await open(page, key, 'vi');
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      const secs = (s: string) =>
        s.split(',').map((x) => (x.trim().endsWith('ms') ? Number.parseFloat(x) / 1000 : Number.parseFloat(x)));
      for (const e of Array.from(document.querySelectorAll('body *'))) {
        if (e.closest('input, textarea, [data-testid="lang-switcher"]') || e.matches('input, textarea')) continue;
        const cs = getComputedStyle(e);
        const props = cs.transitionProperty.split(',').map((s) => s.trim());
        const durs = secs(cs.transitionDuration);
        props.forEach((p, i) => {
          const d = durs[i % durs.length];
          if (!(d > 0)) return;
          if (d > 0.3 + 1e-6) out.push(`${e.tagName.toLowerCase()} ${p} ${d}s > 0.3s`);
          if (!['opacity', 'transform'].includes(p))
            out.push(`${e.tagName.toLowerCase()} chuyển "${p}" ${d}s (chỉ opacity/transform)`);
        });
      }
      return Array.from(new Set(out));
    });
    expect.soft(bad, `${key}: chuyển tiếp trái V20`).toEqual([]);
  }
});

test('VR-V21 hiện khi cuộn: có JS + không reduced-motion ⇒ khối dưới màn hình mờ + dịch ~12px, cuộn tới thì hiện đủ (V21)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 700 });
  let found: { page: string; idx: number } | null = null;
  for (const key of ['about', 'technology', 'home'] as PageKey[]) {
    await open(page, key, 'vi');
    await page.waitForTimeout(500);
    const hit = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('main section, main section > *, main article, main li'));
      for (let i = 0; i < els.length; i++) {
        const r = els[i].getBoundingClientRect();
        if (r.top < window.innerHeight + 100 || r.width < 1) continue;
        const cs = getComputedStyle(els[i]);
        if (Number(cs.opacity) < 1) {
          els[i].setAttribute('data-qa-reveal', '1');
          const m = /matrix\(([^)]+)\)/.exec(cs.transform);
          const ty = m ? Number.parseFloat(m[1].split(',')[5]) : 0;
          return { idx: i, ty, opacity: Number(cs.opacity) };
        }
      }
      return null;
    });
    if (hit) {
      found = { page: key, idx: hit.idx };
      expect(Math.abs(hit.ty - 12), `${key}: dịch ban đầu ~12px (đo ${hit.ty})`).toBeLessThanOrEqual(1);
      const el = page.locator('[data-qa-reveal="1"]').first();
      await el.scrollIntoViewIfNeeded();
      await expect.poll(() => el.evaluate((e) => Number(getComputedStyle(e).opacity)), { timeout: 2000 }).toBe(1);
      await expect
        .poll(() => el.evaluate((e) => getComputedStyle(e).transform), { timeout: 2000 })
        .toMatch(/^none$|matrix\(1, 0, 0, 1, 0, 0\)/);
      break;
    }
  }
  expect(
    found,
    'có khối nào hiện dần khi cuộn ở các trang mẫu (V21) — [dự đoán lệch nếu sản phẩm chưa làm hiệu ứng này]',
  ).not.toBeNull();
});

test('VR-V22 sơ đồ công nghệ: nét chạy flow-dash ở chế độ thường (V22)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page, 'technology', 'vi');
  const diagram = tid(page, 'tech-diagram').first();
  await diagram.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const running = await diagram.evaluate((d) =>
    Array.from(d.querySelectorAll('*'))
      .map((e) => {
        const cs = getComputedStyle(e);
        return {
          name: cs.animationName,
          play: cs.animationPlayState,
          dur: Number.parseFloat(cs.animationDuration),
          dash: cs.strokeDasharray,
        };
      })
      .filter((a) => a.name !== 'none' && a.dur > 0 && a.play === 'running' && a.dash !== 'none'),
  );
  expect(running.length, 'có nét có stroke-dasharray đang chạy hoạt ảnh (flow-dash)').toBeGreaterThan(0);
});

// ═════════════════════════ V24 Nhãn phối cảnh ═════════════════════════

test('VR-V24 nhãn "Phối cảnh dự kiến": chip góc dưới trái ảnh, >= 14px, nền #0F5838 chữ trắng, luôn hiện (V24)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const LABEL = /^(phối cảnh dự kiến|artist['’]s impression)$/i;
  let total = 0;
  for (const [key, locale] of [
    ['home', 'vi'],
    ['home', 'en'],
    ['technology', 'vi'],
    ['about', 'vi'],
    ['products', 'vi'],
  ] as Array<[PageKey, Locale]>) {
    await open(page, key, locale);
    const chips = await page.evaluate((src) => {
      const re = new RegExp(src, 'i');
      return Array.from(document.querySelectorAll('body *'))
        .filter(
          (e) =>
            re.test((e.textContent ?? '').trim()) &&
            !Array.from(e.children).some((c) => re.test((c.textContent ?? '').trim())),
        )
        .filter((e) => e.getBoundingClientRect().width > 1)
        .map((e) => {
          const cs = getComputedStyle(e);
          // chip có thể là chính phần tử hoặc cha ngay (nền ở cha)
          const box = cs.backgroundColor === 'rgba(0, 0, 0, 0)' && e.parentElement ? e.parentElement : e;
          const bs = getComputedStyle(box);
          const r = box.getBoundingClientRect();
          const host = box.closest('figure') ?? (box as HTMLElement).offsetParent ?? box.parentElement;
          const h = host ? host.getBoundingClientRect() : r;
          return {
            size: Number.parseFloat(cs.fontSize),
            bg: bs.backgroundColor,
            color: cs.color,
            position: bs.position,
            opacity: Number(bs.opacity),
            fromLeft: r.left - h.left,
            fromBottom: h.bottom - r.bottom,
            inside: r.left >= h.left - 1 && r.right <= h.right + 1 && r.bottom <= h.bottom + 1 && r.top >= h.top - 1,
            leftHalf: r.left + r.width / 2 < h.left + h.width / 2,
            lowerHalf: r.top + r.height / 2 > h.top + h.height / 2,
          };
        });
    }, LABEL.source);
    const exact = chips.filter((c) => c.size > 0);
    total += exact.length;
    for (const c of exact) {
      expect.soft(c.size, `${key}/${locale}: chữ nhãn >= 14px`).toBeGreaterThanOrEqual(14);
      expect.soft(c.bg, `${key}/${locale}: nền chip #0F5838`).toBe(C.brand900);
      expect.soft(c.color, `${key}/${locale}: chữ trắng`).toBe(C.white);
      expect.soft(c.opacity, `${key}/${locale}: luôn hiện (không phụ thuộc hover)`).toBe(1);
      expect.soft(c.inside && c.leftHalf && c.lowerHalf, `${key}/${locale}: góc dưới trái trong khung ảnh`).toBe(true);
    }
  }
  expect(total, 'có ít nhất một nhãn "Phối cảnh dự kiến" trên các trang mẫu').toBeGreaterThan(0);
});

// ═════════════════════════ V28 Nút bóng loáng ═════════════════════════

type GlossItem = { where: string; bg: string; z: string; animDur: string; transDur: string; pos: string };
const glossOf = (loc: Locator) =>
  loc.evaluate((root) => {
    const items: GlossItem[] = [];
    for (const e of [root, ...Array.from(root.querySelectorAll('*'))])
      for (const ps of ['', '::before', '::after']) {
        const cs = getComputedStyle(e, ps || null);
        if (ps && cs.content === 'none') continue;
        if (!/gradient/.test(cs.backgroundImage)) continue;
        if (!/164, 185, 58/.test(cs.backgroundImage) || !/28, 112, 184/.test(cs.backgroundImage)) continue;
        items.push({
          where: `${e.tagName.toLowerCase()}${ps}`,
          bg: cs.backgroundImage,
          z: cs.zIndex,
          animDur: cs.animationDuration,
          transDur: cs.transitionDuration,
          pos: `${cs.transform}|${cs.left}|${cs.translate}|${cs.backgroundPosition}`,
        });
      }
    const rs = getComputedStyle(root);
    return {
      items,
      isolation: rs.isolation,
      bg: rs.backgroundColor,
      color: rs.color,
      border: rs.borderTopColor,
      shadow: rs.boxShadow,
    };
  });

async function mainButton(page: Page): Promise<Locator> {
  const b = page.locator('main a[class*="btn" i], main button[class*="btn" i]').first();
  await expect(b).toBeVisible();
  return b;
}

/** Vệt của nút = pseudo ::before (V28 v0.5.2: chỉ chạy khi hover/focus bàn phím/:active). Đo SAU khi hover/focus, không đo lúc nghỉ. */
const sweepOf = (loc: Locator) =>
  loc.evaluate((root) => {
    const b = getComputedStyle(root, '::before');
    const r = getComputedStyle(root);
    return {
      content: b.content,
      bg: b.backgroundImage,
      z: b.zIndex,
      animName: b.animationName,
      animDur: b.animationDuration,
      pos: `${b.transform}|${b.left}|${b.translate}|${b.backgroundPosition}`,
      isolation: r.isolation,
      color: r.color,
      border: r.borderTopColor,
      shadow: r.boxShadow,
      bgColor: r.backgroundColor,
    };
  });

test('VR-V28 nút bóng loáng: hover/focus bàn phím ⇒ ::before vệt lá #A4B93A → trắng → xanh #1C70B8, .85s, z-index -1, nút isolation:isolate; nền/chữ/viền/bóng không đổi (V28)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  // V28 áp cho .btn, .btn-sec, .f-btn (không áp aria-disabled). .btn-sec chỉ đo nếu trang chủ có.
  const targets: Array<[string, PageKey, () => Promise<Locator | null>]> = [
    ['nút chính (.btn) trang chủ', 'home', () => mainButton(page)],
    ['nút Gửi liên hệ (.f-btn)', 'contact', async () => tid(page, 'contact-submit')],
    [
      'nút phụ (.btn-sec) trang chủ',
      'home',
      async () => {
        const l = page.locator('main .btn-sec').first();
        return (await l.count()) ? l : null;
      },
    ],
  ];
  let measured = 0;
  for (const [label, key, get] of targets) {
    for (const mode of ['focus', 'hover'] as const) {
      await open(page, key, 'vi');
      const el = await get();
      if (!el) continue;
      await el.scrollIntoViewIfNeeded();
      const rest = await sweepOf(el);
      if (mode === 'focus') {
        // Trang mới, chưa dùng chuột ⇒ focus() khớp :focus-visible như thao tác bàn phím.
        await el.focus();
      } else {
        await el.hover();
      }
      await page.waitForTimeout(150);
      const s1 = await sweepOf(el);
      await page.waitForTimeout(300);
      const s2 = await sweepOf(el);
      measured++;
      const w = `${label} [${mode}]`;
      expect.soft(s1.content, `${w}: ::before có nội dung (đo ${s1.content})`).not.toBe('none');
      expect.soft(s1.bg, `${w}: ::before nền gradient`).toMatch(/gradient/);
      expect.soft(s1.bg, `${w}: vệt có lá #A4B93A (164, 185, 58)`).toMatch(/164, 185, 58/);
      expect.soft(s1.bg, `${w}: vệt có trắng giữa`).toMatch(/255, 255, 255/);
      expect.soft(s1.bg, `${w}: vệt có xanh #1C70B8 (28, 112, 184)`).toMatch(/28, 112, 184/);
      expect.soft(s1.z, `${w}: vệt z-index -1 (dưới chữ)`).toBe('-1');
      expect.soft(s1.animDur, `${w}: thời lượng .85s (ngoại lệ V20)`).toBe('0.85s');
      expect.soft(s1.animName, `${w}: có animation đang gắn`).not.toBe('none');
      expect.soft(s1.isolation, `${w}: nút isolation:isolate`).toBe('isolate');
      expect.soft(s2.pos, `${w}: vệt đang lướt (vị trí đổi giữa hai lần đo)`).not.toBe(s1.pos);
      await page.waitForTimeout(800);
      const end = await sweepOf(el);
      expect.soft(end.color, `${w}: chữ không đổi`).toBe(rest.color);
      expect.soft(end.border, `${w}: viền không đổi`).toBe(rest.border);
      // Hover: bóng không đổi so với lúc nghỉ (V25). Focus: bóng đổi thành vòng focus là chủ ý (rgba(15,88,56,.25) 0 0 0 3px),
      // nên so với bóng của chính trạng thái focus đo giữa hoạt ảnh (s2, sau khi chuyển .15s xong): hoạt ảnh không đổi thêm.
      if (mode === 'hover') expect.soft(end.shadow, `${w}: bóng không đổi`).toBe(rest.shadow);
      else expect.soft(end.shadow, `${w}: bóng giữ nguyên vòng focus suốt hoạt ảnh`).toBe(s2.shadow);
      expect.soft(end.bgColor, `${w}: nền không đổi`).toBe(rest.bgColor);
    }
  }
  expect(measured, 'đo được ít nhất .btn và .f-btn ở cả focus và hover').toBeGreaterThanOrEqual(4);
  // Nút nổi (V32/V33): cùng vệt màu logo, nằm TRÊN biểu tượng
  await open(page, 'home', 'vi');
  for (const id of ['fab-zalo', 'fab-messenger', 'fab-call']) {
    const g = await glossOf(tid(page, id));
    expect.soft(g.items.length, `${id}: có vệt màu logo`).toBeGreaterThan(0);
  }
});

test('VR-V28b reduced-motion: hover nút ⇒ ::before không chạy animation, không đổi vị trí (V28, V23)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page, 'contact', 'vi');
  const el = tid(page, 'contact-submit');
  await el.scrollIntoViewIfNeeded();
  await el.hover();
  await page.waitForTimeout(150);
  const s1 = await sweepOf(el);
  await page.waitForTimeout(500);
  const s2 = await sweepOf(el);
  const dur = Math.max(
    0,
    ...s1.animDur.split(',').map((x) => Number.parseFloat(x) * (x.trim().endsWith('ms') ? 0.001 : 1)),
  );
  expect(
    s1.animName === 'none' || dur <= 0.01,
    `reduced-motion: không có animation vệt (đo ${s1.animName} ${s1.animDur})`,
  ).toBe(true);
  expect(s2.pos, 'vệt không lướt khi hover').toBe(s1.pos);
});

// ═════════════════════════ V29 Bản đồ trang Liên hệ ═════════════════════════
// Theo ux-spec §5.5/V29 + design.md "Bản đồ (V29)": không nút "Hiện bản đồ", iframe loading="lazy" (title "Bản đồ: <địa chỉ>"), ghim toạ độ
// mapPoint (20.930031, 106.065651), liên kết "Mở bản đồ" (C-map-open, tab mới), khung 16/10; không có mapPoint ⇒ ẩn khối (INFO-02 đã kiểm).
// contact-info.feature v0.6 đã khớp V29; INFO-03/INFO-03b/INFO-07 ở contact-info.spec.ts đã viết lại theo feature (không bấm, không nút bật bản đồ).
for (const locale of LOCALES) {
  test(`VR-V29-a ${locale}: không còn nút "Hiện bản đồ"; iframe lazy ghim toạ độ nhà máy; có liên kết Mở bản đồ (V29)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await open(page, 'contact', locale);
    expect(await tid(page, 'map-open').count(), 'không có data-testid="map-open" (nút đã bỏ)').toBe(0);
    await expect(page.getByRole('button', { name: /hiện bản đồ|show .*map|interactive map/i })).toHaveCount(0);
    const block = tid(page, 'map-block');
    await expect(block, 'khối bản đồ có mặt (build mặc định có mapPoint)').toHaveCount(1);
    const f = await block.evaluate((b) => {
      const ifr = b.querySelector('iframe');
      const open = Array.from(b.ownerDocument.querySelectorAll('main a[href]')).find((a) =>
        /Mở bản đồ|Open map/i.test(a.textContent ?? ''),
      );
      const r = ifr?.getBoundingClientRect();
      const frameBox = ifr?.parentElement?.getBoundingClientRect();
      return {
        has: !!ifr,
        loading: ifr?.getAttribute('loading'),
        src: ifr?.getAttribute('src') ?? '',
        title: ifr?.getAttribute('title') ?? '',
        ratio: r && r.height ? r.width / r.height : 0,
        boxRatio: frameBox && frameBox.height ? frameBox.width / frameBox.height : 0,
        openHref: open?.getAttribute('href') ?? '',
        openTarget: open?.getAttribute('target') ?? '',
      };
    });
    expect(f.has, 'khối bản đồ chứa <iframe>').toBe(true);
    expect(f.loading, 'iframe loading="lazy"').toBe('lazy');
    expect(f.src, 'nguồn iframe ở https://www.google.com').toMatch(/^https:\/\/www\.google\.com\//);
    expect(f.src, 'ghim vĩ độ nhà máy').toContain('20.930031');
    expect(f.src, 'ghim kinh độ nhà máy').toContain('106.065651');
    expect(f.title.length, 'iframe có title (tiếp cận)').toBeGreaterThan(0);
    expect(
      Math.abs(f.ratio - 1.6) < 0.05 || Math.abs(f.boxRatio - 1.6) < 0.05,
      `khung 16/10 (iframe ${f.ratio}, khung ${f.boxRatio})`,
    ).toBe(true);
    expect(f.openHref, 'liên kết "Mở bản đồ" có mặt').not.toBe('');
    expect(f.openTarget, 'Mở bản đồ ở tab mới').toBe('_blank');
  });
}

test('VR-V29-b chữ địa chỉ ghim hiện cạnh bản đồ: Quốc lộ 39, Phường Bần Yên Nhân, Thị xã Mỹ Hào, Tỉnh Hưng Yên (V29, NAP)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page, 'contact', 'vi');
  const txt = await page.locator('main').innerText();
  expect(txt).toMatch(/Quốc lộ 39/i);
  expect(txt).toMatch(/Bần Yên Nhân/);
  expect(txt).toMatch(/Mỹ Hào/);
  expect(txt).toMatch(/Hưng Yên/);
});

test('VR-V29-c iframe chỉ gọi Google khi người đọc cuộn gần tới (lazy): kéo khung vào màn hình ⇒ có request tới www.google.com (V29)', async ({
  page,
}) => {
  // Chặn mạng thật: chỉ cần thấy trình duyệt GỌI. Không khẳng định "chưa gọi lúc mở trang" vì design.md §6d (i): ≥1024px khung ở cột phải
  // cạnh form ⇒ Chromium tải ngay; ở khổ hẹp khung nằm sau form, nên đo lúc mở trang ở 375px x 640 (trang cao) thay.
  const hits: string[] = [];
  await page.route('https://www.google.com/**', (route) => {
    hits.push(route.request().url());
    return route.abort();
  });
  await page.setViewportSize({ width: 375, height: 640 });
  await open(page, 'contact', 'vi');
  await page.waitForLoadState('networkidle');
  await tid(page, 'map-block').scrollIntoViewIfNeeded();
  await expect
    .poll(() => hits.length, { timeout: 5000, message: 'cuộn tới khung ⇒ trình duyệt gọi Google' })
    .toBeGreaterThan(0);
  expect(
    hits.every((u) => u.startsWith('https://www.google.com/maps')),
    `đường dẫn ${hits[0]}`,
  ).toBe(true);
});
