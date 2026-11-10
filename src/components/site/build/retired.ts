// Kiểm trang đã gỡ (CO-01, 10/11/2026: Giải pháp gộp vào Công nghệ). Nguồn luật: contracts/routes.ts
// (RETIRED_PAGE_REDIRECTS, RETIRED_PATH_PATTERN, RETIRED_RESERVED_SEGMENTS, RETIRED_PAGE_ERROR); design.md §6e.
// Hàm thuần theo thư mục out/ hoặc nội dung đã nạp; verify.ts/build-site.ts gọi, retired.test.ts kiểm từng mã.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RETIRED_PAGE_ERROR,
  RETIRED_PAGE_REDIRECTS,
  RETIRED_PATH_PATTERN,
  RETIRED_RESERVED_SEGMENTS,
  ROUTES,
  retiredRedirectLine,
} from '../../../../contracts/routes.ts';
import type { LoadedSiteContent, Locale } from '../../../content/loader.ts';

const TEXT_FILE = /\.(html|xml|txt|js|mjs|css|json|map|webmanifest)$|(^|\/)_headers$/i;

function listFiles(dir: string, base = ''): string[] {
  const found: string[] = [];
  for (const e of readdirSync(join(dir, base), { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) found.push(...listFiles(dir, rel));
    else found.push(rel);
  }
  return found;
}

// Tệp HTML phục vụ đường `path` của trang tĩnh (X.html hoặc X/index.html; "/" ⇒ index.html).
function pageFile(outDir: string, path: string): string | null {
  const candidates = path === '/' ? ['index.html'] : [`${path.slice(1)}.html`, `${path.slice(1)}/index.html`];
  for (const c of candidates) if (existsSync(join(outDir, c))) return join(outDir, c);
  return null;
}

/** RETIRED_REDIRECT_MISSING: out/_redirects thiếu dòng đúng chữ, hoặc có dòng khác cùng nguồn. */
export function retiredRedirectErrors(outDir: string): string[] {
  const file = join(outDir, '_redirects');
  const lines = existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l !== '' && !l.startsWith('#'))
    : [];
  const errors: string[] = [];
  for (const r of RETIRED_PAGE_REDIRECTS) {
    const want = retiredRedirectLine(r);
    if (!lines.includes(want)) {
      errors.push(`[${RETIRED_PAGE_ERROR.redirectMissing}] _redirects thiếu dòng "${want}"`);
    }
    for (const l of lines) {
      if (l !== want && l.split(/\s+/)[0] === r.from) {
        errors.push(`[${RETIRED_PAGE_ERROR.redirectMissing}] _redirects có dòng khác cho "${r.from}": "${l}"`);
      }
    }
  }
  return errors;
}

/** RETIRED_ANCHOR_MISSING: trang đích thiếu (hoặc lặp) id của neo, hoặc `<html lang>` sai. */
export function retiredAnchorErrors(outDir: string): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const r of RETIRED_PAGE_REDIRECTS) {
    const target = ROUTES[r.toPage][r.locale];
    const key = `${target}#${r.anchor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const file = pageFile(outDir, target);
    if (!file) {
      errors.push(`[${RETIRED_PAGE_ERROR.anchorMissing}] không có tệp HTML cho ${target}`);
      continue;
    }
    const html = readFileSync(file, 'utf8');
    const count = (html.match(new RegExp(`\\sid="${r.anchor}"(?=[\\s>/])`, 'g')) ?? []).length;
    if (count !== 1) {
      errors.push(`[${RETIRED_PAGE_ERROR.anchorMissing}] ${target}: cần đúng 1 phần tử id="${r.anchor}", có ${count}`);
    }
    const lang = html.match(/<html[^>]*\slang="([^"]*)"/i)?.[1] ?? null;
    if (lang !== r.locale) {
      errors.push(`[${RETIRED_PAGE_ERROR.anchorMissing}] ${target}: lang=${lang}, cần ${r.locale}`);
    }
  }
  return errors;
}

/** RETIRED_PATH_IN_OUTPUT: đường cũ còn trong nội dung/tên tệp dưới out/ (trừ _redirects) hoặc có tệp phục vụ đường cũ. */
export function retiredPathErrors(outDir: string): string[] {
  const errors: string[] = [];
  for (const r of RETIRED_PAGE_REDIRECTS) {
    const bare = r.from.replace(/\/$/, '').slice(1);
    for (const c of [`${bare}.html`, `${bare}/index.html`]) {
      if (existsSync(join(outDir, c))) {
        errors.push(`[${RETIRED_PAGE_ERROR.pathInOutput}] tệp phục vụ đường đã gỡ: ${c}`);
      }
    }
  }
  for (const rel of listFiles(outDir)) {
    if (rel === '_redirects') continue;
    if (RETIRED_PATH_PATTERN.test(`/${rel}`)) {
      errors.push(`[${RETIRED_PAGE_ERROR.pathInOutput}] tên tệp chứa đường đã gỡ: ${rel}`);
    }
    if (!TEXT_FILE.test(rel)) continue;
    const m = readFileSync(join(outDir, rel), 'utf8').match(RETIRED_PATH_PATTERN);
    if (m) errors.push(`[${RETIRED_PAGE_ERROR.pathInOutput}] ${rel}: còn "${m[0]}"`);
  }
  return errors;
}

/** RETIRED_SLUG_RESERVED: slug Tin / Dự án / Tuyển dụng trùng đoạn đường dẫn bị cấm. */
export function retiredSlugErrors(
  loaded: Pick<LoadedSiteContent, 'news' | 'projects' | 'jobs'>,
  locales: Locale[] = ['vi', 'en'],
): string[] {
  const errors: string[] = [];
  for (const locale of locales) {
    const reserved = RETIRED_RESERVED_SEGMENTS[locale];
    const groups: [string, { slug: string }[]][] = [
      ['news', loaded.news[locale]],
      ['projects', loaded.projects[locale]],
      ['jobs', loaded.jobs[locale]],
    ];
    for (const [name, items] of groups) {
      for (const it of items) {
        if (reserved.includes(it.slug)) {
          errors.push(`[${RETIRED_PAGE_ERROR.slugReserved}] ${name}/${locale}: slug "${it.slug}" bị cấm`);
        }
      }
    }
  }
  return errors;
}

/** Ba kiểm trên out/ (chạy sau khi dựng X/index.html). */
export function retiredOutputErrors(outDir: string): string[] {
  return [...retiredRedirectErrors(outDir), ...retiredAnchorErrors(outDir), ...retiredPathErrors(outDir)];
}
