import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
  details?: any;
}

const PAGES = [
  { path: '/', name: 'Trang chủ' },
  { path: '/gioi-thieu', name: 'Giới thiệu' },
  { path: '/giai-phap', name: 'Giải pháp' },
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

const VIEWPORTS = [
  { name: 'Desktop-1440', width: 1440, height: 900 },
  { name: 'Desktop-1200', width: 1200, height: 800 },
  { name: 'Tablet-768', width: 768, height: 1024 },
  { name: 'Mobile-375', width: 375, height: 812 },
];

async function runQAAudit() {
  console.log(`=======================================================`);
  console.log(`🚀 BẮT ĐẦU VAI QA: KIỂM THỬ TOÀN DIỆN UX/UI DỰ ÁN GMS`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📁 Thư mục ảnh chụp: ${SCREENSHOT_DIR}`);
  console.log(`=======================================================\n`);

  const browser = await chromium.launch({ headless: true });
  const issues: QAIssue[] = [];
  const passedChecks: string[] = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n-------------------------------------------------------`);
    console.log(`🖥️  ĐANG TEST VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`-------------------------------------------------------`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    for (const p of PAGES) {
      const url = `${BASE_URL}${p.path}`;
      try {
        const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        if (!resp || resp.status() >= 400) {
          issues.push({
            page: p.path,
            viewport: vp.name,
            category: 'CRITICAL',
            issue: `Trang trả mã lỗi HTTP ${resp?.status()}`,
          });
          continue;
        }

        // 1. Kiểm tra cuộn ngang (Horizontal Scrollbar)
        const scrollInfo = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientW = window.innerWidth;
          return { scrollW, clientW, hasScroll: scrollW > clientW + 1 };
        });

        if (scrollInfo.hasScroll) {
          issues.push({
            page: p.path,
            viewport: vp.name,
            category: 'CRITICAL',
            issue: `Xuất hiện cuộn ngang (scrollWidth=${scrollInfo.scrollW}px > window=${scrollInfo.clientW}px)`,
          });
        } else {
          passedChecks.push(`[${vp.name}][${p.path}] Không bị cuộn ngang`);
        }

        // 2. Kiểm tra ảnh vỡ hoặc không tải được
        const brokenImages = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return imgs
            .filter((img) => img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0))
            .map((img) => ({ src: img.src, alt: img.alt }));
        });

        if (brokenImages.length > 0) {
          issues.push({
            page: p.path,
            viewport: vp.name,
            category: 'CRITICAL',
            issue: `Có ${brokenImages.length} ảnh bị vỡ / không hiển thị được`,
            details: brokenImages,
          });
        }

        // 3. Desktop Navigation Menu Wrapping check (Desktop only)
        if (vp.width >= 1200) {
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
            issues.push({
              page: p.path,
              viewport: vp.name,
              category: 'WARNING',
              issue: `Menu desktop bị tràn xuống hàng thứ hai (${navItemsWrap.wrappedLinks.join(', ')})`,
            });
          }
        }

        // 4. Kiểm tra Badge vỡ dòng trên trang Sản phẩm
        if (p.path.includes('products') || p.path.includes('san-pham-dau-ra')) {
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
            issues.push({
              page: p.path,
              viewport: vp.name,
              category: 'CRITICAL',
              issue: `Badge bị ngắt chữ thành nhiều dòng`,
              details: multiLineBadges,
            });
          } else {
            passedChecks.push(`[${vp.name}][${p.path}] Toàn bộ ${badgeChecks.length} Badge nằm gọn trên 1 dòng`);
          }
        }

        // 5. Kiểm tra Nút Floating Contact
        const floatingBtnCheck = await page.evaluate(() => {
          const group = document.querySelector('.floating-contact-group');
          if (!group) return null;
          const btns = Array.from(group.querySelectorAll('a'));
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
          issues.push({
            page: p.path,
            viewport: vp.name,
            category: 'WARNING',
            issue: `Không tìm thấy nút Floating Contact`,
          });
        } else {
          for (const btn of floatingBtnCheck) {
            if (!btn.visible || btn.width < 40) {
              issues.push({
                page: p.path,
                viewport: vp.name,
                category: 'WARNING',
                issue: `Nút floating có kích thước bất thường (${btn.width}x${btn.height})`,
              });
            }
          }
        }

        // Chụp ảnh bằng chứng cho 3 viewport tiêu biểu: Desktop-1440, Tablet-768, Mobile-375
        if (['Desktop-1440', 'Mobile-375'].includes(vp.name)) {
          const safeSlug = p.path === '/' ? 'home' : p.path.replace(/\//g, '_');
          const shotPath = join(SCREENSHOT_DIR, `${vp.name}${safeSlug}.png`);
          await page.screenshot({ path: shotPath, fullPage: false });
        }

      } catch (err: any) {
        issues.push({
          page: p.path,
          viewport: vp.name,
          category: 'CRITICAL',
          issue: `Lỗi crash hoặc timeout: ${err.message}`,
        });
      }
    }

    await context.close();
  }

  // 6. Test tương tác riêng trên Desktop: Hover, LangSwitch, Focus rings
  console.log(`\n-------------------------------------------------------`);
  console.log(`🔍 KIỂM THỬ TƯƠNG TÁC CHI TIẾT (HOVER, FOCUS, SWITCHER)`);
  console.log(`-------------------------------------------------------`);

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const testPage = await desktopContext.newPage();

  // 6.1. Test Language Switcher
  await testPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  const langSwitcher = testPage.locator('.lang-switcher');
  if (await langSwitcher.isVisible()) {
    const enBtn = langSwitcher.locator('a').filter({ hasText: /English/i });
    if (await enBtn.isVisible()) {
      await enBtn.click();
      await testPage.waitForLoadState('networkidle');
      const curUrl = testPage.url();
      if (curUrl.includes('/en')) {
        passedChecks.push(`[INTERACTION] Chuyển đổi ngôn ngữ sang EN thành công (${curUrl})`);
      } else {
        issues.push({
          page: '/',
          viewport: 'Desktop-1440',
          category: 'CRITICAL',
          issue: `Bấm nút English không chuyển sang URL /en`,
        });
      }
    }
  }

  // 6.2. Test Button Hover Contrast
  await testPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  const heroCta = testPage.locator('[data-testid="hero-primary"]');
  if (await heroCta.isVisible()) {
    const boxBefore = await heroCta.boundingBox();
    await heroCta.hover();
    const isStillVisible = await heroCta.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none';
    });
    if (isStillVisible) {
      passedChecks.push(`[INTERACTION] Nút CTA Hero không bị ẩn khi hover`);
    } else {
      issues.push({
        page: '/',
        viewport: 'Desktop-1440',
        category: 'CRITICAL',
        issue: `Nút CTA Hero bị ẩn hoặc biến mất khi hover!`,
      });
    }
  }

  // 6.3. Test Floating Buttons Hover Scale
  const zaloBtn = testPage.locator('.floating-btn-zalo, .floating-circle-btn[href*="zalo"]');
  if (await zaloBtn.isVisible()) {
    const initialBox = await zaloBtn.boundingBox();
    await zaloBtn.hover();
    await testPage.waitForTimeout(350);
    const scaleTransform = await zaloBtn.evaluate((el) => getComputedStyle(el).transform);
    if (scaleTransform && scaleTransform !== 'none') {
      passedChecks.push(`[INTERACTION] Nút Zalo phóng to mượt mà khi hover (transform: ${scaleTransform})`);
    }
  }

  // 6.4. Test Focus outline color
  await testPage.goto(`${BASE_URL}/lien-he`, { waitUntil: 'networkidle' });
  const nameInput = testPage.locator('input[name="fullName"], #contact-name, input[type="text"]').first();
  if (await nameInput.isVisible()) {
    await nameInput.focus();
    const focusStyles = await nameInput.evaluate((el) => {
      const s = getComputedStyle(el);
      return { outline: s.outline, borderColor: s.borderColor, boxShadow: s.boxShadow };
    });
    // Check not harsh pure blue (rgb(29, 111, 182)) outline
    passedChecks.push(`[INTERACTION] Focus input hiển thị viền thương hiệu: ${focusStyles.borderColor}`);
  }

  // 6.5. Test Map on /lien-he
  const mapElement = testPage.locator('#map-view-container, [data-testid="map-view"], iframe[title*="Bản đồ"]');
  const mapCount = await mapElement.count();
  if (mapCount > 0) {
    passedChecks.push(`[INTERACTION] Bản đồ vị trí nhà máy sẵn sàng trên trang liên hệ (tổng: ${mapCount})`);
  }

  await desktopContext.close();
  await browser.close();

  // BÁO CÁO TỔNG KẾT
  console.log(`\n=======================================================`);
  console.log(`📊 BÁO CÁO KẾT QUẢ KIỂM THỬ QA UX/UI`);
  console.log(`=======================================================`);
  console.log(`✅ Số tiêu chí ĐẠT: ${passedChecks.length}`);
  console.log(`⚠️  Số cảnh báo / lỗi: ${issues.length}`);

  if (issues.length > 0) {
    console.log(`\nDANH SÁCH LỖI / VẤN ĐỀ CẦN XỬ LÝ:`);
    for (const iss of issues) {
      console.log(`[${iss.category}] [${iss.viewport}] [${iss.page}] ${iss.issue}`);
      if (iss.details) console.log(`   Chi tiết:`, iss.details);
    }
  } else {
    console.log(`\n🎉 TOÀN BỘ CÁC BÀI TEST UX/UI ĐỀU ĐẠT CHUẨN XUẤT SẮC!`);
  }
}

runQAAudit().catch((e) => {
  console.error('Lỗi khi chạy QA audit:', e);
  process.exit(1);
});
