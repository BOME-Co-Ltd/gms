// Chân trang U10 + quy ước biểu tượng toàn site — nguồn kỳ vọng: ux-spec v0.5 §13b, §14a, bảng kiểm J12–J18, J24, wireframes/footer.html
// (design_approved duyệt lại, gates seq 45). Mã ca FT-xx; truy vết ở test-plan.md mục 0j.
// v0.5 thay: FT-04 (không còn tiêu đề nhóm hiện), FT-13 (bản quyền không lặp tên pháp lý), FT-14 (menu một nhóm). Ca FT-17+ ở visual-v05.spec.ts.
// Selector chỉ dùng thứ spec đặt tên: <footer data-testid="footer">, data-testid="tax-id", <nav aria-label>, <h2>, <address>, aria-current,
// aria-hidden/focusable trên <svg>. KHÔNG dùng class nội bộ (.ft-*, .site-footer) — spec không cam kết tên class.
// Ca "Trường trống" dựng bằng buildSite (fixture company.yaml); ca còn lại chạy trên bản build đang phục vụ (cùng nguồn với LAY-/PERF-).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { buildSite, htmlOf } from '../support/build';
import { companyFile, siteLegalName } from '../support/fixtures';
import { listTargets } from '../support/perf';
import { type Locale, type PageKey, path } from '../support/routes';
import { open, tid, VN_DIACRITIC } from '../support/ui';

const LOCALES: Locale[] = ['vi', 'en'];
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
const trimSlash = (p: string) => (p.length > 1 ? p.replace(/\/$/, '') : p);
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
const footerOf = (html: string) => /<footer\b[^>]*data-testid="footer"[\s\S]*?<\/footer>/i.exec(html)?.[0];

// Chữ theo microcopy ux-spec §14a (C-ft-*) và footer.html (EN của nhãn liên kết).
const T = {
  vi: {
    contactHead: 'Liên hệ',
    srLabels: ['Điện thoại', 'Fanpage', 'Địa chỉ'],
    navLabel: 'Liên kết chân trang',
    info: { careers: 'Tuyển dụng', faq: 'FAQ', privacy: 'Chính sách bảo mật', contact: 'Liên hệ' },
    rights: 'Tất cả các quyền được bảo lưu\\.',
    newTab: '(mở tab mới)',
    labels: { phone: 'Điện thoại', zalo: 'Zalo', fanpage: 'Fanpage', address: 'Địa chỉ', taxId: 'Mã số thuế' },
  },
  en: {
    contactHead: 'Contact',
    srLabels: ['Phone', 'Fanpage', 'Address'],
    navLabel: 'Footer links',
    info: { careers: 'Careers', faq: 'FAQ', privacy: 'Privacy policy', contact: 'Contact' },
    rights: 'All rights reserved\\.',
    newTab: '(opens in a new tab)',
    labels: { phone: 'Phone', zalo: 'Zalo', fanpage: 'Fanpage', address: 'Address', taxId: 'Tax ID' },
  },
} as const;

// ux-spec §13b luật 3 / J17: emoji và ký tự hình. Dải theo yêu cầu: U+2190–21FF, U+2600–27BF, U+1F300–1FAFF.
const FORBIDDEN = /[←-⇿☀-➿\u{1F300}-\u{1FAFF}]/u;
const FORBIDDEN_ALL = new RegExp(FORBIDDEN.source, 'gu');

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// Ký tự hình có trong NỘI DUNG BÀI (content/**) thì không tính lỗi chân trang/giao diện — "ngoài nội dung bài".
const contentSymbols = (): Set<string> => {
  const seen = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(md|mdx|ya?ml|json|txt)$/.test(name))
        for (const m of readFileSync(p, 'utf8').matchAll(FORBIDDEN_ALL)) seen.add(m[0]);
    }
  };
  walk(join(REPO, 'content'));
  return seen;
};

async function gotoAny(page: Page, url: string) {
  await page.goto(url); // gồm cả trang 404 — không dùng open() vì open() đòi 200
}

// ───────────────────────── J12 / J13: kích thước ─────────────────────────

