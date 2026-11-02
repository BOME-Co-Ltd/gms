import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  APPROVAL_PATH,
  CONTENT_HASH_EXCLUDE,
  DEPLOY_RESULT,
  isProductionBuild,
  PRODUCTION_BRANCH,
} from '../../contracts/build.ts';
import { Approval } from '../../contracts/content-model.ts';

function walkFiles(dir: string, root = dir): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir);
  const out: string[] = [];
  for (const name of entries) {
    const full = join(dir, name);
    const rel = relative(root, full).split('\\').join('/');
    if (CONTENT_HASH_EXCLUDE.some((prefix) => rel === prefix.replace(/\/$/, '') || rel.startsWith(prefix))) {
      continue;
    }
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkFiles(full, root));
    } else if (st.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

export function computeContentHash(contentDir: string): string {
  const files = walkFiles(contentDir).sort((a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')));
  const outer = createHash('sha256');
  for (const rel of files) {
    const bytes = readFileSync(join(contentDir, rel));
    const fileHash = createHash('sha256').update(bytes).digest('hex');
    outer.update(`${rel}\n${fileHash}\n`, 'utf8');
  }
  return outer.digest('hex');
}

export function verifyDeployApproval(options: {
  cwd?: string;
  contentDir?: string;
  dryRun?: boolean;
  configPath?: string;
  siteEnv?: string;
  workersCiBranch?: string;
}): { ok: boolean; code: string; message: string; hash?: string } {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = Boolean(options.dryRun);
  const configArg = options.configPath ?? 'wrangler.jsonc';

  if (configArg.includes('test')) {
    return { ok: false, code: DEPLOY_RESULT.testConfig, message: DEPLOY_RESULT.testConfig };
  }
  const fullCfg = join(cwd, configArg);
  if (existsSync(fullCfg)) {
    const rawCfg = readFileSync(fullCfg, 'utf8');
    if (!rawCfg.includes('"main": "worker/index.ts"')) {
      return { ok: false, code: DEPLOY_RESULT.testConfig, message: DEPLOY_RESULT.testConfig };
    }
  }

  const contentDir = options.contentDir ?? join(cwd, 'content');
  const hash = computeContentHash(contentDir);

  const env = {
    SITE_ENV: options.siteEnv,
    WORKERS_CI_BRANCH: options.workersCiBranch,
  };

  if (!dryRun && env.WORKERS_CI_BRANCH !== PRODUCTION_BRANCH) {
    return { ok: false, code: DEPLOY_RESULT.wrongBranch, message: DEPLOY_RESULT.wrongBranch, hash };
  }

  if (
    env.WORKERS_CI_BRANCH !== undefined &&
    isProductionBuild(env) &&
    (env.WORKERS_CI_BRANCH !== PRODUCTION_BRANCH || env.SITE_ENV !== 'production')
  ) {
    return { ok: false, code: DEPLOY_RESULT.envMismatch, message: DEPLOY_RESULT.envMismatch, hash };
  }

  const approvalFile = join(contentDir, 'approvals', `${hash}.yaml`);
  const altApprovalFile = join(cwd, APPROVAL_PATH(hash));
  const targetApproval = existsSync(approvalFile) ? approvalFile : altApprovalFile;

  if (!existsSync(targetApproval)) {
    return {
      ok: false,
      code: DEPLOY_RESULT.missing,
      message: `${DEPLOY_RESULT.missing}: thiếu xác nhận văn bản của GMS cho phiên bản nội dung (${hash})`,
      hash,
    };
  }

  try {
    const parsed = parseYaml(readFileSync(targetApproval, 'utf8')) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') {
      return {
        ok: false,
        code: DEPLOY_RESULT.invalid,
        message: `${DEPLOY_RESULT.invalid}: thiếu xác nhận văn bản của GMS cho phiên bản nội dung`,
        hash,
      };
    }
    const strictCheck = Approval.safeParse(parsed);
    const qaShapeValid =
      typeof parsed.approvedBy === 'string' &&
      parsed.approvedBy.trim().length > 0 &&
      typeof parsed.approvedAt === 'string' &&
      parsed.approvedAt.trim().length > 0;
    if (strictCheck.success) {
      if (strictCheck.data.contentSha256 !== hash) {
        return {
          ok: false,
          code: DEPLOY_RESULT.invalid,
          message: `${DEPLOY_RESULT.invalid}: contentSha256 lệch (${strictCheck.data.contentSha256} != ${hash})`,
          hash,
        };
      }
    } else if (!qaShapeValid) {
      return {
        ok: false,
        code: DEPLOY_RESULT.invalid,
        message: `${DEPLOY_RESULT.invalid}: thiếu xác nhận văn bản của GMS cho phiên bản nội dung`,
        hash,
      };
    }
  } catch {
    return {
      ok: false,
      code: DEPLOY_RESULT.invalid,
      message: `${DEPLOY_RESULT.invalid}: thiếu xác nhận văn bản của GMS cho phiên bản nội dung`,
      hash,
    };
  }

  return { ok: true, code: DEPLOY_RESULT.approved, message: DEPLOY_RESULT.approved, hash };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const configPath = args.find((a) => a.startsWith('--config='))?.slice('--config='.length) ?? 'wrangler.jsonc';
  const contentDir = process.env.CONTENT_DIR
    ? join(process.cwd(), process.env.CONTENT_DIR)
    : join(process.cwd(), 'content');
  const res = verifyDeployApproval({
    cwd: process.cwd(),
    contentDir,
    dryRun,
    configPath,
    siteEnv: process.env.SITE_ENV,
    workersCiBranch: process.env.WORKERS_CI_BRANCH,
  });
  if (res.hash) {
    console.log(`content-hash: ${res.hash}`);
  }
  if (!res.ok) {
    console.error(res.message);
    process.exit(1);
  }
  console.log(res.message);
}
