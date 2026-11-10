// Bám wireframe green v0.3.8 (ux-spec V26/V27/V34; wireframes/home.html, contact.html) — test-plan.md mục 0p.
// Nguồn kỳ vọng: HTML wireframe đã duyệt (design_approved reapprove 06/11), KHÔNG phải mã src/. Quyết định admin 07/11:
// wireframe thắng test cũ (LAY-01, LAY-04, footer, stepper, nút nổi). Selector lấy từ wireframe: .top, header.hdr, .lang, .hero,
// #hai-nhanh .board, #hanh-trinh, .sec-stats, .sec-values, data-testid floating-contact/fab-*/back-to-top, footer .ft-logo.
// Ca chạy trên bản build đang phục vụ (cùng nguồn với FT-/LAY-/PERF-).
import { expect, test } from '@playwright/test';
import { type Locale, type PageKey, path } from '../support/routes';
import { open, tid } from '../support/ui';

const LOCALES: Locale[] = ['vi', 'en'];
const trimSlash = (p: string) => (p.length > 1 ? p.replace(/\/$/, '') : p);
// V43 (lệnh thay đổi 01, 10/11/2026): menu chính 5 mục; thanh trên 5 mục, "Ứng dụng" (Sản phẩm đầu ra) đứng đầu.
const MAIN: PageKey[] = ['home', 'about', 'technology', 'projects', 'news'];
const SUB: PageKey[] = ['products', 'careers', 'faq', 'privacy', 'contact'];

for (const locale of LOCALES) {
  test(`WF-HDR-01 ${locale}: thanh trên có hotline tel:+84987998370 và menu phụ Ứng dụng, Tuyển dụng, FAQ, Chính sách bảo mật, Liên hệ (V26, V43, §2b)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, 'home', locale);
    const top = page.locator('.top');
    await expect(top, 'thanh trên .top').toHaveCount(1);
    await expect(top.locator('a[href="tel:+84987998370"]'), 'hotline').toHaveCount(1);
    const paths = await top
      .locator('nav a')
      .evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
    expect(paths.map(trimSlash)).toEqual(SUB.map((k) => trimSlash(path(k, locale))));
  });

  test(`WF-HDR-02 ${locale}: header có logo về trang chủ và menu chính 5 mục đúng thứ tự (V26, V43)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, 'home', locale);
    const hdr = page.locator('header.hdr');
    await expect(hdr).toHaveCount(1);
    expect(trimSlash(new URL((await hdr.locator('a.brand').getAttribute('href')) ?? '', 'http://x').pathname)).toBe(
      trimSlash(path('home', locale)),
    );
    await expect(hdr.locator('a.brand svg.logo-gms'), 'logo GMS dạng svg').toHaveCount(1);
    const paths = await hdr
      .locator('nav.nav a')
      .evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
    expect(paths.map(trimSlash)).toEqual(MAIN.map((k) => trimSlash(path(k, locale))));
    const cur = await hdr.locator('nav.nav a[aria-current="page"]').evaluateAll((as) => as.length);
    expect(cur, 'đúng một mục aria-current ở trang chủ').toBe(1);
  });

  test(`WF-HDR-03 ${locale}: <1200px menu thu vào nút Mở menu, ngăn kéo hiện khi bấm và đóng lại bằng nút Đóng (V26, §4)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await open(page, 'home', locale);
    const btn = page.locator('#menu-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#drawer')).toBeHidden();
    await btn.click();
    await expect(page.locator('#drawer')).toBeVisible();
    await expect(page.locator('#drawer')).toHaveAttribute('aria-modal', 'true');
    await page.locator('#menu-close').click();
    await expect(page.locator('#drawer')).toBeHidden();
  });

  test(`WF-LANG-01 ${locale}: cờ ngôn ngữ — hai liên kết cờ Việt/Anh, không chữ, có tên truy cập, trang đang xem aria-current (V26)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, 'home', locale);
    const lang = page.locator('nav.lang');
    await expect(lang).toHaveCount(1);
    const links = lang.locator('a');
    await expect(links).toHaveCount(2);
    const info = await links.evaluateAll((as) =>
      as.map((a) => ({
        lang: a.getAttribute('lang'),
        label: a.getAttribute('aria-label'),
        path: new URL((a as HTMLAnchorElement).href).pathname,
        flag: a.querySelectorAll('svg.flag').length,
        text: (a.textContent ?? '').trim(),
        cur: a.hasAttribute('aria-current'),
      })),
    );
    expect(info.map((i) => i.lang)).toEqual(['vi', 'en']);
    expect(info.map((i) => i.label)).toEqual(['Tiếng Việt', 'English']);
    expect(info.map((i) => trimSlash(i.path))).toEqual([trimSlash(path('home', 'vi')), trimSlash(path('home', 'en'))]);
    for (const i of info) {
      expect(i.flag, `cờ svg trong liên kết ${i.lang}`).toBe(1);
      expect(i.text, `liên kết ${i.lang} không có chữ hiển thị`).toBe('');
    }
    expect(
      info.filter((i) => i.cur).map((i) => i.lang),
      'ngôn ngữ đang xem',
    ).toEqual([locale]);
  });
}

