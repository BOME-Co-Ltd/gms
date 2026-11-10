// `bun run build`: kiểm nội dung ⇒ `next build` (output: export ⇒ out/) ⇒ kiểm + hậu kỳ (src/components/site/build/verify.ts).
// Giao diện là thành phần React trong src/app + src/components/site; file này chỉ là bộ điều khiển mỏng.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type SiteConfig, siteConfigFromEnv } from '../../src/components/site/build/config.ts';
import { retiredSlugErrors } from '../../src/components/site/build/retired.ts';
import { postBuild } from '../../src/components/site/build/verify.ts';
import { loadSiteContent } from '../../src/content/loader.ts';
import { computeContentHash } from '../deploy/deploy-prod.ts';

export type { SiteConfig } from '../../src/components/site/build/config.ts';
// Giữ các tên xuất cũ cho test/tooling đang import từ đây.
export {
  buildOrgJsonLd,
  currentFormStatus,
  loadSocial,
  siteConfigFromEnv,
} from '../../src/components/site/build/config.ts';
export {
  copyStaticImages,
  optimizeStaticImages,
  STATIC_IMG_MAX_WIDTH,
  stripExifFromJpegBuffer,
} from '../../src/components/site/build/images.ts';
export { findBrokenImgRefs, postBuild } from '../../src/components/site/build/verify.ts';
export {
  formatDateLocale,
  MENU_LABELS,
  MENU_ORDER,
  PAGE_DESCRIPTIONS,
  type StaticPageKey,
} from '../../src/components/site/menu.ts';

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Bản chép tối thiểu của app cho `next build`: mã nguồn + cấu hình chép, node_modules chép kiểu clone.
function prepareIsolatedRoot(dir: string, cwd: string): string {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const name of ['src', 'public', 'contracts']) {
    if (existsSync(join(APP_ROOT, name))) cpSync(join(APP_ROOT, name), join(dir, name), { recursive: true });
  }
  // public/ của thư mục gọi (bản chép của test, vd _redirects hay tệp đường cũ) ghi đè lên public/ của app:
  // không có bước này, tệp đặt ở public/ của cwd bị bỏ qua và kiểm RETIRED_* không thấy gì để bắt.
  const cwdPublic = join(cwd, 'public');
  if (existsSync(cwdPublic)) cpSync(cwdPublic, join(dir, 'public'), { recursive: true, force: true });
  for (const name of ['next.config.ts', 'tsconfig.json', 'package.json', 'postcss.config.mjs', 'next-env.d.ts']) {
    if (existsSync(join(APP_ROOT, name))) cpSync(join(APP_ROOT, name), join(dir, name));
  }
  // Turbopack từ chối symlink node_modules trỏ ra ngoài gốc dự án ⇒ phải có bản thật; chép kiểu clone (APFS `cp -c`,
  // Linux `--reflink=auto`) nên gần như không tốn đĩa/thời gian. shortcut: không clone được thì cp thường (chậm hơn).
  const flags = process.platform === 'darwin' ? ['-c', '-R'] : ['-R', '--reflink=auto'];
  const cp = spawnSync('cp', [...flags, join(APP_ROOT, 'node_modules'), join(dir, 'node_modules')], {
    stdio: 'inherit',
  });
  if (cp.status !== 0)
    throw new Error(`[NEXT_BUILD_ISOLATE_FAILED] không chép được node_modules (cp thoát ${cp.status})`);
  return dir;
}

/**
 * `bun run build`. Tham số giữ nguyên chữ ký cũ (tests/support/build-e2e-site.ts, tests dùng thư mục nội dung/ra riêng).
 */
export async function runBuildSite(options?: {
  cwd?: string;
  contentDir?: string;
  outDir?: string;
  siteUrl?: string;
  siteEnv?: string;
  contactRecipient?: string;
  dateOverride?: string;
}): Promise<{ ok: boolean; errors: string[]; hash?: string }> {
  const cwd = options?.cwd ?? process.cwd();
  const base = siteConfigFromEnv(cwd);
  const cfg: SiteConfig = {
    contentDir: options?.contentDir ?? base.contentDir,
    siteUrl: (options?.siteUrl ?? base.siteUrl).replace(/\/$/, ''),
    siteEnv: options?.siteEnv ?? base.siteEnv,
    contactRecipient: options?.contactRecipient !== undefined ? options.contactRecipient : base.contactRecipient,
    dateOverride: options?.dateOverride ?? base.dateOverride,
  };
  const outDir = options?.outDir ?? join(cwd, 'out');

  const loaded = loadSiteContent(cfg.contentDir, cfg.dateOverride);
  if (loaded.errors.length > 0) {
    const msgs = loaded.errors.map((err) => `[${err.code}] ${err.message}`);
    for (const m of msgs) console.error(m);
    return { ok: false, errors: msgs };
  }
  const slugErrors = retiredSlugErrors(loaded);
  if (slugErrors.length > 0) {
    for (const m of slugErrors) console.error(m);
    return { ok: false, errors: slugErrors };
  }
  const hash = computeContentHash(cfg.contentDir);
  console.log(`content-hash: ${hash}`);

  // Gọi từ thư mục khác APP_ROOT (test song song): build trong bản chép riêng (.next + out riêng) để không dẫm lên
  // .next/out của repo thật. Gọi từ APP_ROOT (`bun run build`): giữ nguyên hành vi cũ.
  const isolated = resolve(cwd) !== APP_ROOT;
  const buildRoot = isolated ? prepareIsolatedRoot(join(cwd, '.gms-next-build'), cwd) : APP_ROOT;
  const nextOut = join(buildRoot, 'out');
  rmSync(nextOut, { recursive: true, force: true });
  const run = spawnSync(
    process.env.NODE_BIN ?? 'node',
    [join(buildRoot, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'],
    {
      cwd: buildRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: '1',
        GMS_CONTENT_DIR: cfg.contentDir,
        SITE_URL: cfg.siteUrl,
        SITE_ENV: cfg.siteEnv,
        CONTACT_RECIPIENT: cfg.contactRecipient,
        ...(cfg.dateOverride ? { DATE_OVERRIDE: cfg.dateOverride } : {}),
      },
    },
  );
  if (run.status !== 0) {
    const m = `[NEXT_BUILD_FAILED] next build thoát với mã ${run.status ?? run.signal}`;
    console.error(m);
    if (isolated) rmSync(buildRoot, { recursive: true, force: true });
    return { ok: false, errors: [m] };
  }

  const res = await postBuild(nextOut, cfg, loaded);
  if (!res.ok) {
    for (const m of res.errors) console.error(m);
    return { ok: false, errors: res.errors };
  }
  if (resolve(outDir) !== resolve(nextOut)) {
    rmSync(outDir, { recursive: true, force: true });
    cpSync(nextOut, outDir, { recursive: true });
  }
  if (isolated) rmSync(buildRoot, { recursive: true, force: true });
  return { ok: true, errors: [], hash };
}

if (import.meta.main) {
  runBuildSite().then((res) => {
    if (!res.ok) process.exit(1);
  });
}
