// Danh sách trang đo + bộ tổng hợp báo cáo hiệu suất (performance-and-accessibility.feature, Bối cảnh).
// Bộ tổng hợp là CÔNG CỤ CỦA QA nên có test riêng (PERF-04) — không để verifier tin một công cụ chưa được thử.
// v0.3: site tĩnh, không còn dựng dữ liệu qua cổng điều khiển. "Dữ liệu đo" (prd.md §6) là thư mục nội dung mẫu SITE_FIXTURE của
// bản build đang chạy (XQ-21): có ≥ 1 Tin, 1 Mục Dự án/Thư viện (24 ảnh), 1 Tin tuyển dụng, đầu ra có tên dài nhất, điểm bản đồ + Zalo.
import { detailPath, type Locale, PAGE_KEYS, PAGE_LABEL_VI, path } from './routes';

export interface Target {
  label: string;
  locale: Locale;
  url: string;
}

// Slug của các mục mẫu trong bản build đo (đề xuất của qa, XQ-21): mỗi mục có slug riêng theo locale.
export const MEASURE_SLUGS = {
  news: { vi: 'tin-do', en: 'measured-news' },
  projects: { vi: 'muc-do', en: 'measured-item' },
  careers: { vi: 'ky-thuat-vien', en: 'technician' },
} as const;
export const NOT_FOUND_SAMPLE: Record<Locale, string> = {
  vi: '/khong-co-trang-nay-xyz',
  en: '/en/this-page-does-not-exist-xyz',
};

export const NOT_FOUND_LABEL = '404';

/** 10 trang cố định + 3 trang chi tiết + 404, mỗi trang ở vi và en = 28 dòng (prd v0.8). */
export function listTargets(): Target[] {
  const out: Target[] = [];
  for (const l of ['vi', 'en'] as Locale[]) {
    for (const k of PAGE_KEYS) out.push({ label: PAGE_LABEL_VI[k], locale: l, url: path(k, l) });
    out.push({ label: 'Chi tiết Tin', locale: l, url: detailPath('news', MEASURE_SLUGS.news[l], l) });
    out.push({ label: 'Chi tiết Mục Thư viện', locale: l, url: detailPath('projects', MEASURE_SLUGS.projects[l], l) });
    out.push({ label: 'Chi tiết Tuyển dụng', locale: l, url: detailPath('careers', MEASURE_SLUGS.careers[l], l) });
    out.push({ label: NOT_FOUND_LABEL, locale: l, url: NOT_FOUND_SAMPLE[l] });
  }
  return out;
}

export const THRESHOLD = {
  performance: 95,
  accessibility: 95,
  'best-practices': 95,
  seo: 95,
  lcpMs: 2500,
  cls: 0.05,
  tbtMs: 200,
} as const;
export const JS_BUDGET_GZIP_BYTES = 100 * 1024;

export interface Run {
  performance: number;
  accessibility: number;
  'best-practices': number;
  seo: number;
  lcpMs: number;
  cls: number;
  tbtMs: number;
}
export interface Row {
  page: string;
  locale: Locale;
  metric: string;
  median: number;
  limit: string;
  verdict: 'Đạt' | 'Không đạt' | 'Không xét';
}
export interface Report {
  rows: Row[];
  verdict: 'Đạt' | 'Không đạt';
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Tổng hợp: mỗi (trang, locale, chỉ số) là một dòng; MỘT dòng "Không đạt" ⇒ kết luận chung "Không đạt".
 * Spec v0.5.3: trang 404 không xét SEO ⇒ dòng SEO của 404 vẫn có trong báo cáo, ghi "Không xét", không tính vào kết luận.
 */
export function aggregate(results: Array<{ page: string; locale: Locale; runs: Run[] }>): Report {
  const rows: Row[] = [];
  for (const r of results) {
    const m = (k: keyof Run) => median(r.runs.map((x) => x[k]));
    const score = (k: 'performance' | 'accessibility' | 'best-practices' | 'seo', name: string) => {
      const v = m(k);
      const skipped = k === 'seo' && r.page === NOT_FOUND_LABEL;
      rows.push({
        page: r.page,
        locale: r.locale,
        metric: name,
        median: v,
        limit: skipped ? 'không xét (404, spec v0.5.3)' : `>= ${THRESHOLD[k]}`,
        verdict: skipped ? 'Không xét' : v >= THRESHOLD[k] ? 'Đạt' : 'Không đạt',
      });
    };
    score('performance', 'Performance');
    score('accessibility', 'Accessibility');
    score('best-practices', 'Best Practices');
    score('seo', 'SEO');
    const lcp = m('lcpMs');
    rows.push({
      page: r.page,
      locale: r.locale,
      metric: 'LCP',
      median: lcp,
      limit: '< 2500',
      verdict: lcp < THRESHOLD.lcpMs ? 'Đạt' : 'Không đạt',
    });
    const cls = m('cls');
    rows.push({
      page: r.page,
      locale: r.locale,
      metric: 'CLS',
      median: cls,
      limit: '< 0.05',
      verdict: cls < THRESHOLD.cls ? 'Đạt' : 'Không đạt',
    });
    const tbt = m('tbtMs');
    rows.push({
      page: r.page,
      locale: r.locale,
      metric: 'TBT',
      median: tbt,
      limit: '< 200',
      verdict: tbt < THRESHOLD.tbtMs ? 'Đạt' : 'Không đạt',
    });
  }
  return { rows, verdict: rows.some((x) => x.verdict === 'Không đạt') ? 'Không đạt' : 'Đạt' };
}
