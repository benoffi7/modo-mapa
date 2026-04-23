import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      // firebase-admin is only installed under functions/node_modules.
      // These aliases let the scripts/ tests import it without installing it
      // at the root. The mocks in the test files override the actual modules
      // at runtime, so no Firebase connection is made during tests.
      'firebase-admin/app': resolve('./functions/node_modules/firebase-admin/lib/app/index.js'),
      'firebase-admin/firestore': resolve('./functions/node_modules/firebase-admin/lib/firestore/index.js'),
      // virtual:pwa-register is a Vite virtual module that doesn't exist in
      // the test environment. We redirect it to a stub so vi.mock() can
      // intercept it normally.
      'virtual:pwa-register': resolve('./src/test/stubs/pwa-register.ts'),
    },
  },
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
