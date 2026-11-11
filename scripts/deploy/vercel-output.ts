// Đóng gói out/ (đã qua hậu kỳ của `bun run build`) thành .vercel/output theo Build Output API v3 để Vercel phục vụ
// đúng như Worker Cloudflare: file tĩnh nguyên trạng, header (CSP từng trang) lấy từ out/_headers,
// bỏ dấu "/" cuối URL (html_handling: drop-trailing-slash), URL không đuôi → .html, trang 404 riêng.
// Chạy: `bun run build && bun run scripts/deploy/vercel-output.ts` (buildCommand trong vercel.json).
// Form liên hệ: có GMS_API_ORIGIN (vd https://gms-contact.<tên>.workers.dev) ⇒ /api/* chuyển sang Worker Cloudflare,
// gắn header x-gms-proxy = GMS_PROXY_SECRET (Vercel ghi đè, khách không tự đặt được; Worker dùng để tin IP khách).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Route = Record<string, unknown>;

const escRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Đường dẫn kiểu _headers (Cloudflare) → regex của Vercel. `*` khớp mọi ký tự, kể cả "/". */
export function headerPathToSrc(path: string): string {
  return `^${path.split('*').map(escRe).join('.*')}$`;
}

/** Đọc out/_headers → các route `continue` gắn header, giữ thứ tự khối. Dòng `#` là chú thích. */
export function parseHeadersFile(text: string): Route[] {
  const routes: Route[] = [];
  let current: { path: string; headers: Record<string, string> } | null = null;
  const flush = () => {
    if (current && Object.keys(current.headers).length > 0) {
      routes.push({ src: headerPathToSrc(current.path), headers: current.headers, continue: true });
    }
  };
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      flush();
      current = { path: line.trim(), headers: {} };
      continue;
    }
    if (!current) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    // Cùng tên header trong một khối: nối bằng dấu phẩy như Cloudflare.
    current.headers[name] = current.headers[name] ? `${current.headers[name]}, ${value}` : value;
  }
  flush();
  return routes;
}

/** Đọc out/_redirects (`/cu /moi 301`, cú pháp Cloudflare, contracts/build.ts REDIRECT_LINE) → route chuyển hướng. */
export function parseRedirectsFile(text: string): Route[] {
  const routes: Route[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const m = line.match(/^(\/(?!\/)\S*)\s+(\/(?!\/)\S*)\s+(301|308)$/);
    if (!m) continue;
    const [, from, to, code] = m;
    const base = from.replace(/\/$/, '') || '/';
    routes.push({ src: `^${escRe(base)}/?$`, status: Number(code), headers: { Location: to } });
  }
  return routes;
}

export type ApiProxy = { origin: string; secret?: string };

/** /api/* → Worker. Đặt đầu bảng route để không dính chuyển hướng "/" cuối hay header CSP của trang. */
export function apiProxyRoutes(api?: ApiProxy): Route[] {
  const origin = api?.origin?.trim().replace(/\/+$/, '');
  if (!origin) return [];
  if (!/^https:\/\/[^/\s]+$/.test(origin)) throw new Error(`GMS_API_ORIGIN không hợp lệ: ${origin}`);
  const route: Route = { src: '^/api/(.*)$', dest: `${origin}/api/$1` };
  if (api?.secret) {
    route.transforms = [{ type: 'request.headers', op: 'set', target: { key: 'x-gms-proxy' }, args: api.secret }];
  }
  return [route];
}

export function buildVercelConfig(
  headersText: string,
  redirectsText = '',
  api?: ApiProxy,
): { version: 3; routes: Route[] } {
  return {
    version: 3,
    routes: [
      ...apiProxyRoutes(api),
      ...parseRedirectsFile(redirectsText),
      // drop-trailing-slash: /a/ → /a (giữ "/" gốc).
      { src: '^/(.+)/$', status: 308, headers: { Location: '/$1' } },
      ...parseHeadersFile(headersText),
      { handle: 'filesystem' },
      // URL sạch: /gioi-thieu → /gioi-thieu.html (out/ có cả X.html và X/index.html).
      { src: '^/(.+)$', dest: '/$1.html', check: true },
      { handle: 'error' },
      { src: '^/.*$', dest: '/404.html', status: 404 },
    ],
  };
}

export function writeVercelOutput(outDir: string, targetDir: string, api?: ApiProxy): void {
  if (!existsSync(join(outDir, 'index.html')))
    throw new Error(`Không thấy ${outDir}/index.html — chạy \`bun run build\` trước.`);
  const headersPath = join(outDir, '_headers');
  const headersText = existsSync(headersPath) ? readFileSync(headersPath, 'utf8') : '';
  const redirectsPath = join(outDir, '_redirects');
  const redirectsText = existsSync(redirectsPath) ? readFileSync(redirectsPath, 'utf8') : '';
  rmSync(targetDir, { recursive: true, force: true });
  const staticDir = join(targetDir, 'static');
  mkdirSync(staticDir, { recursive: true });
  cpSync(outDir, staticDir, { recursive: true });
  // _headers/_redirects chỉ Cloudflare đọc; ở Vercel đã chuyển vào config.json.
  rmSync(join(staticDir, '_headers'), { force: true });
  rmSync(join(staticDir, '_redirects'), { force: true });
  const config = buildVercelConfig(headersText, redirectsText, api);
  writeFileSync(join(targetDir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
  console.log(`vercel-output: ${config.routes.length} route → ${targetDir}`);
}

if (import.meta.main) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  writeVercelOutput(join(root, 'out'), join(root, '.vercel', 'output'), {
    origin: process.env.GMS_API_ORIGIN ?? '',
    secret: process.env.GMS_PROXY_SECRET || undefined,
  });
}
