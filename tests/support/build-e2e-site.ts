// Bản build "đang chạy" cho e2e (test-plan §4 dòng "Bản build mặc định", XQ-21): dựng `out/` từ `content/` thật
// nhưng mở form như khi đã đủ dữ liệu khách — để ca UI gửi form kiểm được Worker dưới `wrangler dev --local`.
// Không đụng `content/` thật và không đổi luật FormStatus (contracts/build.ts §9):
//  - chép `content/` sang thư mục tạm, phủ `taxId` giả (khách chưa gửi MST — N27). "0000000000" là số giữ chỗ
//    mà build-site đã loại khỏi JSON-LD;
//  - CONTACT_MAIL_READY=true (SITE_ENV=test: qa đặt biến này, theo contracts/build.ts §9).
// Bản deploy thật vẫn đi qua `bun run build` (không qua file này) ⇒ form vẫn đóng tới khi có MST + email nhận thật.
// Chạy: `bun run build:e2e` rồi `wrangler dev --local --config wrangler.test.jsonc`.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBuildSite } from '../../scripts/content/build-site';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TEST_TAX_ID = '0000000000';

const tmp = mkdtempSync(join(tmpdir(), 'gms-e2e-content-'));
try {
  const contentDir = join(tmp, 'content');
  cpSync(join(ROOT, 'content'), contentDir, { recursive: true });
  const companyPath = join(contentDir, 'company.yaml');
  const company = readFileSync(companyPath, 'utf8');
  if (/^taxId:/m.test(company))
    throw new Error('content/company.yaml đã có taxId — bỏ phần phủ MST giả trong build-e2e-site.ts');
  writeFileSync(companyPath, `${company.replace(/\n*$/, '\n')}taxId: "${TEST_TAX_ID}"\n`);

  process.env.CONTACT_MAIL_READY = 'true';
  const res = await runBuildSite({ cwd: ROOT, contentDir, outDir: join(ROOT, 'out'), siteEnv: 'test' });
  if (!res.ok) process.exit(1);
  const status = JSON.parse(readFileSync(join(ROOT, 'out', 'form-status.json'), 'utf8'));
  if (!status.open) throw new Error(`form vẫn đóng ở bản e2e: ${JSON.stringify(status)}`);
  console.log('e2e build: form mở (MST giả, CONTACT_MAIL_READY=true)');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
