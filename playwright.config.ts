import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const cwd = process.cwd();
const bunPath = process.execPath.endsWith('bun') ? process.execPath : 'bun';

process.env.BASE_URL = process.env.BASE_URL ?? 'http://localhost:8787';
process.env.SITE_BUILD_CMD =
  process.env.SITE_BUILD_CMD ?? `${bunPath} run ${join(cwd, 'scripts/content/build-site.ts')}`;
process.env.SITE_FIXTURE_ROOT = process.env.SITE_FIXTURE_ROOT ?? join(cwd, 'src/content/fixture-root');
process.env.SITE_DEPLOY_CMD =
  process.env.SITE_DEPLOY_CMD ?? `${bunPath} run ${join(cwd, 'scripts/deploy/deploy-prod.ts')}`;

export default defineConfig({
  testDir: './tests/acceptance',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'off',
  },
  webServer: {
    command: 'bun x wrangler dev --local --config wrangler.test.jsonc --port 8787',
    url: 'http://localhost:8787/api/contact/health',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