for (const width of [320, 375]) {
  test(`FT-01 Chân trang không cuộn ngang ở ${width}px, chữ dài xuống dòng không tràn (J12, §14a)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const bad: string[] = [];
    for (const t of listTargets()) {
      await gotoAny(page, t.url);
      const m = await page.evaluate(() => {
        const f = document.querySelector('[data-testid="footer"]') as HTMLElement | null;
        if (!f) return null;
        const doc = document.documentElement;
        const wide = Array.from(f.querySelectorAll('*'))
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (r.right > window.innerWidth + 0.5 || r.left < -0.5);
          })
          .map((e) => (e as HTMLElement).outerHTML.slice(0, 70));
        return { page: doc.scrollWidth - doc.clientWidth, footer: f.scrollWidth - f.clientWidth, wide };
      });
      if (!m) bad.push(`${t.url}: không có <footer data-testid="footer">`);
      else if (m.page > 0 || m.footer > 0 || m.wide.length > 0)
        bad.push(`${t.url}: trang +${m.page}px, chân trang +${m.footer}px, tràn: ${m.wide.slice(0, 3).join(' | ')}`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
}

for (const width of [320, 375]) {
  test(`FT-02 Mọi liên kết/hàng bấm của chân trang cao và rộng >= 44px ở ${width}px (J13, §14a)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const small: string[] = [];
    for (const t of listTargets()) {
      await gotoAny(page, t.url);
      const found = await page.locator('[data-testid="footer"] a').evaluateAll((as) =>
        as
          .map((a) => ({ r: a.getBoundingClientRect(), html: (a as HTMLElement).outerHTML.slice(0, 70) }))
          .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 43.99 || r.width < 43.99))
          .map(({ r, html }) => `${Math.round(r.width)}x${Math.round(r.height)} ${html}`),
      );
      for (const s of found) small.push(`${t.url}: ${s}`);
    }
    expect(small, small.join('\n')).toEqual([]);
  });
}

// ───────────────────────── Cấu trúc, microcopy, thứ tự (§14a) ─────────────────────────

