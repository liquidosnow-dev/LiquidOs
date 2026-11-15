import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/utils/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['json', 'json-summary'],
      reportsDirectory: './.vitest-coverage',
      include: ['src/utils/**/*.ts'],
      exclude: ['src/utils/**/*.test.ts'],
    },
  },
});
