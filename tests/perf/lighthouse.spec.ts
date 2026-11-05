// performance-and-accessibility.feature → PERF-01..PERF-04 (S3). Đo trên bản build production, trung vị 3 lần Lighthouse mobile.
// Phụ thuộc cần cài (pha 2, devops/frontend): lighthouse, chrome-launcher. Điểm Lighthouse phụ thuộc máy ⇒ chạy ở môi trường cố định,
// ghi môi trường vào báo cáo; không so số giữa máy khác nhau.

import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { chromium, expect, test } from '@playwright/test';
import { BASE_URL } from '../support/env';
import { aggregate, JS_BUDGET_GZIP_BYTES, listTargets, median, type Run } from '../support/perf';

const RUNS = 3;
const modName = 'lighthouse'; // import động: pha 1 chưa có package, file vẫn biên dịch được
async function lighthouseRuns(url: string): Promise<Run[]> {
  const browser = await chromium.launch({ args: ['--remote-debugging-port=9333'] });
  try {
    const lh = (await import(modName)).default as (
      u: string,
      o: object,
    ) => Promise<{
      lhr: { categories: Record<string, { score: number }>; audits: Record<string, { numericValue: number }> };
    }>;
    const out: Run[] = [];
    for (let i = 0; i < RUNS; i++) {
      const { lhr } = await lh(BASE_URL + url, {
        port: 9333,
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 375, height: 667, deviceScaleFactor: 2, disabled: false },
        ignoreStatusCode: true,
      });
      out.push({
        performance: lhr.categories.performance.score * 100,
        accessibility: lhr.categories.accessibility.score * 100,
        'best-practices': lhr.categories['best-practices'].score * 100,
        seo: lhr.categories.seo.score * 100,
        lcpMs: lhr.audits['largest-contentful-paint'].numericValue,
        cls: lhr.audits['cumulative-layout-shift'].numericValue,
        tbtMs: lhr.audits['total-blocking-time'].numericValue,
      });
    }
    return out;
  } finally {
    await browser.close();
  }
}

test('PERF-01 Mỗi trang đạt ngưỡng Lighthouse mobile — 30 dòng (@S3)', async () => {
  const targets = listTargets();
  expect(targets).toHaveLength(30); // 15 trang x 2 locale (Bối cảnh)
  const results = [] as Array<{ page: string; locale: 'vi' | 'en'; runs: Run[] }>;
  for (const t of targets) results.push({ page: t.label, locale: t.locale, runs: await lighthouseRuns(t.url) });
  const report = aggregate(results);
  mkdirSync('.results', { recursive: true });
  writeFileSync('.results/lighthouse-report.json', JSON.stringify(report, null, 2));
  const failed = report.rows
    .filter((r) => r.verdict === 'Không đạt')
    .map((r) => `${r.page} / ${r.locale} / ${r.metric}: ${r.median} (cần ${r.limit})`);
  expect(failed, failed.join('\n')).toEqual([]);
});

async function gzipJsBytes(url: string): Promise<number> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const bodies: Promise<number>[] = [];
    page.on('response', (r) => {
      const type = r.headers()['content-type'] ?? '';
      if (/javascript|ecmascript/.test(type) || /\.m?js(\?|$)/.test(r.url()))
        bodies.push(
          r
            .body()
            .then((b) =>
              r.headers()['content-encoding'] === 'gzip'
                ? Number(r.headers()['content-length'] ?? gzipSync(b).length)
                : gzipSync(b).length,
            )
            .catch(() => 0),
        );
    });
    await page.goto(BASE_URL + url, { waitUntil: 'networkidle' });
    return (await Promise.all(bodies)).reduce((a, b) => a + b, 0);
  } finally {
    await browser.close();
  }
}

test('PERF-02 Ngân sách JS gzip mỗi trang, tính cả bên thứ ba (@S3)', async () => {
  const targets = listTargets();
  const over: string[] = [];
  for (const t of targets) {
    const n = await gzipJsBytes(t.url);
    if (n > JS_BUDGET_GZIP_BYTES) over.push(`${t.label}/${t.locale}: ${n} B`);
  }
  expect(over, over.join('\n')).toEqual([]);
});

test('PERF-03 Trang Liên hệ có bản đồ + chống spam vẫn trong ngưỡng (@S3)', async () => {
  // Bản build đo có điểm bản đồ + số Zalo trong Thông tin công ty (XQ-21).
  const runs = await lighthouseRuns('/en/contact');
  expect(median(runs.map((r) => r.performance))).toBeGreaterThanOrEqual(95);
  expect(median(runs.map((r) => r.tbtMs))).toBeLessThan(200);
  expect(await gzipJsBytes('/en/contact')).toBeLessThanOrEqual(JS_BUDGET_GZIP_BYTES);
});

test('PERF-04 Một trang vượt ngưỡng làm cả lần nghiệm thu "Không đạt" (@S3) — thử CHÍNH bộ tổng hợp', () => {
  const ok: Run = {
    performance: 99,
    accessibility: 99,
    'best-practices': 99,
    seo: 99,
    lcpMs: 1800,
    cls: 0.01,
    tbtMs: 50,
  };
  const bad: Run = { ...ok, lcpMs: 2700 };
  const rep = aggregate([
    { page: 'Trang chủ', locale: 'vi', runs: [ok, ok, ok] },
    { page: 'Chi tiết Tin', locale: 'en', runs: [bad, bad, bad] },
  ]);
  const row = rep.rows.find((r) => r.page === 'Chi tiết Tin' && r.locale === 'en' && r.metric === 'LCP');
  expect(row?.verdict).toBe('Không đạt');
  expect(rep.verdict).toBe('Không đạt');
  // đối chứng xanh: toàn bộ đạt ⇒ kết luận Đạt; một lần chạy xấu lẻ (trung vị vẫn tốt) không kéo đỏ
  expect(aggregate([{ page: 'A', locale: 'vi', runs: [ok, ok, ok] }]).verdict).toBe('Đạt');
  expect(aggregate([{ page: 'A', locale: 'vi', runs: [ok, bad, ok] }]).verdict).toBe('Đạt');
});
