// Build giả lập Vercel (VERCEL=1) trong bản chép riêng: URL gốc lấy từ biến Vercel và SEO-13 (staging ⇒ noindex).
import { spawn } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const FIXTURE = join(ROOT, 'tests', 'fixtures', 'site-root');
const CONTENT: Record<string, string> = {
  'company.yaml':
    'legalName: "Công ty Mẫu GMS"\naddress:\n  vi: "Hưng Yên"\n  en: "Hung Yen"\nphone: "+84900000000"\nprivacyRequestEmail: "quyen@vi-du.test"\n',
  'policy/1.0.vi.md': '---\nversion: "1.0"\neffectiveFrom: "2026-01-01"\n---\nChính sách mẫu.\n',
  'policy/1.0.en.md': '---\nversion: "1.0"\neffectiveFrom: "2026-01-01"\n---\nSample policy.\n',
  'denylist.yaml': 'names:\n  - "Xanh Asian"\n',
};

const works: string[] = [];
afterAll(() => {
  for (const w of works) rmSync(w, { recursive: true, force: true });
});

function newWork(): string {
  const work = mkdtempSync(join(tmpdir(), 'gms-vercel-'));
  cpSync(FIXTURE, work, { recursive: true });
  for (const [rel, data] of Object.entries(CONTENT)) {
    const to = join(work, 'content', rel);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, data);
  }
  works.push(work);
  return work;
}

function build(work: string, extra: Record<string, string>): Promise<{ code: number | null; log: string }> {
  const script = `import { runBuildSite } from ${JSON.stringify(join(ROOT, 'scripts/content/build-site.ts'))};
const w = process.argv[1];
const r = await runBuildSite({ cwd: w, contentDir: w + '/content' });
process.exit(r.ok ? 0 : 1);`;
  const base = { ...process.env, NODE_ENV: 'production' } as NodeJS.ProcessEnv;
  for (const k of ['SITE_URL', 'SITE_ENV', 'VERCEL', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) delete base[k];
  return new Promise((done) => {
    const child = spawn('bun', ['-e', script, work], {
      cwd: work,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...base, ...extra },
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
}

describe('build trên Vercel', () => {
  it('không có SITE_URL: URL gốc = VERCEL_URL, meta robots noindex, robots.txt Disallow /, sitemap rỗng', async () => {
    const work = newWork();
    const r = await build(work, { VERCEL: '1', VERCEL_URL: 'gms-hungyen-web-roan.vercel.app' });
    expect(r.code, r.log.slice(-1500)).toBe(0);
    const out = (f: string) => readFileSync(join(work, 'out', f), 'utf8');
    expect(out('robots.txt')).toBe('User-agent: *\nDisallow: /\n');
    expect(out('sitemap.xml')).not.toContain('<loc>');
    const html = out('index.html');
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).toContain('href="https://gms-hungyen-web-roan.vercel.app/"');
    expect(html).not.toContain('example.test');
  }, 120_000);

  it('có SITE_URL tường minh: dùng SITE_URL, vẫn index, follow, sitemap có địa chỉ', async () => {
    const work = newWork();
    const r = await build(work, { VERCEL: '1', VERCEL_URL: 'x.vercel.app', SITE_URL: 'https://gms.vn' });
    expect(r.code, r.log.slice(-1500)).toBe(0);
    const out = (f: string) => readFileSync(join(work, 'out', f), 'utf8');
    expect(out('robots.txt')).toContain('Sitemap: https://gms.vn/sitemap.xml');
    expect(out('sitemap.xml')).toContain('<loc>https://gms.vn/');
    expect(out('index.html')).toContain('name="robots" content="index, follow"');
  }, 120_000);
});
