import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
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
