import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['functions/**', 'node_modules/**', '.claude/**'],
    coverage: {
      provider: 'v8',
      exclude: [
        'src/components/admin/**',
        'src/components/DEV/**',
        'node_modules/**',
        '**/*.test.{ts,tsx}',
        '**/test/**',
        'src/test/**',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 77,
        lines: 80,
      },
    },
  },
})