for (const locale of LOCALES) {
  test(`FT-03 ${locale}: đúng MỘT nav "${T[locale].navLabel}" chứa Tuyển dụng, FAQ, Chính sách bảo mật, Liên hệ (J-§14a)`, async ({
    page,
  }) => {
    await open(page, 'home', locale);
    const footer = tid(page, 'footer');
    await expect(footer).toHaveCount(1);
    const navs = footer.locator('nav');
    await expect(navs, 'một <nav> duy nhất bọc cả hai nhóm liên kết').toHaveCount(1);
    await expect(navs).toHaveAttribute('aria-label', T[locale].navLabel);
    const links = await navs.locator('a').evaluateAll((as) =>
      as.map((a) => ({
        path: new URL((a as HTMLAnchorElement).href).pathname,
        text: (a.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
    );
    for (const key of ['careers', 'faq', 'privacy', 'contact'] as const) {
      const hit = links.filter((l) => trimSlash(l.path) === trimSlash(path(key, locale)));
      expect(hit.length, `${key}: số liên kết tới ${path(key, locale)} trong nav chân trang`).toBe(1);
      expect(hit[0].text.toLowerCase(), `${key}: chữ liên kết`).toBe(T[locale].info[key].toLowerCase());
    }
    if (locale === 'en')
      for (const l of links) expect(l.text, `nav chân trang EN chứa chữ Việt: "${l.text}"`).not.toMatch(VN_DIACRITIC);
    // v0.5 §14a: menu là MỘT <ul> 10 mục; bốn mục cuối theo thứ tự Tuyển dụng · FAQ · Chính sách bảo mật · Liên hệ
    await expect(navs.locator('ul'), 'menu là một danh sách duy nhất').toHaveCount(1);
    expect(links.length, 'số mục menu').toBe(10);
    expect(
      links.slice(-4).map((l) => trimSlash(l.path)),
      'bốn mục cuối menu',
    ).toEqual((['careers', 'faq', 'privacy', 'contact'] as const).map((k) => trimSlash(path(k, locale))));
  });

  test(`FT-04 ${locale}: không tiêu đề nhóm nào hiện ra; chỉ một h2 .sr-only "${T[locale].contactHead}"; thứ tự DOM Thương hiệu → Liên hệ → Menu (J24, §14a v0.5)`, async ({
    page,
  }) => {
    await open(page, 'home', locale);
    const m = await page.evaluate((legal) => {
      const f = document.querySelector('[data-testid="footer"]') as HTMLElement;
      const vis = (e: Element) => {
        const r = e.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
      };
      const heads = Array.from(f.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) => ({
        tag: h.tagName,
        text: (h.textContent ?? '').trim(),
        shown: vis(h),
      }));
      const brand = Array.from(f.querySelectorAll('*')).find(
        (e) => e.children.length === 0 && (e.textContent ?? '').includes(legal),
      );
      const before = (a?: Node | null, b?: Node | null) =>
        !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return {
        heads,
        brandBeforeContact: before(brand, f.querySelector('address')),
        contactBeforeNav: before(f.querySelector('address'), f.querySelector('nav')),
      };
    }, squash(siteLegalName()));
    expect(
      m.heads.filter((h) => h.shown),
      'tiêu đề nhóm đang hiện trong chân trang (v0.5: không có)',
    ).toEqual([]);
    const h2s = m.heads.filter((h) => h.tag === 'H2');
    expect(h2s.length, 'số h2 trong chân trang').toBe(1);
    expect(h2s[0].text).toBe(T[locale].contactHead);
    expect(m.brandBeforeContact, 'Thương hiệu đứng trước Liên hệ trong DOM').toBe(true);
    expect(m.contactBeforeNav, 'Liên hệ đứng trước Menu trong DOM').toBe(true);
  });

  test(`FT-08c ${locale}: nhãn Điện thoại/Fanpage/Địa chỉ chỉ là .sr-only (không hiện); Zalo và Mã số thuế hiện chữ (§13b luật 5, §14a v0.5)`, async ({
    page,
  }) => {
    await open(page, 'home', locale);
    const m = await page.evaluate(
      (labels) => {
        const f = document.querySelector('[data-testid="footer"]') as HTMLElement;
        const leafWith = (re: RegExp) =>
          Array.from(f.querySelectorAll('*')).filter((e) => e.children.length === 0 && re.test(e.textContent ?? ''));
        const shown = (e: Element) => {
          const r = e.getBoundingClientRect();
          return r.width > 1 && r.height > 1;
        };
        return {
          labels: labels.map((l) => {
            const hits = leafWith(new RegExp(`^\\s*${l}\\s*:\\s*$`));
            return { label: l, found: hits.length, shown: hits.filter(shown).length };
          }),
          zalo: leafWith(/Zalo/).filter(shown).length,
          taxId: Array.from(f.querySelectorAll('[data-testid="tax-id"]')).filter(shown).length,
        };
      },
      [...T[locale].srLabels],
    );
    for (const l of m.labels) {
      expect(l.found, `${locale}: có nhãn .sr-only "${l.label}:" trong hàng`).toBeGreaterThanOrEqual(1);
      expect(l.shown, `${locale}: nhãn "${l.label}:" đang hiện (v0.5: chỉ .sr-only)`).toBe(0);
    }
    expect(m.zalo, `${locale}: chữ "Zalo" hiện`).toBeGreaterThanOrEqual(1);
    expect(m.taxId, `${locale}: dòng mã số thuế hiện`).toBe(1);
  });
}

test('FT-04b Menu chân trang một danh sách hai cột, thứ tự đọc cột 1 rồi cột 2 (J24, §14a) ở 768 và 1200', async ({
  page,
}) => {
  for (const width of [768, 1200]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'home', 'vi');
    const xs = await page
      .locator('[data-testid="footer"] nav a')
      .evaluateAll((as) => as.map((a) => Math.round(a.getBoundingClientRect().left / 4) * 4));
    const cols = Array.from(new Set(xs)).sort((a, b) => a - b);
    expect(cols.length, `${width}: số cột của menu (vị trí x: ${xs.join(',')})`).toBe(2);
    const half = xs.length / 2;
    expect(
      xs.slice(0, half).every((x) => x === cols[0]),
      `${width}: nửa đầu menu nằm cột 1`,
    ).toBe(true);
    expect(
      xs.slice(half).every((x) => x === cols[1]),
      `${width}: nửa sau menu nằm cột 2`,
    ).toBe(true);
  }
});

const CURRENT: PageKey[] = ['about', 'technology', 'careers', 'faq', 'privacy', 'contact'];
for (const locale of LOCALES)
  for (const key of CURRENT) {
    test(`FT-05 ${locale}/${key}: đúng MỘT liên kết chân trang có aria-current="page" và là trang đang xem (§14a)`, async ({
      page,
    }) => {
      await open(page, key, locale);
      const cur = await page
        .locator('[data-testid="footer"] [aria-current]')
        .evaluateAll((as) =>
          as.map((a) => ({ v: a.getAttribute('aria-current'), path: new URL((a as HTMLAnchorElement).href).pathname })),
        );
      expect(cur.length, 'số phần tử aria-current trong chân trang').toBe(1);
      expect(cur[0].v).toBe('page');
      expect(trimSlash(cur[0].path)).toBe(trimSlash(path(key, locale)));
    });
  }

test('FT-06 Mục "đang ở" nhận ra không chỉ bằng màu: chữ đậm + vạch trái (J15, §14a)', async ({ page }) => {
  await open(page, 'faq', 'vi');
  const m = await page.evaluate(() => {
    const f = document.querySelector('[data-testid="footer"]') as HTMLElement;
    const cue = (a: Element) => {
      const s = getComputedStyle(a);
      return {
        weight: Number(s.fontWeight),
        bar: s.boxShadow !== 'none' || parseFloat(s.borderLeftWidth) >= 3,
      };
    };
    const cur = f.querySelector('nav a[aria-current="page"]');
    const others = Array.from(f.querySelectorAll('nav a:not([aria-current])'));
    return { cur: cur ? cue(cur) : null, others: others.map(cue) };
  });
  expect(m.cur, 'có liên kết aria-current trong nav chân trang').not.toBeNull();
  expect(m.cur?.weight, 'chữ đậm (>= 700)').toBeGreaterThanOrEqual(700);
  expect(m.cur?.bar, 'có vạch trái (box-shadow inset hoặc border-left >= 3px)').toBe(true);
  expect(m.others.length).toBeGreaterThan(0);
  expect(
    m.others.filter((o) => o.weight >= 700 || o.bar).length,
    'liên kết KHÔNG ở trang này không được mang cùng dấu hiệu',
  ).toBe(0);
});

for (const locale of LOCALES) {
  test(`FT-07 ${locale}: chân trang hiện tên pháp lý (bug footer-legalname-en, §14a: giữ nguyên chuỗi, khối lang="vi" ở EN)`, async ({
    page,
  }) => {
    await open(page, 'home', locale);
    const legal = squash(siteLegalName());
    const footer = tid(page, 'footer');
    expect(squash((await footer.textContent()) ?? ''), `${locale}: chân trang chứa tên pháp lý`).toContain(legal);
    if (locale === 'en') {
      const inVi = await footer
        .locator('[lang="vi"]')
        .evaluateAll((els) => els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()));
      expect(
        inVi.some((t) => t.includes(legal)),
        `EN: tên pháp lý nằm trong khối lang="vi" (có: ${JSON.stringify(inVi)})`,
      ).toBe(true);
    }
  });

  // v0.5 thay FT-13 bản v0.4 ("© {năm} {tên pháp lý}. …"): C-ft-rights v0.5 = "© {năm}. Tất cả các quyền được bảo lưu." và
  // §14a ghi rõ bỏ tên pháp lý khỏi dòng này vì đã nằm ở khối Thương hiệu, không lặp. Tên pháp lý vẫn được FT-07 khẳng định.
  test(`FT-13 ${locale}: dòng bản quyền "© {năm}. ${T[locale].rights.replace(/\\/g, '')}" và tên pháp lý chỉ xuất hiện MỘT lần trong chân trang (C-ft-rights v0.5, §14a)`, async ({
    page,
  }) => {
    await open(page, 'home', locale);
    const legal = squash(siteLegalName());
    const text = squash((await tid(page, 'footer').textContent()) ?? '');
    expect(text, 'dòng bản quyền').toMatch(new RegExp(`©\\s*\\d{4}\\.\\s*${T[locale].rights}`));
    expect(text.split(legal).length - 1, `số lần tên pháp lý "${legal}" trong chân trang`).toBe(1);
  });
}

// ───────────────────────── Bố cục theo điểm gãy 600/900 (§14a) ─────────────────────────

// v0.5 thay FT-14 bản v0.4: còn ba khối (Thương hiệu | Liên hệ | Menu) thay vì bốn; không còn tiêu đề nhóm để làm mốc.
// Mốc: tên pháp lý (Thương hiệu), danh sách chứa <address> (Liên hệ), <nav> (Menu).
test('FT-14 Bố cục: <600 một cột xếp dọc; 600–899 hai cột, menu hàng dưới trải hai cột; >=900 ba cột (§14a v0.5)', async ({
  page,
}) => {
  const pos = async () =>
    page.evaluate((legal) => {
      const f = document.querySelector('[data-testid="footer"]') as HTMLElement;
      const rect = (e?: Element | null) => {
        const b = e?.getBoundingClientRect();
        return b
          ? { x: Math.round(b.left), y: Math.round(b.top), right: Math.round(b.right), bottom: Math.round(b.bottom) }
          : null;
      };
      const brand = Array.from(f.querySelectorAll('*')).find(
        (e) => e.children.length === 0 && (e.textContent ?? '').includes(legal),
      );
      return {
        brand: rect(brand),
        contact: rect(f.querySelector('address')?.closest('ul')),
        nav: rect(f.querySelector('nav')),
      };
    }, squash(siteLegalName()));

  await page.setViewportSize({ width: 375, height: 800 });
  await open(page, 'home', 'vi');
  const a = await pos();
  if (!(a.brand && a.contact && a.nav)) throw new Error(`375: thiếu khối chân trang ${JSON.stringify(a)}`);
  expect(Math.abs(a.contact.x - a.brand.x), '375: Liên hệ cùng cột Thương hiệu').toBeLessThanOrEqual(4);
  expect(Math.abs(a.nav.x - a.contact.x), '375: Menu cùng cột').toBeLessThanOrEqual(4);
  expect(a.contact.y, '375: Liên hệ dưới Thương hiệu').toBeGreaterThan(a.brand.y);
  expect(a.nav.y, '375: Menu dưới Liên hệ').toBeGreaterThanOrEqual(a.contact.bottom - 2);

  await page.setViewportSize({ width: 768, height: 900 });
  await open(page, 'home', 'vi');
  const b = await pos();
  if (!(b.brand && b.contact && b.nav)) throw new Error(`768: thiếu khối chân trang ${JSON.stringify(b)}`);
  expect(b.contact.x, '768: Liên hệ nằm cột phải của Thương hiệu').toBeGreaterThan(b.brand.x + 100);
  expect(Math.abs(b.nav.x - b.brand.x), '768: Menu bắt đầu hàng dưới ở cột trái').toBeLessThanOrEqual(4);
  expect(b.nav.y, '768: Menu ở hàng dưới').toBeGreaterThanOrEqual(b.contact.bottom - 2);
  expect(b.nav.right, '768: Menu trải sang cột phải').toBeGreaterThan(b.contact.x + 100);

  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page, 'home', 'vi');
  const c = await pos();
  if (!(c.brand && c.contact && c.nav)) throw new Error(`1200: thiếu khối chân trang ${JSON.stringify(c)}`);
  expect(c.brand.x, '1200: Thương hiệu → Liên hệ').toBeLessThan(c.contact.x - 100);
  expect(c.contact.x, '1200: Liên hệ → Menu').toBeLessThan(c.nav.x - 100);
  expect(Math.abs(c.nav.y - c.contact.y), '1200: Liên hệ và Menu cùng một hàng').toBeLessThanOrEqual(8);
});

