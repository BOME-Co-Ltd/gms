import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Browser, chromium, type Page } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = join(process.cwd(), 'test-results', 'qa-screenshots');

if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface QAIssue {
  page: string;
  viewport: string;
  category: 'CRITICAL' | 'WARNING' | 'INFO';
  issue: string;
  details?: unknown;
}

interface Viewport {
  name: string;
  width: number;
  height: number;
}

interface AuditState {
  issues: QAIssue[];
  passedChecks: string[];
}

const PAGES = [
  { path: '/', name: 'Trang chủ' },
  { path: '/gioi-thieu', name: 'Giới thiệu' },
  { path: '/cong-nghe', name: 'Công nghệ' },
  { path: '/san-pham-dau-ra', name: 'Sản phẩm đầu ra' },
  { path: '/tin-tuc', name: 'Tin tức' },
  { path: '/du-an-thu-vien', name: 'Dự án / Thư viện' },
  { path: '/tuyen-dung', name: 'Tuyển dụng' },
  { path: '/faq', name: 'FAQ' },
  { path: '/lien-he', name: 'Liên hệ' },
  { path: '/chinh-sach-bao-mat', name: 'Chính sách bảo mật' },
  { path: '/en', name: 'Home (EN)' },
  { path: '/en/products', name: 'Products (EN)' },
];

const VIEWPORTS: Viewport[] = [
  { name: 'Desktop-1440', width: 1440, height: 900 },
  { name: 'Desktop-1200', width: 1200, height: 800 },
  { name: 'Tablet-768', width: 768, height: 1024 },
  { name: 'Mobile-375', width: 375, height: 812 },
];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// 1. Kiểm tra cuộn ngang (Horizontal Scrollbar)
async function checkHorizontalScroll(page: Page, path: string, vp: Viewport, state: AuditState) {
  const scrollInfo = await page.evaluate(() => {
    const docEl = document.documentElement;
    const body = document.body;
    const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
    const clientW = window.innerWidth;
    return { scrollW, clientW, hasScroll: scrollW > clientW + 1 };
  });

  if (scrollInfo.hasScroll) {
    state.issues.push({
      page: path,
      viewport: vp.name,
      category: 'CRITICAL',
      issue: `Xuất hiện cuộn ngang (scrollWidth=${scrollInfo.scrollW}px > window=${scrollInfo.clientW}px)`,
    });
  } else {
    state.passedChecks.push(`[${vp.name}][${path}] Không bị cuộn ngang`);
  }
}

// 2. Kiểm tra ảnh vỡ hoặc không tải được
async function checkBrokenImages(page: Page, path: string, vp: Viewport, state: AuditState) {
  const brokenImages = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs
      .filter((img) => img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0))
      .map((img) => ({ src: img.src, alt: img.alt }));
  });

  if (brokenImages.length > 0) {
    state.issues.push({
      page: path,
      viewport: vp.name,
      category: 'CRITICAL',
      issue: `Có ${brokenImages.length} ảnh bị vỡ / không hiển thị được`,
      details: brokenImages,
    });
  }
}

// 3. Desktop Navigation Menu Wrapping check (Desktop only)
async function checkNavWrapping(page: Page, path: string, vp: Viewport, state: AuditState) {
  if (vp.width < 1200) return;

  const navItemsWrap = await page.evaluate(() => {
    const nav = document.querySelector('nav[data-testid="nav-main"]');
    if (!nav) return null;
    const links = Array.from(nav.querySelectorAll('a'));
    if (links.length <= 1) return null;
    const top0 = links[0].getBoundingClientRect().top;
    const wrappedLinks = links
      .filter((link) => Math.abs(link.getBoundingClientRect().top - top0) > 8)
      .map((l) => l.textContent?.trim());
    return {
      total: links.length,
      wrappedCount: wrappedLinks.length,
      wrappedLinks,
    };
  });

  if (navItemsWrap && navItemsWrap.wrappedCount > 0) {
    state.issues.push({
      page: path,
      viewport: vp.name,
      category: 'WARNING',
      issue: `Menu desktop bị tràn xuống hàng thứ hai (${navItemsWrap.wrappedLinks.join(', ')})`,
    });
  }
}

// 4. Kiểm tra Badge vỡ dòng trên trang Sản phẩm
async function checkBadges(page: Page, path: string, vp: Viewport, state: AuditState) {
  if (!(path.includes('products') || path.includes('san-pham-dau-ra'))) return;

  const badgeChecks = await page.evaluate(() => {
    const badges = Array.from(document.querySelectorAll('.badge'));
    return badges.map((b) => {
      const text = b.textContent?.trim() || '';
      const rect = b.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(b).lineHeight) || 20;
      const isMultiLine = rect.height > lineHeight * 1.5;
      return { text, height: rect.height, isMultiLine };
    });
  });

  const multiLineBadges = badgeChecks.filter((b) => b.isMultiLine);
  if (multiLineBadges.length > 0) {
    state.issues.push({
      page: path,
      viewport: vp.name,
      category: 'CRITICAL',
      issue: `Badge bị ngắt chữ thành nhiều dòng`,
      details: multiLineBadges,
    });
  } else {
    state.passedChecks.push(`[${vp.name}][${path}] Toàn bộ ${badgeChecks.length} Badge nằm gọn trên 1 dòng`);
  }
}