test('WF-LANG-02 Bấm cờ English ở trang chủ sang /en, bấm cờ Việt về / (V26)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, 'home', 'vi');
  await page.locator('nav.lang a[lang="en"]').click();
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('nav.lang a[lang="vi"]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
});

test('WF-HERO-01 vi: hero có đúng một h1 hai dòng "Giải pháp thông minh / Kiến tạo giá trị xanh", hai nút CTA, nhãn "Phối cảnh dự kiến" (V26, S6, S17)', async ({
  page,
}) => {
  await open(page, 'home', 'vi');
  const hero = page.locator('section.hero');
  await expect(hero).toHaveCount(1);
  const h1 = hero.locator('h1');
  await expect(h1).toHaveCount(1);
  expect(((await h1.textContent()) ?? '').replace(/\s+/g, ' ').trim()).toBe(
    'Giải pháp thông minh Kiến tạo giá trị xanh',
  );
  const ctas = await hero
    .locator('.hero-cta a')
    .evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
  expect(ctas.length, 'hai nút CTA').toBe(2);
  expect(trimSlash(ctas[0]), 'CTA 1 tới Công nghệ').toBe(path('technology', 'vi'));
  expect(trimSlash(ctas[1]), 'CTA 2 tới Liên hệ').toBe(path('contact', 'vi'));
  await expect(hero.getByText('Phối cảnh dự kiến'), 'nhãn phối cảnh nhìn thấy cạnh hình').toBeVisible();
});

test('WF-HERO-02 en: hero một h1 "Smart solutions", CTA tới /en/technology và /en/contact, nhãn phối cảnh EN', async ({
  page,
}) => {
  await open(page, 'home', 'en');
  const hero = page.locator('section.hero');
  await expect(hero.locator('h1')).toHaveCount(1);
  expect(((await hero.locator('h1').textContent()) ?? '').replace(/\s+/g, ' ')).toContain('Smart solutions');
  const ctas = await hero
    .locator('.hero-cta a')
    .evaluateAll((as) => as.map((a) => new URL((a as HTMLAnchorElement).href).pathname));
  expect(ctas.map(trimSlash)).toEqual([path('technology', 'en'), path('contact', 'en')]);
  await expect(hero.getByText("Artist's impression")).toBeVisible();
});

for (const locale of LOCALES) {
  test(`WF-FAB-01 ${locale}: cụm nút nổi gồm Về đầu trang, Zalo, Messenger, Gọi — đúng href, nhãn, mở tab mới an toàn (V31–V32)`, async ({
    page,
  }) => {
    await open(page, 'home', locale);
    const box = tid(page, 'floating-contact');
    await expect(box).toHaveCount(1);
    await expect(box).toBeVisible();
    const up = tid(page, 'back-to-top');
    await expect(up).toHaveAttribute('href', '#top');
    const zalo = tid(page, 'fab-zalo');
    await expect(zalo).toHaveAttribute('href', 'https://zalo.me/0987998370');
    await expect(zalo).toHaveAttribute('target', '_blank');
    expect(await zalo.getAttribute('rel')).toMatch(/\bnoopener\b/);
    const msg = tid(page, 'fab-messenger');
    await expect(msg).toHaveAttribute('href', 'https://m.me/gmshungyen');
    await expect(msg).toHaveAttribute('target', '_blank');
    expect(await msg.getAttribute('rel')).toMatch(/\bnoopener\b/);
    await expect(tid(page, 'fab-call')).toHaveAttribute('href', 'tel:+84987998370');
    // V31: nút về đầu trang chỉ hiện khi cuộn tới chân trang ⇒ cuộn trước khi đo vùng bấm.
    await tid(page, 'footer').scrollIntoViewIfNeeded();
    await expect(up).toBeVisible();
    for (const id of ['back-to-top', 'fab-zalo', 'fab-messenger', 'fab-call']) {
      const a = tid(page, id);
      expect((await a.getAttribute('aria-label'))?.trim(), `${id}: tên truy cập`).toBeTruthy();
      const r = await a.boundingBox();
      expect(r && r.width >= 44 && r.height >= 44, `${id}: vùng bấm >= 44px (${r?.width}x${r?.height})`).toBe(true);
    }
    const order = await box.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('data-testid')));
    expect(order, 'thứ tự nút từ trên xuống').toEqual(['back-to-top', 'fab-zalo', 'fab-messenger', 'fab-call']);
  });
}

