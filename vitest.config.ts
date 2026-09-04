import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      'node_modules/**',
      'dist/**',
      'frontend/**',
      'src/ai/tests/guardrails.test.ts',
      'src/ai/tests/prompt-regression.test.ts',
    ],
  },
});