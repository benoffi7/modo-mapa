import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: 'src',
    environment: 'node',
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
