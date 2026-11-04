import { defineConfig } from 'vitest/config';

// `vitest run --root worker`. worker/index.test.ts là điểm vào Worker của môi trường test (wrangler.test.jsonc `main`),
// không phải bộ test; tên *.test.ts khiến vitest nạp nó và báo "No test suite found".
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', 'index.test.ts'],
  },
});
