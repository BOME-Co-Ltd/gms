import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 05/11/2026 admin: gom cả unit test của worker và src (trước chỉ tests/unit ⇒ test mới không vào coverage).
    // worker/index.test.ts là điểm vào Worker của môi trường test, không phải bộ test.
    include: ['tests/unit/**/*.test.ts', 'worker/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'worker/index.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'contracts/**/*.ts',
        'src/**/*.ts',
        'src/**/*.tsx',
        'worker/**/*.ts',
        'scripts/**/*.ts',
        'next.config.ts',
        'playwright.config.ts',
        'vitest.config.ts',
        'postcss.config.mjs',
      ],
      exclude: ['**/*.d.ts', 'node_modules/**', 'tests/**'],
    },
  },
});
