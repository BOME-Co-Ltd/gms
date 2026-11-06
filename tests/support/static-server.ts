// Máy chủ tĩnh tối thiểu cho thư mục out/ của MỘT bản build (loopback, cổng ngẫu nhiên). Dùng cho ca quét DOM sau khi JS chạy
// trên bản build tạm (E43-03/04), không cần Worker. Không gửi _headers/CSP: ca chỉ cần JS của trang chạy.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join, normalize } from 'node:path';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

const isFile = (p: string) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

export function listHtml(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return listHtml(p, base);
    return n.endsWith('.html') ? [p.slice(base.length + 1)] : [];
  });
}

// out/ tương đối → URL path: "a/index.html" → "/a/", "index.html" → "/", "x.html" → "/x.html" (giữ nguyên đuôi để mở đúng tệp).
export const urlOfHtml = (rel: string) =>
  rel === 'index.html' ? '/' : rel.endsWith('/index.html') ? `/${rel.slice(0, -'index.html'.length)}` : `/${rel}`;

export async function serveDir(root: string): Promise<{ origin: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0].split('#')[0]);
    const rel = normalize(url).replace(/^(\.\.[/\\])+/, '');
    const candidates = [join(root, rel), join(root, rel, 'index.html'), join(root, `${rel}.html`)];
    const hit = candidates.find(isFile);
    if (!hit) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    const ext = hit.slice(hit.lastIndexOf('.'));
    res.setHeader('content-type', MIME[ext] ?? 'application/octet-stream');
    res.end(readFileSync(hit));
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('không mở được cổng loopback');
  return { origin: `http://127.0.0.1:${addr.port}`, close: () => new Promise<void>((ok) => server.close(() => ok())) };
}