// ───────────────────────── Màu, tương phản, focus (J14, §5.2) ─────────────────────────

test('FT-15 Focus bàn phím trong chân trang: viền trắng >= 3px, offset 2px (J14, §14a, §5.2)', async ({ page }) => {
  await open(page, 'home', 'vi');
  const links = tid(page, 'footer').locator('a');
  const n = await links.count();
  expect(n, 'chân trang có liên kết').toBeGreaterThan(0);
  for (const i of [0, n - 1]) {
    // Shift+Tab rồi Tab: ép phương thức nhập là bàn phím để :focus-visible áp dụng.
    await links.nth(i).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement;
      const s = getComputedStyle(e);
      return {
        inFooter: !!e.closest('[data-testid="footer"]'),
        style: s.outlineStyle,
        width: parseFloat(s.outlineWidth),
        color: s.outlineColor,
        offset: parseFloat(s.outlineOffset),
      };
    });
    expect(ring.inFooter, `liên kết #${i}: focus trở lại đúng liên kết`).toBe(true);
    expect(ring.style, `#${i} kiểu viền`).not.toBe('none');
    expect(ring.width, `#${i} độ dày viền`).toBeGreaterThanOrEqual(3);
    expect(ring.color, `#${i} màu viền`).toBe('rgb(255, 255, 255)');
    expect(ring.offset, `#${i} offset`).toBe(2);
  }
});

