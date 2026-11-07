// Đóng gói out/ (đã qua hậu kỳ của `bun run build`) thành .vercel/output theo Build Output API v3 để Vercel phục vụ
// đúng như Worker Cloudflare: file tĩnh nguyên trạng, header (CSP từng trang) lấy từ out/_headers,
// bỏ dấu "/" cuối URL (html_handling: drop-trailing-slash), URL không đuôi → .html, trang 404 riêng.
// Chạy: `bun run build && bun run scripts/deploy/vercel-output.ts` (buildCommand trong vercel.json).
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

export function buildVercelConfig(headersText: string): { version: 3; routes: Route[] } {
  return {
    version: 3,
    routes: [
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

export function writeVercelOutput(outDir: string, targetDir: string): void {
  if (!existsSync(join(outDir, 'index.html')))
    throw new Error(`Không thấy ${outDir}/index.html — chạy \`bun run build\` trước.`);
  const headersPath = join(outDir, '_headers');
  const headersText = existsSync(headersPath) ? readFileSync(headersPath, 'utf8') : '';
  rmSync(targetDir, { recursive: true, force: true });
  const staticDir = join(targetDir, 'static');
  mkdirSync(staticDir, { recursive: true });
  cpSync(outDir, staticDir, { recursive: true });
  rmSync(join(staticDir, '_headers'), { force: true }); // chỉ Cloudflare đọc; ở Vercel đã chuyển vào config.json
  const config = buildVercelConfig(headersText);
  writeFileSync(join(targetDir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`);
  console.log(`vercel-output: ${config.routes.length} route → ${targetDir}`);
}

if (import.meta.main) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  writeVercelOutput(join(root, 'out'), join(root, '.vercel', 'output'));
}
