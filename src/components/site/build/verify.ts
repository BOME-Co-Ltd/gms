// Bước hậu kỳ + kiểm sau `next build` (output: export ⇒ out/). Thay phần ghép HTML cũ của build-site.ts.
//  1. `<html lang>` của trang en (root layout Next dùng chung một lang; shortcut: sửa ở đây, nâng cấp khi tách root layout theo locale);
//  2. mỗi `X.html` có bản `X/index.html` (giữ cả hai dạng URL như out/ trước đây);
//  3. ảnh: dựng lại out/img từ content/images (bỏ EXIF, nén) + ảnh tĩnh public/img (PERF-01); og/default.png; form-status.json;
//  4. sitemap.xml/robots.txt/_headers suy từ HTML đã dựng (canonical + robots meta), không từ danh sách riêng;
//  5. kiểm: ảnh thiếu, hreflang/canonical, lang, sitemap, srcset, og, tên cấm (FORBIDDEN_NAME_IN_OUTPUT), denylist.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { LoadedSiteContent } from '../../../content/loader.ts';
import { loadDenylist, scanOutputForForbiddenNames } from '../../../content/rules/names.ts';
import { currentFormStatus, type SiteConfig } from './config.ts';
import {
  copyStaticImages,
  HERO_IMG_REL,
  optimizeStaticImages,
  processAndWriteImage,
  SOLUTION_IMG_FILES,
  STATIC_IMG_MAX_WIDTH,
  solutionImgMidName,
  solutionImgSmallName,
} from './images.ts';

// Tài sản tĩnh (public/) theo vị trí script, không theo cwd: bản build ở thư mục tạm/fixture vẫn có ảnh.
const PUBLIC_DIR = join(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'), 'public');

const escXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function listHtmlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) found.push(...listHtmlFiles(p));
    else if (e.name.endsWith('.html')) found.push(p);
  }
  return found;
}

/** `<img src="/...">` trỏ tới file không có trong outDir → "trang: /src". */
export function findBrokenImgRefs(outDir: string): string[] {
  const broken: string[] = [];
  for (const file of listHtmlFiles(outDir)) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/<img\b[^>]*?\ssrc="(\/[^"/][^"]*)"/g)) {
      const src = decodeURI(m[1].split(/[?#]/)[0]);
      if (!existsSync(join(outDir, src))) broken.push(`${file.slice(outDir.length)}: ${m[1]}`);
    }
  }
  return broken;
}

type PageInfo = { rel: string; html: string; canonical: string | null; noindex: boolean; lang: string | null };

function readPages(outDir: string): PageInfo[] {
  return listHtmlFiles(outDir)
    .filter((f) => !f.slice(outDir.length).startsWith('/_next/'))
    .sort()
    .map((f) => {
      const html = readFileSync(f, 'utf8');
      const canonical = html.match(/<link[^>]*\srel="canonical"[^>]*\shref="([^"]*)"/i)?.[1] ?? null;
      const robots = html.match(/<meta[^>]*\sname="robots"[^>]*\scontent="([^"]*)"/i)?.[1] ?? '';
      const lang = html.match(/<html[^>]*\slang="([^"]*)"/i)?.[1] ?? null;
      return { rel: f.slice(outDir.length), html, canonical, noindex: /noindex/i.test(robots), lang };
    });
}

/** sha256 (base64) của từng `<script>` inline chạy được (bỏ script có src và khối dữ liệu JSON-LD). */
export function inlineScriptHashes(html: string): string[] {
  const hashes = new Set<string>();
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\ssrc\s*=/i.test(attrs) || /\stype\s*=\s*"?application\/(ld\+)?json/i.test(attrs)) continue;
    if (m[2].trim() === '') continue;
    hashes.add(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
  }
  return [...hashes];
}

const CONTACT_PAGE = /^\/(lien-he|en\/contact)$/;

