import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals:     true,
    environment: 'jsdom',
    setupFiles:  ['./tests/setup.js'],
    include:     ['tests/**/*.test.{js,jsx}'],
    coverage: {
      provider:         'v8',
      reporter:         ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**', 'tests/**', 'dist/**',
        'src/main.jsx', 'vite.config.js', 'playwright.config.js',
      ],
      thresholds: {
        lines:      60,
        functions:  60,
        branches:   55,
        statements: 60,
      },
    },
  },
});