test('WF-FAB-03 Đầu trang nút Về đầu trang ẩn; cuộn tới chân trang thì hiện (V31)', async ({ page }) => {
  await open(page, 'home', 'vi');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(tid(page, 'back-to-top'), 'đầu trang: nút về đầu ẩn').toBeHidden();
  await tid(page, 'footer').scrollIntoViewIfNeeded();
  await expect(tid(page, 'back-to-top'), 'tới chân trang: nút về đầu hiện').toBeVisible();
});

test('WF-FAB-02 Cụm nút nổi cố định góc phải dưới và còn nằm trong khung nhìn sau khi cuộn (V31)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await open(page, 'home', 'vi');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  const box = await tid(page, 'floating-contact').boundingBox();
  expect(box, 'có hộp').not.toBeNull();
  if (box) {
    expect(box.x + box.width, 'trong khung ngang').toBeLessThanOrEqual(375.5);
    expect(box.y, 'trong khung dọc').toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, 'trong khung dọc').toBeLessThanOrEqual(700.5);
    expect(box.x, 'nằm nửa phải').toBeGreaterThan(375 / 2 - 40);
    expect(box.y, 'nằm nửa dưới').toBeGreaterThan(700 / 2 - 100);
  }
});

test('WF-FT-LOGO Chân trang dùng logo GMS dạng svg (role=img, aria-label "Logo GMS"), không ô chữ giữ chỗ (V26, thay unit logo chân trang)', async ({
  page,
}) => {
  await open(page, 'home', 'vi');
  const logo = tid(page, 'footer').locator('svg.ft-logo');
  await expect(logo).toHaveCount(1);
  await expect(logo).toHaveAttribute('role', 'img');
  await expect(logo).toHaveAttribute('aria-label', 'Logo GMS');
  await expect(tid(page, 'footer').locator('span.ft-logo'), 'không ô chữ giữ chỗ').toHaveCount(0);
});

for (const locale of LOCALES) {
  test(`WF-HOME-01 ${locale}: thứ tự khối trang chủ hero → sơ đồ hai nhánh → hành trình → [số liệu nếu có] → giá trị (V26, §12b)`, async ({
    page,
  }) => {
    await open(page, 'home', locale);
    const ys = await page.evaluate(() => {
      const top = (sel: string) => {
        const e = document.querySelector(sel);
        return e ? e.getBoundingClientRect().top + window.scrollY : null;
      };
      return {
        hero: top('main section.hero'),
        flow: top('main #hai-nhanh'),
        journey: top('main #hanh-trinh'),
        stats: top('main section.sec-stats'),
        values: top('main section.sec-values'),
      };
    });
    expect(ys.hero, 'có hero').not.toBeNull();
    expect(ys.flow, 'có sơ đồ #hai-nhanh').not.toBeNull();
    expect(ys.journey, 'có hành trình #hanh-trinh').not.toBeNull();
    expect(ys.values, 'có khối giá trị .sec-values').not.toBeNull();
    const seq = [ys.hero, ys.flow, ys.journey, ys.stats, ys.values].filter((v): v is number => v !== null);
    expect(seq, `thứ tự dọc (hero, sơ đồ, hành trình, số liệu?, giá trị): ${JSON.stringify(ys)}`).toEqual(
      [...seq].sort((a, b) => a - b),
    );
    expect(new Set(seq).size, 'các khối không chồng cùng vị trí').toBe(seq.length);
  });
}

