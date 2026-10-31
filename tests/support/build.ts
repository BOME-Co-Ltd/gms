// Chạy BẢN BUILD site với thư mục nội dung giả (fixture) để kiểm luật lúc build (@kiem-luc-build, design.md §6f).
// Lệnh build + biến môi trường CHƯA có contract (test-plan.md XQ-21): BUILD_CMD/FIXTURE_ROOT đọc từ env; thiếu ⇒ ném lỗi ⇒ ĐỎ.
// Tiến trình con chạy QUA sandbox_run.rb khi qa chạy tay; CI gọi trực tiếp.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BUILD_CMD, FIXTURE_ROOT } from './env';

export type Files = Record<string, string | Buffer>; // đường dẫn tương đối content/ ⇒ nội dung
export type BuildResult = { ok: boolean; code: number | null; log: string; outDir: string; read: (rel: string) => string | null; has: (rel: string) => boolean; files: () => string[] };

// Bộ nội dung nền HỢP LỆ tối thiểu (mọi luật xanh). Mỗi ca ghi đè/thêm file để làm hỏng đúng MỘT luật.
export const BASE_CONTENT: Files = {
  'company.yaml': 'legalName: "Công ty Mẫu GMS"\naddress:\n  vi: "Hưng Yên"\n  en: "Hung Yen"\nphone: "+84900000000"\nprivacyRequestEmail: "quyen@vi-du.test"\n',
  'policy/1.0.vi.md': '---\nversion: "1.0"\neffectiveFrom: "2026-01-01"\n---\nChính sách mẫu.\n',
  'policy/1.0.en.md': '---\nversion: "1.0"\neffectiveFrom: "2026-01-01"\n---\nSample policy.\n',
};

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, base) : [p.slice(base.length + 1)];
  });
}

export function buildSite(extra: Files = {}, env: Record<string, string> = {}): BuildResult {
  if (!BUILD_CMD || !FIXTURE_ROOT) throw new Error('Chưa có lệnh build/thư mục fixture (SITE_BUILD_CMD, SITE_FIXTURE_ROOT) — XQ-21');
  const work = mkdtempSync(join(tmpdir(), 'gms-build-'));
  cpSync(FIXTURE_ROOT, work, { recursive: true });
  const content = join(work, 'content');
  for (const [rel, data] of Object.entries({ ...BASE_CONTENT, ...extra })) {
    const to = join(content, rel);
    mkdirSync(join(to, '..'), { recursive: true });
    writeFileSync(to, data);
  }
  const [cmd, ...args] = BUILD_CMD.split(' ');
  const r = spawnSync(cmd, args, { cwd: work, env: { ...process.env, SITE_URL: 'https://gms.example.test', ...env }, encoding: 'utf8' });
  const outDir = join(work, 'out');
  return {
    ok: r.status === 0, code: r.status, log: `${r.stdout}\n${r.stderr}`, outDir,
    read: (rel) => { try { return readFileSync(join(outDir, rel), 'utf8'); } catch { return null; } },
    has: (rel) => { try { statSync(join(outDir, rel)); return true; } catch { return false; } },
    files: () => walk(outDir),
  };
}

// Đọc HTML của một URL trong bản build (chưa rõ trailingSlash ⇒ thử cả hai dạng; XQ-21).
export function htmlOf(r: BuildResult, urlPath: string): string | null {
  const p = urlPath.replace(/^\/|\/$/g, '');
  return r.read(p ? `${p}/index.html` : 'index.html') ?? r.read(`${p}.html`);
}
export const allHtml = (r: BuildResult) => r.files().filter((f) => f.endsWith('.html')).map((f) => r.read(f) ?? '').join('\n');
export const count = (hay: string, needle: string | RegExp) =>
  typeof needle === 'string' ? hay.split(needle).length - 1 : (hay.match(new RegExp(needle, needle.flags.includes('g') ? needle.flags : needle.flags + 'g')) ?? []).length;

// Tin tối thiểu hợp lệ (cặp vi/en cùng key).
export function newsFiles(key: string, over: { vi?: Record<string, unknown>; en?: Record<string, unknown>; body?: string } = {}): Files {
  const fm = (loc: 'vi' | 'en', o: Record<string, unknown> = {}) => {
    const base: Record<string, unknown> = { slug: `${key}-${loc}`, key, title: `Tin ${key} ${loc}`, published: true, summary: 'Tóm tắt', date: '2026-10-01', ...o };
    return `---\n${Object.entries(base).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n${over.body ?? 'Nội dung.'}\n`;
  };
  return { [`news/${key}.vi.md`]: fm('vi', over.vi), [`news/${key}.en.md`]: fm('en', over.en) };
}