test('FT-16 Nền chân trang #0F5838 và mọi chữ trong chân trang đạt tương phản >= 4.5:1 (J14, T1)', async ({ page }) => {
  for (const locale of LOCALES) {
    await open(page, 'home', locale);
    const r = await page.evaluate(() => {
      const f = document.querySelector('[data-testid="footer"]') as HTMLElement;
      const parse = (c: string) => {
        const m = /rgba?\(([^)]+)\)/.exec(c);
        if (!m) return null;
        const p = m[1]
          .split(/[\s,/]+/)
          .filter(Boolean)
          .map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
      };
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const lum = (c: { r: number; g: number; b: number }) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
      const bgRaw = getComputedStyle(f).backgroundColor;
      const footerBg = parse(bgRaw);
      const fails: string[] = [];
      if (!footerBg) return { bg: bgRaw, fails: [`không đọc được nền: ${bgRaw}`] };
      // nền đặc gần nhất của tổ tiên (vd ô logo .ft-logo nền trắng riêng); không có thì lấy nền chân trang
      const solidBgOf = (el: Element) => {
        for (let n: Element | null = el; n && f.contains(n); n = n.parentElement) {
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && c.a >= 1) return c;
        }
        return footerBg;
      };
      for (const el of Array.from(f.querySelectorAll('*'))) {
        const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
        if (!own) continue;
        const b = el.getBoundingClientRect();
        if (b.width <= 1 || b.height <= 1) continue; // chữ .sr-only
        const fg = parse(getComputedStyle(el).color);
        if (!fg) {
          fails.push(`không đọc được màu chữ: ${getComputedStyle(el).color}`);
          continue;
        }
        const bg = solidBgOf(el);
        const mix = (k: 'r' | 'g' | 'b') => fg[k] * fg.a + bg[k] * (1 - fg.a);
        const l1 = lum({ r: mix('r'), g: mix('g'), b: mix('b') });
        const l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < 4.5)
          fails.push(
            `${ratio.toFixed(2)}:1 "${(el.textContent ?? '').trim().slice(0, 30)}" ${getComputedStyle(el).color}`,
          );
      }
      return { bg: bgRaw, fails };
    });
    expect(r.bg, `${locale}: nền chân trang`).toBe('rgb(15, 88, 56)');
    expect(r.fails, `${locale}: ${r.fails.join('\n')}`).toEqual([]);
  }
});

