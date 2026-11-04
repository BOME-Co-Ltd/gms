import { defineConfig } from 'vitest/config';

// `vitest run --root src/content`: test đặt cạnh luật nội dung (vitest.config.ts của repo chỉ gom tests/unit/**).
export default defineConfig({ test: { include: ['**/*.test.ts'] } });