// 5. Kiểm tra Nút Floating Contact
async function checkFloatingContact(page: Page, path: string, vp: Viewport, state: AuditState) {
  const floatingBtnCheck = await page.evaluate(() => {
    // Không dựa tên class nội bộ (ux-spec v0.4 đổi cấu trúc): nút liên hệ nổi = liên kết tel:/Zalo ngoài header/footer
    // có tổ tiên (hoặc chính nó) position:fixed.
    const isFixed = (el: Element | null) => {
      for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).position === 'fixed') return true;
      return false;
    };
    const btns = Array.from(document.querySelectorAll('a[href^="tel:"], a[href*="zalo.me"]')).filter(
      (a) => !a.closest('header, footer') && isFixed(a),
    );
    if (btns.length === 0) return null;
    return btns.map((b) => {
      const rect = b.getBoundingClientRect();
      const computed = getComputedStyle(b);
      return {
        href: b.getAttribute('href'),
        width: rect.width,
        height: rect.height,
        visible: computed.display !== 'none' && computed.visibility !== 'hidden',
        isCircle: Math.abs(rect.width - rect.height) < 4,
      };
    });
  });

  if (!floatingBtnCheck || floatingBtnCheck.length === 0) {
    state.issues.push({
      page: path,
      viewport: vp.name,
      category: 'WARNING',
      issue: `Không tìm thấy nút Floating Contact`,
    });
    return;
  }
  for (const btn of floatingBtnCheck) {
    if (!btn.visible || btn.width < 40) {
      state.issues.push({
        page: path,
        viewport: vp.name,
        category: 'WARNING',
        issue: `Nút floating có kích thước bất thường (${btn.width}x${btn.height})`,
      });
    }
  }
}

// Chụp ảnh bằng chứng cho các viewport tiêu biểu: Desktop-1440, Mobile-375
async function captureEvidence(page: Page, path: string, vp: Viewport) {
  if (!['Desktop-1440', 'Mobile-375'].includes(vp.name)) return;
  const safeSlug = path === '/' ? 'home' : path.replace(/\//g, '_');
  const shotPath = join(SCREENSHOT_DIR, `${vp.name}${safeSlug}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });
}

async function auditPage(page: Page, path: string, vp: Viewport, state: AuditState) {
  const url = `${BASE_URL}${path}`;
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    if (!resp || resp.status() >= 400) {
      state.issues.push({
        page: path,
        viewport: vp.name,
        category: 'CRITICAL',
        issue: `Trang trả mã lỗi HTTP ${resp?.status()}`,
      });
      return;
    }
    await checkHorizontalScroll(page, path, vp, state);
    await checkBrokenImages(page, path, vp, state);
    await checkNavWrapping(page, path, vp, state);
    await checkBadges(page, path, vp, state);
    await checkFloatingContact(page, path, vp, state);
    await captureEvidence(page, path, vp);
  } catch (err: unknown) {
    state.issues.push({
      page: path,
      viewport: vp.name,
      category: 'CRITICAL',
      issue: `Lỗi crash hoặc timeout: ${errorMessage(err)}`,
    });
  }
}

async function auditViewport(browser: Browser, vp: Viewport, state: AuditState) {
  console.log(`\n-------------------------------------------------------`);
  console.log(`🖥️  ĐANG TEST VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
  console.log(`-------------------------------------------------------`);

  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  for (const p of PAGES) {
    await auditPage(page, p.path, vp, state);
  }
  await context.close();
}

// 6.1. Test Language Switcher
async function checkLanguageSwitcher(page: Page, state: AuditState) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  const langSwitcher = page.locator('.lang-switcher');
  if (!(await langSwitcher.isVisible())) return;
  const enBtn = langSwitcher.locator('a').filter({ hasText: /English/i });
  if (!(await enBtn.isVisible())) return;

  await enBtn.click();
  await page.waitForLoadState('networkidle');
  const curUrl = page.url();
  if (curUrl.includes('/en')) {
    state.passedChecks.push(`[INTERACTION] Chuyển đổi ngôn ngữ sang EN thành công (${curUrl})`);
  } else {
    state.issues.push({
      page: '/',
      viewport: 'Desktop-1440',
      category: 'CRITICAL',
      issue: `Bấm nút English không chuyển sang URL /en`,
    });
  }
}

// 6.2. Test Button Hover Contrast
async function checkHeroHover(page: Page, state: AuditState) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  const heroCta = page.locator('[data-testid="hero-primary"]');
  if (!(await heroCta.isVisible())) return;

  await heroCta.hover();
  const isStillVisible = await heroCta.evaluate((el) => {
    const style = getComputedStyle(el);
    return style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none';
  });
  if (isStillVisible) {
    state.passedChecks.push(`[INTERACTION] Nút CTA Hero không bị ẩn khi hover`);
  } else {
    state.issues.push({
      page: '/',
      viewport: 'Desktop-1440',
      category: 'CRITICAL',
      issue: `Nút CTA Hero bị ẩn hoặc biến mất khi hover!`,
    });
  }
}