test('WF-HOME-02 vi: sơ đồ hai nhánh có 6 đầu ra đều nhãn "Định hướng", và hành trình có 5 bước "đã xong" (V26, V40)', async ({
  page,
}) => {
  await open(page, 'home', 'vi');
  const outs = page.locator('#hai-nhanh .o');
  await expect(outs).toHaveCount(6);
  for (const t of await outs.locator('.tag').allTextContents()) expect(t.trim()).toBe('Định hướng');
  // Markup site: ol.j-steps > li[data-testid=journey-step], data-status theo nhãn hiển thị (V40 "đã xong").
  const steps = page.locator('#hanh-trinh ol.j-steps > li[data-testid="journey-step"]');
  await expect(steps).toHaveCount(5);
  for (const li of await steps.all()) {
    await expect(li).toHaveAttribute('data-status', 'đã xong');
    // Nhãn nhìn thấy phải khớp thuộc tính (V40): thuộc tính đúng mà chữ sai thì không lọt.
    await expect(li.getByText(/đã xong/i).first(), 'chữ "đã xong" nhìn thấy ở bước').toBeVisible();
  }
});

test('WF-HOME-03 vi: số liệu — khi chưa có số công bố thì không có khối số liệu và không có chuỗi giữ chỗ "[cần hỏi khách]" (S7, U15, N14)', async ({
  page,
}) => {
  await open(page, 'home', 'vi');
  expect(await page.locator('section.sec-stats').count(), 'v1 không có số được công bố ⇒ không có khối').toBe(0);
  expect(await page.locator('body').innerText()).not.toContain('[cần hỏi khách]');
});

test('WF-BOARD-01 Sơ đồ .board chưa có class live khi nằm ngoài khung nhìn, có live sau khi cuộn tới (V26, IntersectionObserver ngưỡng 0.2)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, 'home', 'vi');
  const board = page.locator('#hai-nhanh .board');
  await expect(board).toHaveCount(1);
  const offscreen = await board.evaluate((e) => e.getBoundingClientRect().top > window.innerHeight);
  expect(offscreen, 'sơ đồ nằm dưới nếp gấp đầu tiên ở 1280x720').toBe(true);
  expect(await board.evaluate((e) => e.classList.contains('live')), 'chưa live khi chưa cuộn tới').toBe(false);
  await board.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('#hai-nhanh .board')?.scrollIntoView({ block: 'center' }));
  await expect(board).toHaveClass(/\blive\b/, { timeout: 5_000 });
});

test('WF-BOARD-02 reduced-motion: sơ đồ .board có class live ngay, không chờ cuộn (V26, V28)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'home', 'vi');
  await expect(page.locator('#hai-nhanh .board')).toHaveClass(/\blive\b/, { timeout: 5_000 });
});

test('WF-CONTACT-01 vi: /lien-he kênh Zalo hiện số "Zalo 098 799 83 70", href zalo.me/0987998370, mở tab mới an toàn (V34, C-channel-zalo)', async ({
  page,
}) => {
  await open(page, 'contact', 'vi');
  const zalo = page.locator('ul.ch-list a.ch[href="https://zalo.me/0987998370"]');
  await expect(zalo).toHaveCount(1);
  await expect(zalo).toHaveAttribute('target', '_blank');
  expect(await zalo.getAttribute('rel')).toMatch(/\bnoopener\b/);
  const text = ((await zalo.locator('.ch-val').textContent()) ?? '').replace(/\s+/g, ' ');
  expect(text).toContain('Zalo 098 799 83 70');
  expect(text).toContain('(mở tab mới)');
  await expect(zalo.locator('.ch-val'), 'số hiện ra, không chỉ .sr-only').toBeVisible();
  await expect(zalo.locator('svg.zalo-mark'), 'logo Zalo').toHaveCount(1);
  const phone = page.locator('ul.ch-list a.ch[href="tel:+84987998370"]');
  await expect(phone.locator('.ch-val')).toContainText('098 799 83 70');
});

test('WF-CONTACT-02 en: /en/contact kênh Zalo hiện số định dạng quốc tế (contact-info.feature S24) và nhãn mở tab mới tiếng Anh', async ({
  page,
}) => {
  await open(page, 'contact', 'en');
  const zalo = page.locator('ul.ch-list a.ch[href="https://zalo.me/0987998370"]');
  await expect(zalo).toHaveCount(1);
  const text = ((await zalo.locator('.ch-val').textContent()) ?? '').replace(/\s+/g, ' ');
  expect(text).toContain('+84 98 799 83 70');
  expect(text).toContain('(opens in a new tab)');
});
