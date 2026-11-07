// `bun run build`: kiểm nội dung ⇒ `next build` (output: export ⇒ out/) ⇒ kiểm + hậu kỳ (src/components/site/build/verify.ts).
// Giao diện là thành phần React trong src/app + src/components/site; file này chỉ là bộ điều khiển mỏng.
import { spawnSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSiteContent } from '../../src/content/loader.ts';
import { type SiteConfig, siteConfigFromEnv } from '../../src/components/site/build/config.ts';
import { postBuild } from '../../src/components/site/build/verify.ts';
import { computeContentHash } from '../deploy/deploy-prod.ts';

// Giữ các tên xuất cũ cho test/tooling đang import từ đây.
export { buildOrgJsonLd, currentFormStatus, loadSocial, siteConfigFromEnv } from '../../src/components/site/build/config.ts';
export type { SiteConfig } from '../../src/components/site/build/config.ts';
export {
  copyStaticImages,
  optimizeStaticImages,
  STATIC_IMG_MAX_WIDTH,
  stripExifFromJpegBuffer,
} from '../../src/components/site/build/images.ts';
export { findBrokenImgRefs, postBuild } from '../../src/components/site/build/verify.ts';
export { formatDateLocale, MENU_LABELS, MENU_ORDER, PAGE_DESCRIPTIONS, type StaticPageKey } from '../../src/components/site/menu.ts';

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

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
  const hash = computeContentHash(cfg.contentDir);
  console.log(`content-hash: ${hash}`);

  const nextOut = join(APP_ROOT, 'out');
  rmSync(nextOut, { recursive: true, force: true });
  const run = spawnSync(process.env.NODE_BIN ?? 'node', [join(APP_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], {
    cwd: APP_ROOT,
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
  });
  if (run.status !== 0) {
    const m = `[NEXT_BUILD_FAILED] next build thoát với mã ${run.status ?? run.signal}`;
    console.error(m);
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
  return { ok: true, errors: [], hash };
}

if (import.meta.main) {
  runBuildSite().then((res) => {
    if (!res.ok) process.exit(1);
  });
}