export function cspFor(urlPath: string, hashes: string[]): string {
  const turnstile = CONTACT_PAGE.test(urlPath.replace(/\/$/, ''));
  const cf = 'https://challenges.cloudflare.com';
  const frames = ['https://maps.google.com', 'https://www.google.com', ...(turnstile ? [cf] : [])];
  return [
    "default-src 'self'",
    ["script-src 'self'", ...hashes, ...(turnstile ? [cf] : [])].join(' '),
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    `frame-src ${frames.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** Giới hạn của Cloudflare: tối đa 100 quy tắc (dòng không thụt đầu) trong `_headers` (lỗi code 100324 khi `wrangler deploy`). */
export const CLOUDFLARE_HEADERS_RULE_LIMIT = 100;

/** Số quy tắc trong nội dung `_headers`: dòng không rỗng và không thụt đầu (dòng thụt là tiêu đề của quy tắc). */
export function countHeaderRules(headers: string): number {
  return headers.split('\n').filter((l) => l.trim() !== '' && !/^\s/.test(l)).length;
}

/** Lỗi `[HEADERS_RULE_LIMIT]` nếu `_headers` vượt trần quy tắc của Cloudflare; ngược lại mảng rỗng. */
export function headersRuleLimitErrors(headers: string): string[] {
  const n = countHeaderRules(headers);
  return n > CLOUDFLARE_HEADERS_RULE_LIMIT
    ? [`[HEADERS_RULE_LIMIT] _headers có ${n} quy tắc, vượt trần ${CLOUDFLARE_HEADERS_RULE_LIMIT} của Cloudflare`]
    : [];
}

/**
 * Khối `_headers` Content-Security-Policy, mỗi URL một quy tắc. `X.html` và `X/index.html` (bản sao do bước 2) gộp về `/X`
 * (wrangler `html_handling: drop-trailing-slash` chuyển `/X/` về `/X`); trang chủ giữ `/`. Trang chỉ có dạng `X/index.html` vẫn có quy tắc.
 * Hai file cùng URL mà CSP khác nhau ⇒ đẩy `[HEADERS_CSP_CONFLICT]` vào `errors` (không chọn bừa; giữ bản đầu).
 */
export function cspHeaderBlocks(pages: PageInfo[], errors: string[] = []): string {
  const byUrl = new Map<string, string>();
  for (const p of pages) {
    if (p.rel.startsWith('/_not-found')) continue; // không phải URL thật; trang 404 phục vụ qua /404
    const raw = p.rel === '/index.html' ? '/' : p.rel.replace(/\/index\.html$/, '').replace(/\.html$/, '');
    const urlPath = raw === '' ? '/' : raw;
    const csp = cspFor(urlPath, inlineScriptHashes(p.html));
    const prev = byUrl.get(urlPath);
    if (prev === undefined) byUrl.set(urlPath, csp);
    else if (prev !== csp) errors.push(`[HEADERS_CSP_CONFLICT] ${urlPath}: ${p.rel} có CSP khác bản cùng URL`);
  }
  return [...byUrl].map(([u, csp]) => `${u}\n  Content-Security-Policy: ${csp}\n`).join('');
}

export async function postBuild(
  outDir: string,
  cfg: SiteConfig,
  loaded: LoadedSiteContent,
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const isStaging = cfg.siteEnv === 'staging';

  // 0. bỏ trang giữ chỗ `_` của tuyến động rỗng (Next export cấm generateStaticParams rỗng)
  for (const f of listHtmlFiles(outDir)) {
    if (!f.slice(outDir.length).startsWith('/_next/') && basename(f) === '_.html') rmSync(f);
  }

  // 1. lang của trang en
  for (const p of readPages(outDir)) {
    const isEn = p.rel === '/en.html' || p.rel.startsWith('/en/');
    if (isEn && p.lang === 'vi') {
      writeFileSync(join(outDir, p.rel), p.html.replace(/(<html[^>]*\slang=")vi(")/i, '$1en$2'));
    }
  }

  // 2. X.html ⇒ X/index.html (404/500 và index gốc thì không)
  for (const f of listHtmlFiles(outDir)) {
    const rel = f.slice(outDir.length + 1);
    if (rel.startsWith('_next/') || basename(rel) === 'index.html') continue;
    if (/(^|\/)(404|500)\.html$/.test(rel)) continue;
    const dest = join(outDir, rel.replace(/\.html$/, ''), 'index.html');
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(f, dest);
  }

  // 3. ảnh + tài sản tĩnh. Next đã chép nguyên public/; dựng lại out/img để chỉ còn bản đã xử lý và được phép (allowedInBuild).
  rmSync(join(outDir, 'img'), { recursive: true, force: true });
  mkdirSync(join(outDir, 'og'), { recursive: true });
  writeFileSync(
    join(outDir, 'og', 'default.png'),
    await sharp({ create: { width: 1200, height: 630, channels: 3, background: { r: 15, g: 88, b: 56 } } })
      .png()
      .toBuffer(),
  );
  for (const img of loaded.images.values()) {
    await processAndWriteImage(img, outDir);
  }
  const copiedStatic = copyStaticImages(join(PUBLIC_DIR, 'img'), join(outDir, 'img'), new Set(loaded.images.keys()));
  await optimizeStaticImages(join(outDir, 'img'), copiedStatic);

  const formStatus = currentFormStatus(loaded.company);
  writeFileSync(join(outDir, 'form-status.json'), `${JSON.stringify(formStatus)}\n`);

  // 4. sitemap / robots / _headers
  const pages = readPages(outDir);
  const urls = new Set<string>();
  for (const p of pages) {
    if (!isStaging && !p.noindex && p.canonical) urls.add(p.canonical);
  }
  writeFileSync(
    join(outDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls].map((u) => `  <url><loc>${escXml(u)}</loc></url>`).join('\n')}
</urlset>
`,
  );
  writeFileSync(
    join(outDir, 'robots.txt'),
    isStaging
      ? `User-agent: *\nDisallow: /\n`
      : `User-agent: *\nDisallow: /api/\nSitemap: ${cfg.siteUrl}/sitemap.xml\n`,
  );
  // CSP theo từng đường dẫn: Next chèn script inline (dữ liệu RSC) khác nhau mỗi trang ⇒ tính sha256 từng script inline,
  // không dùng 'unsafe-inline'. Khối `/*` không chứa CSP vì các khối cùng khớp một URL được cộng dồn (hai CSP ⇒ giao nhau).
  writeFileSync(
    join(outDir, '_headers'),
    `${
      isStaging
        ? `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Robots-Tag: noindex\n`
        : `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/api/*\n  X-Robots-Tag: noindex\n  # /api/*\n`
    }${cspHeaderBlocks(pages, errors)}`,
  );

  // 5. kiểm
  for (const b of findBrokenImgRefs(outDir)) errors.push(`[IMG_NOT_IN_OUT] ${b}`);
  for (const p of pages) {
    const m = p.html.match(/<img\b[^>]*?\ssrcset="([^"]*)"/gi) ?? [];
    for (const tag of m) {
      for (const part of tag
        .replace(/^[\s\S]*?srcset="/i, '')
        .replace(/"$/, '')
        .split(',')) {
        const u = part.trim().split(/\s+/)[0];
        if (u?.startsWith('/') && !existsSync(join(outDir, decodeURI(u.split(/[?#]/)[0])))) {
          errors.push(`[SRCSET_NOT_IN_OUT] ${p.rel}: ${u}`);
        }
      }
    }
    const isErr = /^\/(en\/)?(404|500)\.html$/.test(p.rel);
    if (!p.canonical) errors.push(`[CANONICAL_MISSING] ${p.rel}`);
    if (!isErr) {
      for (const hl of ['vi', 'en', 'x-default']) {
        if (!new RegExp(`<link[^>]*\\shreflang="${hl}"`, 'i').test(p.html)) {
          errors.push(`[HREFLANG_MISSING] ${p.rel}: ${hl}`);
        }
      }
    }
    const expectLang = p.rel === '/en.html' || p.rel.startsWith('/en/') ? 'en' : 'vi';
    if (p.lang !== expectLang) errors.push(`[HTML_LANG] ${p.rel}: lang=${p.lang}, cần ${expectLang}`);
    if (isStaging && !p.noindex) errors.push(`[STAGING_INDEXABLE] ${p.rel}`);
    const og = p.html.match(/<meta[^>]*\sproperty="og:image"[^>]*\scontent="([^"]*)"/i)?.[1];
    if (!og) errors.push(`[OG_MISSING] ${p.rel}`);
    else if (og.startsWith(cfg.siteUrl) && !existsSync(join(outDir, decodeURI(og.slice(cfg.siteUrl.length))))) {
      errors.push(`[OG_NOT_IN_OUT] ${p.rel}: ${og}`);
    }
  }
  if (!isStaging && urls.size === 0) errors.push('[SITEMAP_EMPTY] sitemap.xml không có URL nào');
  const hero = pages.find((p) => p.rel === '/index.html');
  if (
    hero &&
    existsSync(join(outDir, HERO_IMG_REL)) &&
    /hero-plant\.jpg/i.test(hero.html) &&
    !/srcset="[^"]*hero-plant-512\.jpg/i.test(hero.html)
  ) {
    errors.push('[PERF01_HERO_SRCSET] trang chủ thiếu srcset ảnh hero 512w');
  }
  for (const f of copiedStatic) {
    if (!/\.(jpe?g|png)$/i.test(f)) continue;
    try {
      const w = (await sharp(join(outDir, 'img', f)).metadata()).width ?? 0;
      if (w > STATIC_IMG_MAX_WIDTH) errors.push(`[PERF01_IMG_TOO_WIDE] img/${f}: ${w}px > ${STATIC_IMG_MAX_WIDTH}px`);
    } catch {}
    if (SOLUTION_IMG_FILES.has(f)) {
      for (const v of [solutionImgSmallName(f), solutionImgMidName(f)]) {
        if (!existsSync(join(outDir, 'img', v))) errors.push(`[PERF01_VARIANT_MISSING] img/${v}`);
      }
    }
  }
  const headers = readFileSync(join(outDir, '_headers'), 'utf8');
  if (!/X-Content-Type-Options:\s*nosniff/.test(headers))
    errors.push('[HEADERS] _headers thiếu X-Content-Type-Options');
  errors.push(...headersRuleLimitErrors(headers));
  if (typeof formStatus.open !== 'boolean') errors.push('[FORM_STATUS] form-status.json thiếu open');

  // Quét đầu ra theo content/denylist.yaml (build.ts §8 luật 6): có tên cấm ⇒ build đỏ. Quét cả _next/.
  const denylist = loadDenylist(cfg.contentDir);
  if ('error' in denylist) {
    errors.push(`[${denylist.error.code}] ${denylist.error.message}`);
  } else {
    for (const e of scanOutputForForbiddenNames(outDir, denylist.names)) errors.push(`[${e.code}] ${e.message}`);
  }
  return { ok: errors.length === 0, errors };
}
