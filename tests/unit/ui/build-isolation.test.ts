// runBuildSite gọi từ thư mục khác gốc app (test chạy song song) phải build trong bản chép riêng:
// hai build đồng thời không dẫm lên nhau và không chạm .next/out của repo thật.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const FIXTURE = join(ROOT, 'tests', 'fixtures', 'site-root');

const CONTENT: Record<string, string> = {
  'company.yaml':
    'legalName: "Công ty Mẫu GMS"\naddress:\n  vi: "Hưng Yên"\n  en: "Hung Yen"\nphone: "+84900000000"\nprivacyRequestEmail: "quyen@vi-du.test"\n',
  'policy/1.0.vi.md': '---\nversion: "1.0"\neffectiveFrom: "2026-01-01"\n---\nChính sách mẫu.\n',
  'policy/1.0.en.md': '---\nversion: "1.0"\neffectiveFrom: "2026-01-01"\n---\nSample policy.\n',
  'denylist.yaml': 'names:\n  - "Xanh Asian"\n',
};

function newWork(): string {
  const work = mkdtempSync(join(tmpdir(), 'gms-iso-'));
  cpSync(FIXTURE, work, { recursive: true });
  for (const [rel, data] of Object.entries(CONTENT)) {
    const to = join(work, 'content', rel);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, data);
  }
  return work;
}

const works: string[] = [];
afterAll(() => {
  for (const w of works) rmSync(w, { recursive: true, force: true });
});

describe('runBuildSite từ thư mục khác gốc app', () => {
  it('hai build đồng thời đều xanh, mỗi bên có out riêng, .next/out thật không bị chạm', async () => {
    // Không so mtime .next/out thật ở đây: all.test.ts cố ý build thật và chạy song song với file này.
    const a = newWork();
    const b = newWork();
    works.push(a, b);
    // runBuildSite dùng spawnSync ⇒ mỗi build một tiến trình bun riêng thì mới chạy đồng thời thật.
    const script = `import { runBuildSite } from ${JSON.stringify(join(ROOT, 'scripts/content/build-site.ts'))};
const w = process.argv[1];
const t = Date.now();
const r = await runBuildSite({ cwd: w, contentDir: w + '/content', siteUrl: 'https://gms.example.test' });
console.log('BUILD_MS ' + (Date.now() - t));
process.exit(r.ok ? 0 : 1);`;
    const run = (w: string) =>
      new Promise<{ code: number | null; log: string }>((done) => {
        const child = spawn('bun', ['-e', script, w], {
          cwd: w,
          stdio: ['ignore', 'pipe', 'pipe'],
          // vitest đặt NODE_ENV=test; next build với giá trị đó nổ prerender (useContext null) — build thật chạy production.
          env: { ...process.env, NODE_ENV: 'production' },
        });
        let log = '';
        child.stdout.on('data', (d) => {
          log += d;
        });
        child.stderr.on('data', (d) => {
          log += d;
        });
        child.on('close', (code) => done({ code, log }));
      });
    const [ra, rb] = await Promise.all([run(a), run(b)]);
    console.log(
      ra.log.split('\n').filter((l) => l.startsWith('BUILD_MS')),
      rb.log.split('\n').filter((l) => l.startsWith('BUILD_MS')),
    );
    expect({ code: ra.code, tail: ra.code === 0 ? '' : ra.log.slice(-1500) }).toEqual({ code: 0, tail: '' });
    expect({ code: rb.code, tail: rb.code === 0 ? '' : rb.log.slice(-1500) }).toEqual({ code: 0, tail: '' });
    expect(existsSync(join(a, 'out', 'index.html'))).toBe(true);
    expect(existsSync(join(b, 'out', 'index.html'))).toBe(true);
    // bản chép tạm được dọn
    expect(readdirSync(a)).not.toContain('.gms-next-build');
    expect(readdirSync(b)).not.toContain('.gms-next-build');
  }, 600_000);

  // Hai ca dưới gọi runBuildSite NGAY TRONG tiến trình vitest để coverage ghi nhận prepareIsolatedRoot.
  it('trong tiến trình: build xanh, bản chép .gms-next-build được dọn, .next/out thật không bị chạm', async () => {
    const { runBuildSite } = await import('../../../scripts/content/build-site');
    const w = newWork();
    works.push(w);
    const realNext = join(ROOT, '.next');
    const realOut = join(ROOT, 'out');
    const before = [
      existsSync(realNext) ? statSync(realNext).mtimeMs : null,
      existsSync(realOut) ? statSync(realOut).mtimeMs : null,
    ];
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const r = await runBuildSite({ cwd: w, contentDir: join(w, 'content'), siteUrl: 'https://gms.example.test' });
      expect(r.ok).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
    expect(existsSync(join(w, 'out', 'index.html'))).toBe(true);
    expect(readdirSync(w)).not.toContain('.gms-next-build');
    const after = [
      existsSync(realNext) ? statSync(realNext).mtimeMs : null,
      existsSync(realOut) ? statSync(realOut).mtimeMs : null,
    ];
    expect(after).toEqual(before);
  }, 600_000);

  it('trong tiến trình: next build lỗi ⇒ trả NEXT_BUILD_FAILED và vẫn dọn .gms-next-build', async () => {
    const { runBuildSite } = await import('../../../scripts/content/build-site');
    const w = newWork();
    works.push(w);
    // NODE_BIN trỏ tới lệnh luôn thoát mã 1 ⇒ nhánh build lỗi, không đụng repo thật.
    vi.stubEnv('NODE_BIN', 'false');
    vi.stubEnv('NODE_ENV', 'production');
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const r = await runBuildSite({ cwd: w, contentDir: join(w, 'content'), siteUrl: 'https://gms.example.test' });
      expect(r.ok).toBe(false);
      expect(r.errors[0]).toContain('[NEXT_BUILD_FAILED]');
    } finally {
      errSpy.mockRestore();
      vi.unstubAllEnvs();
    }
    expect(readdirSync(w)).not.toContain('.gms-next-build');
    expect(existsSync(join(w, 'out'))).toBe(false);
  }, 300_000);
});
