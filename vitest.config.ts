import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['functions/**', 'node_modules/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 79,
        functions: 75,
        lines: 80,
      },
    },
  },
})
