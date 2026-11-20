import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    pool:        'forks',   // ESM mock için gerekli
    coverage: {
      provider:   'v8',
      reporter:   ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['node_modules/**', 'tests/**', 'coverage/**', 'migrations/**', 'prisma/**'],
      thresholds: { lines: 60, functions: 60, branches: 55, statements: 60 },
    },
    testTimeout:  15000,
    hookTimeout:  15000,
    setupFiles:   ['./tests/setup.js'],
    include:      ['tests/**/*.test.js'],
  },
});
