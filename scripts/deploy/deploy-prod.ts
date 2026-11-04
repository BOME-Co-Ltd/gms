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

type DeployCheck = { ok: boolean; code: string; message: string; hash?: string };

const APPROVAL_MISSING_TEXT = 'thiếu xác nhận văn bản của GMS cho phiên bản nội dung';

function invalidApproval(hash: string, message = `${DEPLOY_RESULT.invalid}: ${APPROVAL_MISSING_TEXT}`): DeployCheck {
  return { ok: false, code: DEPLOY_RESULT.invalid, message, hash };
}

/** Chặn cấu hình test / cấu hình không trỏ tới worker thật. Trả null nếu hợp lệ. */
function checkConfig(cwd: string, configArg: string): DeployCheck | null {
  const testConfig: DeployCheck = { ok: false, code: DEPLOY_RESULT.testConfig, message: DEPLOY_RESULT.testConfig };
  if (configArg.includes('test')) return testConfig;
  const fullCfg = join(cwd, configArg);
  if (existsSync(fullCfg) && !readFileSync(fullCfg, 'utf8').includes('"main": "worker/index.ts"')) {
    return testConfig;
  }
  return null;
}

/** Chặn sai nhánh / lệch môi trường production. Trả null nếu hợp lệ. */
function checkBranchEnv(
  hash: string,
  dryRun: boolean,
  env: { SITE_ENV?: string; WORKERS_CI_BRANCH?: string },
): DeployCheck | null {
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
  return null;
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Đọc và kiểm file xác nhận. Trả null nếu hợp lệ. */
function checkApprovalContent(targetApproval: string, hash: string): DeployCheck | null {
  try {
    const parsed = parseYaml(readFileSync(targetApproval, 'utf8')) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object') return invalidApproval(hash);
    const strictCheck = Approval.safeParse(parsed);
    if (strictCheck.success) {
      if (strictCheck.data.contentSha256 === hash) return null;
      return invalidApproval(
        hash,
        `${DEPLOY_RESULT.invalid}: contentSha256 lệch (${strictCheck.data.contentSha256} != ${hash})`,
      );
    }
    return hasText(parsed.approvedBy) && hasText(parsed.approvedAt) ? null : invalidApproval(hash);
  } catch {
    return invalidApproval(hash);
  }
}

export function verifyDeployApproval(options: {
  cwd?: string;
  contentDir?: string;
  dryRun?: boolean;
  configPath?: string;
  siteEnv?: string;
  workersCiBranch?: string;
}): DeployCheck {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = Boolean(options.dryRun);

  const configFail = checkConfig(cwd, options.configPath ?? 'wrangler.jsonc');
  if (configFail) return configFail;

  const contentDir = options.contentDir ?? join(cwd, 'content');
  const hash = computeContentHash(contentDir);

  const branchFail = checkBranchEnv(hash, dryRun, {
    SITE_ENV: options.siteEnv,
    WORKERS_CI_BRANCH: options.workersCiBranch,
  });
  if (branchFail) return branchFail;

  const approvalFile = join(contentDir, 'approvals', `${hash}.yaml`);
  const targetApproval = existsSync(approvalFile) ? approvalFile : join(cwd, APPROVAL_PATH(hash));
  if (!existsSync(targetApproval)) {
    return {
      ok: false,
      code: DEPLOY_RESULT.missing,
      message: `${DEPLOY_RESULT.missing}: ${APPROVAL_MISSING_TEXT} (${hash})`,
      hash,
    };
  }

  const contentFail = checkApprovalContent(targetApproval, hash);
  if (contentFail) return contentFail;

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
