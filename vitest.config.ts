import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/utils/**/*.test.ts', 'src/engine/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['json', 'json-summary'],
      reportsDirectory: './.vitest-coverage',
      include: ['src/utils/**/*.ts', 'src/engine/**/*.ts', 'src/adapters/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
