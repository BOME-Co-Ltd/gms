// Chạy BẢN BUILD site với thư mục nội dung giả (fixture) để kiểm luật lúc build (@kiem-luc-build, design.md §6f).
// Lệnh build + biến môi trường CHƯA có contract (test-plan.md XQ-21): BUILD_CMD/FIXTURE_ROOT đọc từ env; thiếu ⇒ ném lỗi ⇒ ĐỎ.
// Tiến trình con chạy QUA sandbox_run.rb khi qa chạy tay; CI gọi trực tiếp.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BUILD_CMD, FIXTURE_ROOT } from './env';

// đường dẫn tương đối content/ ⇒ nội dung; `null` = XOÁ tệp khỏi bộ nội dung (vd BASE_CONTENT 'denylist.yaml' để thử "thiếu tệp")
export type Files = Record<string, string | Buffer | null>;
export type BuildResult = {
  ok: boolean;
  code: number | null;
  log: string;
  outDir: string;
  read: (rel: string) => string | null;
  has: (rel: string) => boolean;
  files: () => string[];
};

// Bộ nội dung nền HỢP LỆ tối thiểu (mọi luật xanh). Mỗi ca ghi đè/thêm file để làm hỏng đúng MỘT luật.
export const BASE_CONTENT: Files = {
  'company.yaml':
    'legalName: "Công ty Mẫu GMS"\naddress:\n  vi: "Hưng Yên"\n  en: "Hung Yen"\nphone: "+84900000000"\nprivacyRequestEmail: "quyen@vi-du.test"\n',
  'policy/1.0.vi.md': '---\nversion: "1.0"\neffectiveFrom: "2026-01-01"\n---\nChính sách mẫu.\n',
  'policy/1.0.en.md': '---\nversion: "1.0"\neffectiveFrom: "2026-01-01"\n---\nSample policy.\n',
  // Lượt 14 (M40): thiếu/rỗng denylist ⇒ build đỏ DENYLIST_MISSING ở mọi SITE_ENV ⇒ bộ nền phải có. "Xanh Asian" là DỮ LIỆU của danh sách cấm.
  'denylist.yaml': 'names:\n  - "Xanh Asian"\n',
};

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, base) : [p.slice(base.length + 1)];
  });
}

// `overlay`: tệp chèn vào BẢN CHÉP của thư mục nền (đường dẫn tương đối gốc bản chép, vd 'public/qa-fixture.svg'), ngoài content/.
// Bản chép nằm ở thư mục tạm; không ghi gì vào public/, src/, content/ thật (admin quyết 07/11, XQ-QA-M40-1).
function buildCore(
  extra: Files,
  env: Record<string, string>,
  overlay: Record<string, string | Buffer>,
): BuildResult {
  if (!BUILD_CMD || !FIXTURE_ROOT)
    throw new Error('Chưa có lệnh build/thư mục fixture (SITE_BUILD_CMD, SITE_FIXTURE_ROOT) — XQ-21');
  const work = mkdtempSync(join(tmpdir(), 'gms-build-'));
  cpSync(FIXTURE_ROOT, work, { recursive: true });
  const content = join(work, 'content');
  for (const [rel, data] of Object.entries({ ...BASE_CONTENT, ...extra })) {
    const to = join(content, rel);
    if (data === null) {
      rmSync(to, { force: true });
      continue;
    }
    mkdirSync(join(to, '..'), { recursive: true });
    writeFileSync(to, data);
  }
  for (const [rel, data] of Object.entries(overlay)) {
    const to = join(work, rel);
    mkdirSync(join(to, '..'), { recursive: true });
    writeFileSync(to, data);
  }
  const [cmd, ...args] = BUILD_CMD.split(' ');
  const r = spawnSync(cmd, args, {
    cwd: work,
    env: { ...process.env, SITE_URL: 'https://gms.example.test', ...env },
    encoding: 'utf8',
  });
  const outDir = join(work, 'out');
  return Object.freeze({
    ok: r.status === 0,
    code: r.status,
    log: `${r.stdout}\n${r.stderr}`,
    outDir,
    read: (rel) => {
      try {
        return readFileSync(join(outDir, rel), 'utf8');
      } catch {
        return null;
      }
    },
    has: (rel) => {
      try {
        statSync(join(outDir, rel));
        return true;
      } catch {
        return false;
      }
    },
    files: () => walk(outDir),
  });
}

