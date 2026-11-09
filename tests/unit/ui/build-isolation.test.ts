// runBuildSite gọi từ thư mục khác gốc app (test chạy song song) phải build trong bản chép riêng:
// hai build đồng thời không dẫm lên nhau và không chạm .next/out của repo thật.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

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
});
