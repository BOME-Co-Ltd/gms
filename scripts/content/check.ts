import { join } from 'node:path';
import { loadSiteContent } from '../../src/content/loader.ts';
import { computeContentHash } from '../deploy/deploy-prod.ts';

export function runContentCheck(
  contentDir?: string,
  dateOverride?: string,
): {
  ok: boolean;
  errors: string[];
  hash?: string;
} {
  const dir = contentDir ?? process.env.CONTENT_DIR ?? join(process.cwd(), 'content');
  const loaded = loadSiteContent(dir, dateOverride ?? process.env.DATE_OVERRIDE);
  if (loaded.errors.length > 0) {
    return {
      ok: false,
      errors: loaded.errors.map((err) => `[${err.code}] ${err.message}`),
    };
  }
  const hash = computeContentHash(dir);
  return { ok: true, errors: [], hash };
}

if (import.meta.main) {
  const res = runContentCheck();
  if (!res.ok) {
    for (const e of res.errors) {
      console.error(e);
    }
    process.exit(1);
  }
  console.log(`content-hash: ${res.hash}`);
}
