/**
 * Vitest config separado para tests de Firestore rules.
 *
 * Justificacion (specs D3):
 * - `vitest.config.ts` principal usa `jsdom` + coverage thresholds 80%.
 * - Las rules tests corren contra emulador en Node, no necesitan DOM.
 * - NO contribuyen al coverage frontend (firestore.rules no es TS).
 * - Timeout mas alto (10s) porque `initializeTestEnvironment` levanta
 *   contexts contra el emulador (~1-2s primera vez).
 *
 * Uso:
 * - Local: `npm run test:rules` (levanta emulador via `emulators:exec`).
 * - CI: `npm run test:rules:ci` (asume emulador ya corriendo).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/rules/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'functions/**', 'src/**'],
    testTimeout: 10_000,
    // 60s — initializeTestEnvironment puede tardar la primera vez que el
    // emulador inicializa el Firestore-in-memory (especialmente en CI cold).
    hookTimeout: 60_000,
    // Sin coverage thresholds — firestore.rules no es codigo TS.
    coverage: {
      enabled: false,
    },
  },
});