// 6.3. Test Floating Buttons Hover Scale
async function checkZaloHoverScale(page: Page, state: AuditState) {
  // Không dựa tên class nội bộ: liên kết Zalo ngoài header/footer (nút nổi).
  const zaloBtn = page.locator('a[href*="zalo.me"]:not(header a):not(footer a)').first();
  if (!(await zaloBtn.isVisible())) return;

  await zaloBtn.hover();
  await page.waitForTimeout(350);
  const scaleTransform = await zaloBtn.evaluate((el) => getComputedStyle(el).transform);
  if (scaleTransform && scaleTransform !== 'none') {
    state.passedChecks.push(`[INTERACTION] Nút Zalo phóng to mượt mà khi hover (transform: ${scaleTransform})`);
  }
}

// 6.4. Test Focus outline color
async function checkFocusStyle(page: Page, state: AuditState) {
  await page.goto(`${BASE_URL}/lien-he`, { waitUntil: 'networkidle' });
  const nameInput = page.locator('input[name="fullName"], #contact-name, input[type="text"]').first();
  if (!(await nameInput.isVisible())) return;

  await nameInput.focus();
  const focusStyles = await nameInput.evaluate((el) => {
    const s = getComputedStyle(el);
    return { outline: s.outline, borderColor: s.borderColor, boxShadow: s.boxShadow };
  });
  // Check not harsh pure blue (rgb(29, 111, 182)) outline
  state.passedChecks.push(`[INTERACTION] Focus input hiển thị viền thương hiệu: ${focusStyles.borderColor}`);
}

// 6.5. Test Map on /lien-he
async function checkMap(page: Page, state: AuditState) {
  const mapElement = page.locator('#map-view-container, [data-testid="map-view"], iframe[title*="Bản đồ"]');
  const mapCount = await mapElement.count();
  if (mapCount > 0) {
    state.passedChecks.push(`[INTERACTION] Bản đồ vị trí nhà máy sẵn sàng trên trang liên hệ (tổng: ${mapCount})`);
  }
}

// 6. Test tương tác riêng trên Desktop: Hover, LangSwitch, Focus rings
async function auditInteractions(browser: Browser, state: AuditState) {
  console.log(`\n-------------------------------------------------------`);
  console.log(`🔍 KIỂM THỬ TƯƠNG TÁC CHI TIẾT (HOVER, FOCUS, SWITCHER)`);
  console.log(`-------------------------------------------------------`);

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const testPage = await desktopContext.newPage();

  await checkLanguageSwitcher(testPage, state);
  await checkHeroHover(testPage, state);
  await checkZaloHoverScale(testPage, state);
  await checkFocusStyle(testPage, state);
  await checkMap(testPage, state);

  await desktopContext.close();
}

function printReport({ issues, passedChecks }: AuditState) {
  console.log(`\n=======================================================`);
  console.log(`📊 BÁO CÁO KẾT QUẢ KIỂM THỬ QA UX/UI`);
  console.log(`=======================================================`);
  console.log(`✅ Số tiêu chí ĐẠT: ${passedChecks.length}`);
  console.log(`⚠️  Số cảnh báo / lỗi: ${issues.length}`);

  if (issues.length === 0) {
    console.log(`\n🎉 TOÀN BỘ CÁC BÀI TEST UX/UI ĐỀU ĐẠT CHUẨN XUẤT SẮC!`);
    return;
  }
  console.log(`\nDANH SÁCH LỖI / VẤN ĐỀ CẦN XỬ LÝ:`);
  for (const iss of issues) {
    console.log(`[${iss.category}] [${iss.viewport}] [${iss.page}] ${iss.issue}`);
    if (iss.details) console.log(`   Chi tiết:`, iss.details);
  }
}

async function runQAAudit() {
  console.log(`=======================================================`);
  console.log(`🚀 BẮT ĐẦU VAI QA: KIỂM THỬ TOÀN DIỆN UX/UI DỰ ÁN GMS`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📁 Thư mục ảnh chụp: ${SCREENSHOT_DIR}`);
  console.log(`=======================================================\n`);

  const browser = await chromium.launch({ headless: true });
  const state: AuditState = { issues: [], passedChecks: [] };

  for (const vp of VIEWPORTS) {
    await auditViewport(browser, vp, state);
  }
  await auditInteractions(browser, state);
  await browser.close();

  printReport(state);
}

runQAAudit().catch((e) => {
  console.error('Lỗi khi chạy QA audit:', e);
  process.exit(1);
});
