// cross-journeys.feature → X-01..X-03 (S19 S20 S25 / S12 S13 S2 S32 / S7 S17 S33). v0.3: không CMS; hành trình bằng nội dung nguồn + build.
// X-02, X-03 là @kiem-luc-build: chạy bản build thật với thư mục nội dung giả (XQ-21). X-03 cần bước "deploy production" (XQ-21).

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSite, type Files, htmlOf, newsFiles } from '../support/build';
import { control, pollUntil } from '../support/control';
import { DEPLOY_PRODUCTION_CMD } from '../support/env';
import { figure, figuresFile } from '../support/fixtures';
import { detailPath, path } from '../support/routes';
import { expect, test } from '../support/turnstile-stub';
import { bodyText, fillAndSubmit, open, tid, VALID } from '../support/ui';

const TO = 'lienhe@vi-du.test';
const T = '2026-03-01T01:30:00Z'; // 08:30 ngày 01/03/2026 giờ VN

test('X-01 Liên hệ từ trang Công nghệ (EN) tới hộp thư GMS, hôm sau web không còn giữ (@S19 @S20 @S25 @cho-khach:V3)', async ({
  page,
}) => {
  await control.reset();
  await control.recipient(TO);
  await control.policyVersion('1.0');
  await control.setNow(T);
  await open(page, 'technology', 'en');
  await tid(page, 'cta-contact').first().click(); // lời mời liên hệ
  await expect(page).toHaveURL(new RegExp(`${path('contact', 'en')}/?(\\?.*)?$`));
  await fillAndSubmit(page, { name: VALID.name, email: VALID.email, message: VALID.message, consent: true });
  await expect(tid(page, 'contact-success')).toBeVisible();
  const mails = await pollUntil(
    () => control.mailbox(TO),
    (m) => m.length >= 1,
    120_000,
  );
  expect(mails).toHaveLength(1);
  const b = mails[0].body;
  expect(b).toMatch(/Tiếng Việt|Người dùng bản|ngôn ngữ|locale/i); // thư viết bằng tiếng Việt dù người gửi ở EN
  for (const s of ['en', 'Công nghệ', '01/03/2026 08:30', '1.0', VALID.name, VALID.message]) expect(b, s).toContain(s);
  await control.runCron('2026-03-02T01:30:00Z'); // 08:30 ngày 02/03/2026
  const { text } = await control.storeDump();
  for (const s of [VALID.name, VALID.email, VALID.message]) expect(text, s).not.toContain(s);
  await control.setNow(null);
});

test('X-02 Tin từ nội dung nguồn tới gỡ: đổi ngôn ngữ giữa chừng, sitemap có rồi không còn (@S12 @S13 @S2 @S32 @kiem-luc-build)', () => {
  const news = newsFiles('hanh-trinh-08', {
    vi: { title: 'Hành trình 08', slug: 'hanh-trinh-08' },
    en: { title: 'Journey 08', slug: 'journey-08' },
  });
  const withNews = buildSite(news);
  expect(withNews.ok, withNews.log).toBe(true);
  const vi = htmlOf(withNews, detailPath('news', 'hanh-trinh-08', 'vi'));
  const en = htmlOf(withNews, detailPath('news', 'journey-08', 'en'));
  expect(vi, 'Tin bản vi').toContain('Hành trình 08');
  expect(en, 'Tin bản en').toContain('Journey 08');
  expect(vi).toMatch(new RegExp(`<a[^>]+hreflang="en"[^>]+href="[^"]*${detailPath('news', 'journey-08', 'en')}`));
  const sitemapOn = withNews.read('sitemap.xml') ?? '';
  expect(sitemapOn).toContain(detailPath('news', 'hanh-trinh-08', 'vi'));
  expect(sitemapOn).toContain(detailPath('news', 'journey-08', 'en'));

  const gone = buildSite({}); // bên làm web gỡ cả hai file Tin khỏi nội dung nguồn
  expect(gone.ok, gone.log).toBe(true);
  expect(htmlOf(gone, detailPath('news', 'hanh-trinh-08', 'vi'))).toBeNull();
  expect(htmlOf(gone, detailPath('news', 'journey-08', 'en'))).toBeNull();
  expect(gone.read('sitemap.xml') ?? '').not.toContain('hanh-trinh-08');
  expect(gone.read('sitemap.xml') ?? '').not.toContain('journey-08');
});

test('X-03 Có tuyên bố phải qua kiểm lúc build rồi văn bản xác nhận của GMS mới lên production (@S7 @S17 @S33 @kiem-luc-build)', () => {
  const files: Files = figuresFile([
    figure({
      key: 'dien-tich',
      value: '5',
      label: { vi: 'Diện tích nhà máy', en: 'Plant area' },
      unit: { vi: 'ha', en: 'ha' },
    }),
  ]);
  const built = buildSite(files, { SITE_ENV: 'production' });
  expect(built.ok, 'bản build xanh khi chưa có văn bản xác nhận (build ≠ deploy)').toBe(true);
  expect(DEPLOY_PRODUCTION_CMD, 'Chưa có lệnh deploy production (XQ-21)').not.toBe('');
  const deploy = (outDir: string) =>
    spawnSync(DEPLOY_PRODUCTION_CMD.split(' ')[0], [...DEPLOY_PRODUCTION_CMD.split(' ').slice(1), '--dry-run'], {
      cwd: `${outDir}/..`,
      encoding: 'utf8',
      env: { ...process.env, SITE_ENV: 'production' },
    });
  const blocked = deploy(built.outDir);
  expect(blocked.status).not.toBe(0);
  expect(`${blocked.stdout}\n${blocked.stderr}`).toContain('thiếu xác nhận văn bản của GMS cho phiên bản nội dung');
  // Ghi văn bản xác nhận cho ĐÚNG băm nội dung (tên tệp = băm do build in ra, XQ-21), rồi deploy lại.
  const hash = (built.log.match(/content-hash[:=]\s*([0-9a-f]{8,64})/i) ?? [])[1];
  expect(hash, 'build phải in băm phiên bản nội dung (content-hash) để ghi xác nhận').toBeTruthy();
  const dir = join(built.outDir, '..', 'content', 'approvals');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${hash}.yaml`),
    'approvedBy: "Người đại diện GMS (mẫu)"\napprovedAt: "2026-10-31"\nchannel: "văn bản mẫu"\n',
  );
  const ok = deploy(built.outDir);
  expect(ok.status, `${ok.stdout}\n${ok.stderr}`).toBe(0);
  const home = htmlOf(built, path('home', 'vi'))!;
  expect(home).toContain('Diện tích nhà máy');
  expect(home).toMatch(/5\s*ha/);
});

test('X-03b Trang chủ ở bản đang chạy hiện "5 ha" với nhãn "Diện tích nhà máy" (@S33)', async ({ page }) => {
  await open(page, 'home', 'vi');
  const t = await bodyText(page);
  expect(t).toContain('Diện tích nhà máy');
  expect(t).toMatch(/5\s*ha/);
});