// ───────────────────────── §13b / J16 / J17: biểu tượng ─────────────────────────

test('FT-09 Giao diện không có emoji/ký tự hình: không trong header/chân trang/nav/nút/form và không trong ::before/::after (J17, §13b luật 3)', async ({
  page,
}) => {
  const bad: string[] = [];
  for (const t of listTargets()) {
    await gotoAny(page, t.url);
    const found = await page.evaluate(
      ([src]) => {
        const re = new RegExp(src, 'u');
        const out: string[] = [];
        const chrome =
          'header, footer, nav, button, form, summary, [role="button"], a[class*="btn" i], a[class*="cta" i]';
        for (const el of Array.from(document.querySelectorAll(chrome))) {
          const m = re.exec((el as HTMLElement).outerHTML);
          if (m) out.push(`<${el.tagName.toLowerCase()}> chứa U+${m[0].codePointAt(0)?.toString(16).toUpperCase()}`);
        }
        for (const el of Array.from(document.querySelectorAll('*')))
          for (const ps of ['::before', '::after'] as const) {
            const c = getComputedStyle(el, ps).content;
            if (c && c !== 'none' && c !== 'normal' && re.test(c))
              out.push(`${el.tagName.toLowerCase()}${ps} content=${c}`);
          }
        return Array.from(new Set(out));
      },
      [FORBIDDEN.source],
    );
    for (const f of found) bad.push(`${t.url}: ${f}`);
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('FT-09b HTML sinh ra của mọi trang không có emoji/ký tự hình ngoài nội dung bài (J17, V17)', async ({ page }) => {
  const allowed = contentSymbols(); // ký tự hình vốn có trong content/** là nội dung bài
  const bad: string[] = [];
  for (const t of listTargets()) {
    const res = await page.request.get(t.url);
    // bỏ <script>/<style> và comment HTML: ký tự trong mã/comment không phải chữ hiển thị; vẫn quét chữ và thuộc tính
    const html = (await res.text())
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '');
    const hit = new Set<string>();
    for (const m of html.matchAll(FORBIDDEN_ALL)) if (!allowed.has(m[0])) hit.add(m[0]);
    for (const ch of hit) bad.push(`${t.url}: U+${ch.codePointAt(0)?.toString(16).toUpperCase()} (${ch})`);
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('FT-09c Không dùng font biểu tượng (class fa-/material-icons/glyphicon/bi-) trên mọi trang (J17, §13b luật 1)', async ({
  page,
}) => {
  const ICON_FONT =
    /\bclass="[^"]*\b(fa-[a-z]|fas|far|fab|material-icons|material-symbols|glyphicon|bi-[a-z]|icon-font)\b/;
  const bad: string[] = [];
  for (const t of listTargets()) {
    const html = await (await page.request.get(t.url)).text();
    const m = ICON_FONT.exec(html);
    if (m) bad.push(`${t.url}: ${m[0].slice(0, 80)}`);
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

test('FT-10 Mọi <svg> trang trí có aria-hidden="true" focusable="false"; nút/liên kết chỉ có biểu tượng có tên; không sprite ngoài (J17, §13b luật 1,4)', async ({
  page,
}) => {
  const bad: string[] = [];
  for (const t of listTargets()) {
    await gotoAny(page, t.url);
    const found = await page.evaluate(() => {
      const out: string[] = [];
      for (const s of Array.from(document.querySelectorAll('svg'))) {
        const meaningful =
          s.getAttribute('role') === 'img' ||
          s.hasAttribute('aria-label') ||
          s.hasAttribute('aria-labelledby') ||
          s.querySelector(':scope > title') !== null; // hình có nghĩa riêng (vd sơ đồ), không phải biểu tượng trang trí
        if (!meaningful && (s.getAttribute('aria-hidden') !== 'true' || s.getAttribute('focusable') !== 'false'))
          out.push(`svg trang trí thiếu aria-hidden/focusable: ${s.outerHTML.slice(0, 90)}`);
      }
      for (const u of Array.from(document.querySelectorAll('svg use'))) {
        const ref = u.getAttribute('href') ?? u.getAttribute('xlink:href') ?? '';
        if (!ref.startsWith('#')) out.push(`<use> trỏ tệp ngoài: ${ref}`);
      }
      for (const el of Array.from(document.querySelectorAll('a[href], button, [role="button"]'))) {
        const clone = el.cloneNode(true) as HTMLElement;
        for (const s of Array.from(clone.querySelectorAll('svg'))) s.remove();
        const named =
          (clone.textContent ?? '').trim() !== '' ||
          !!el.getAttribute('aria-label')?.trim() ||
          el.hasAttribute('aria-labelledby');
        if (!named) out.push(`điều khiển không có tên: ${(el as HTMLElement).outerHTML.slice(0, 90)}`);
      }
      return Array.from(new Set(out));
    });
    for (const f of found) bad.push(`${t.url}: ${f}`);
  }
  expect(bad, bad.join('\n')).toEqual([]);
});

for (const locale of LOCALES) {
  test(`FT-11 ${locale}: forced-colors: active — biểu tượng chân trang vẫn thấy được, số lượng không đổi (J16, §13b)`, async ({
    page,
  }) => {
    await open(page, 'home', locale);
    const count = () => tid(page, 'footer').locator('svg').count();
    const before = await count();
    expect(before, 'chân trang có biểu tượng khi bình thường').toBeGreaterThan(0);
    await page.emulateMedia({ forcedColors: 'active' });
    await open(page, 'home', locale);
    expect(await count(), 'số biểu tượng không đổi dưới forced-colors').toBe(before);
    const hidden = await tid(page, 'footer')
      .locator('svg')
      .evaluateAll((svgs) =>
        svgs
          .map((s) => {
            const st = getComputedStyle(s);
            const r = s.getBoundingClientRect();
            return {
              html: s.outerHTML.slice(0, 70),
              ok: st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0,
            };
          })
          .filter((x) => !x.ok)
          .map((x) => x.html),
      );
    expect(hidden, 'biểu tượng bị ẩn hoặc kích thước 0 dưới forced-colors').toEqual([]);
  });
}

// ───────────────────────── J18: trường trống ⇒ ẩn hàng (build fixture) ─────────────────────────

const FULL = {
  legalName: 'Công ty Mẫu GMS',
  address: { vi: 'Số 1 Đường Mẫu, Hưng Yên', en: '1 Sample Street, Hung Yen' },
  phone: '+84900000000',
  zalo: 'https://zalo.me/0900000000',
  social: [{ name: 'Facebook', url: 'https://facebook.com/gmshungyen' }],
  taxId: '0900000000',
};
type RowKey = keyof (typeof T)['vi']['labels'];

test('FT-08 Đủ trường ⇒ chân trang hiện đủ 5 hàng có nhãn chữ ở cả vi và en, mã số thuế có data-testid="tax-id" (J18, §14a)', () => {
  const r = buildSite(companyFile(FULL), { CONTACT_MAIL_READY: 'true' });
  expect(r.ok, r.log).toBe(true);
  for (const locale of LOCALES) {
    const footer = footerOf(htmlOf(r, path('contact', locale))!);
    expect(footer, `${locale}: có chân trang`).toBeDefined();
    const ft = textOf(footer!);
    for (const label of Object.values(T[locale].labels)) expect(ft, `${locale}: nhãn "${label}"`).toContain(label);
    expect(footer, `${locale}: href tel:`).toContain('href="tel:+84900000000"');
    expect(footer, `${locale}: href Zalo`).toMatch(/href="https:\/\/zalo\.me\/0900000000"/);
    expect(footer, `${locale}: href Fanpage`).toContain('facebook.com/gmshungyen');
    expect(footer, `${locale}: <address>`).toMatch(/<address\b/);
    expect(footer, `${locale}: dòng mã số thuế`).toContain('data-testid="tax-id"');
    expect(ft, `${locale}: số mã số thuế`).toContain('0900000000');
    expect(ft, `${locale}: địa chỉ theo locale`).toContain(locale === 'vi' ? 'Số 1 Đường Mẫu' : '1 Sample Street');
  }
});

const EMPTY_CASES: Array<{ row: RowKey; over: Record<string, unknown>; gone: RegExp }> = [
  { row: 'phone', over: { phone: null }, gone: /href="tel:/ },
  { row: 'zalo', over: { zalo: null }, gone: /zalo\.me/ },
  { row: 'fanpage', over: { social: null }, gone: /facebook\.com\/gmshungyen/ },
  { row: 'taxId', over: { taxId: null }, gone: /data-testid="tax-id"/ },
];
for (const c of EMPTY_CASES) {
  test(`FT-08 Trường trống "${c.row}" ⇒ ẩn cả hàng và nhãn, không khoảng trống; các hàng khác còn nguyên (J18, §14a)`, () => {
    const r = buildSite(companyFile({ ...FULL, ...c.over }), { CONTACT_MAIL_READY: 'true' });
    expect(r.ok, r.log).toBe(true);
    for (const locale of LOCALES) {
      const footer = footerOf(htmlOf(r, path('contact', locale))!);
      expect(footer, `${locale}: có chân trang`).toBeDefined();
      const ft = textOf(footer!);
      expect(footer, `${locale}: còn dấu vết hàng "${c.row}"`).not.toMatch(c.gone);
      expect(ft, `${locale}: còn nhãn "${T[locale].labels[c.row]}"`).not.toContain(T[locale].labels[c.row]);
      for (const [k, label] of Object.entries(T[locale].labels))
        if (k !== c.row && k !== 'fanpage' && k !== 'zalo' && k !== 'phone' && k !== 'taxId')
          expect(ft, `${locale}: hàng "${k}" phải còn`).toContain(label);
      for (const other of EMPTY_CASES.filter((o) => o.row !== c.row))
        expect(ft, `${locale}: hàng "${other.row}" phải còn nguyên`).toContain(T[locale].labels[other.row]);
      const empty = (footer!.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) ?? []).filter((li) => textOf(li).trim() === '');
      expect(empty, `${locale}: có <li> rỗng (khoảng trống thay thế)`).toEqual([]);
      expect(footer, `${locale}: <ul> rỗng`).not.toMatch(/<ul\b[^>]*>\s*<\/ul>/);
    }
  });
}

test('FT-12 Liên kết mở tab mới trong chân trang có rel noopener và chữ .sr-only "(mở tab mới)"/"(opens in a new tab)" (§13b luật 7, C-ft-newtab)', () => {
  const r = buildSite(companyFile(FULL), { CONTACT_MAIL_READY: 'true' });
  expect(r.ok, r.log).toBe(true);
  for (const locale of LOCALES) {
    const footer = footerOf(htmlOf(r, path('contact', locale))!)!;
    const external = footer.match(/<a\b[^>]*target="_blank"[^>]*>[\s\S]*?<\/a>/g) ?? [];
    expect(external.length, `${locale}: số liên kết target=_blank (Zalo + Fanpage)`).toBeGreaterThanOrEqual(2);
    for (const a of external) {
      expect(a, `${locale}: rel`).toMatch(/rel="[^"]*\bnoopener\b/);
      expect(textOf(a), `${locale}: chữ báo mở tab mới`).toContain(T[locale].newTab);
    }
  }
});