// Khoá memo = sha256 của (extra, env, overlay): khoá object xếp theo thứ tự chữ; mỗi giá trị gắn nhãn kiểu + độ dài
// (chuỗi 's', Buffer 'b' băm theo byte, null 'n') nên Buffer ≠ chuỗi cùng nội dung, null ≠ chuỗi rỗng ≠ khoá vắng mặt.
function memoKey(extra: Files, env: Record<string, string>, overlay: Record<string, string | Buffer | null>): string {
  const h = createHash('sha256');
  const part = (name: string, o: Record<string, string | Buffer | null>) => {
    h.update(`[${name}:${Object.keys(o).length}]`);
    for (const k of Object.keys(o).sort()) {
      const v = o[k];
      h.update(`k${Buffer.byteLength(k)}:${k}`);
      if (v === null) h.update('n;');
      else if (Buffer.isBuffer(v)) {
        h.update(`b${v.length}:`);
        h.update(v);
        h.update(';');
      } else {
        h.update(`s${Buffer.byteLength(v)}:`);
        h.update(v);
        h.update(';');
      }
    }
  };
  part('extra', extra);
  part('env', env);
  part('overlay', overlay);
  return h.digest('hex');
}

const memo = new Map<string, BuildResult>();

// KẾT QUẢ DÙNG CHUNG giữa các ca trong cùng tiến trình (build xác định theo đầu vào; chỉ build xanh, build đỏ luôn build lại).
// Spec KHÔNG được ghi/xoá trong outDir hay thư mục cha của nó, cũng không sửa đối tượng trả về (đã đóng băng).
// Spec nào cần ghi vào thư mục build thì dùng buildSiteFresh (luôn build mới, không đọc/ghi memo).
export function buildSite(
  extra: Files = {},
  env: Record<string, string> = {},
  overlay: Record<string, string | Buffer> = {},
): BuildResult {
  const key = memoKey(extra, env, overlay);
  const hit = memo.get(key);
  if (hit) return hit;
  const r = buildCore(extra, env, overlay);
  // Build đỏ có thể do máy (vd ENOTEMPTY ở .next khi macOS chèn .DS_Store); nhớ lại sẽ lan lỗi sang ca khác.
  if (r.ok) memo.set(key, r);
  return r;
}

// Luôn build mới trong thư mục tạm riêng; không đọc, không ghi memo. Dùng khi spec ghi vào thư mục build.
export function buildSiteFresh(
  extra: Files = {},
  env: Record<string, string> = {},
  overlay: Record<string, string | Buffer> = {},
): BuildResult {
  return buildCore(extra, env, overlay);
}

// Đọc HTML của một URL trong bản build (chưa rõ trailingSlash ⇒ thử cả hai dạng; XQ-21).
export function htmlOf(r: BuildResult, urlPath: string): string | null {
  const p = urlPath.replace(/^\/|\/$/g, '');
  return r.read(p ? `${p}/index.html` : 'index.html') ?? r.read(`${p}.html`);
}
export const allHtml = (r: BuildResult) =>
  r
    .files()
    .filter((f) => f.endsWith('.html'))
    .map((f) => r.read(f) ?? '')
    .join('\n');
export const count = (hay: string, needle: string | RegExp) =>
  typeof needle === 'string'
    ? hay.split(needle).length - 1
    : (hay.match(new RegExp(needle, needle.flags.includes('g') ? needle.flags : needle.flags + 'g')) ?? []).length;

// Tin tối thiểu hợp lệ (cặp vi/en cùng key).
export function newsFiles(
  key: string,
  over: { vi?: Record<string, unknown>; en?: Record<string, unknown>; body?: string } = {},
): Files {
  const fm = (loc: 'vi' | 'en', o: Record<string, unknown> = {}) => {
    const base: Record<string, unknown> = {
      slug: `${key}-${loc}`,
      key,
      title: `Tin ${key} ${loc}`,
      published: true,
      summary: 'Tóm tắt',
      date: '2026-10-01',
      ...o,
    };
    return `---\n${Object.entries(base)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n')}\n---\n${over.body ?? 'Nội dung.'}\n`;
  };
  return { [`news/${key}.vi.md`]: fm('vi', over.vi), [`news/${key}.en.md`]: fm('en', over.en) };
}
