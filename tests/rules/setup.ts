/**
 * Test factory + helpers para Firestore rules unit testing.
 *
 * Patron: cada test suite llama a `createRulesTestEnv()` en `beforeAll`
 * y a `env.cleanup()` en `afterAll`. Entre tests, `clearFirestore(env)`
 * en `beforeEach` garantiza estado limpio.
 *
 * Decisiones de diseno (specs L222-228):
 * - No singleton del env. Cada suite crea el suyo (1-2s extra pero
 *   evita contaminacion si una suite previa rompe el env).
 * - Fresh read del archivo `firestore.rules` en cada call —
 *   refresh-on-rerun en watch mode local y CI.
 * - `path.resolve(__dirname, '../../firestore.rules')` anclado al
 *   archivo, funciona desde cualquier cwd que ejecute Vitest.
 *
 * Seguridad (specs "Hardening"):
 * - `RULES_TEST_PROJECT_ID = 'modo-mapa-rules-test'` aislado, NUNCA matchea
 *   `modo-mapa-app` (prod + staging). Verificado contra `.firebaserc`.
 * - Harness pinea `host: 'localhost'` y `port: 8080` — nunca alcanza
 *   Firestore real, incluso si por error futuro alguien renombra projectIds.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
  type RulesTestContext,
  type TokenOptions,
} from '@firebase/rules-unit-testing';

// Constantes exportadas — ningun suite redeclara estos valores.
export const RULES_TEST_PROJECT_ID = 'modo-mapa-rules-test';
export const RULES_EMULATOR_HOST = '127.0.0.1';
export const RULES_EMULATOR_PORT = 8080;

// Compat ESM/CJS: __dirname no existe en ESM, derivamos de import.meta.url.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

/**
 * Crea un entorno aislado contra el emulador Firestore.
 * Lee `firestore.rules` fresh del disco — refresh-on-rerun.
 *
 * IMPORTANTE: el emulador DEBE estar corriendo en `localhost:8080`
 * (`firebase emulators:start --only firestore` o
 * `firebase emulators:exec --only firestore "..."`). Si no esta,
 * esta funcion rechaza con error claro.
 */
export async function createRulesTestEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: RULES_TEST_PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: RULES_EMULATOR_HOST,
      port: RULES_EMULATOR_PORT,
    },
  });
}

/**
 * Context autenticado con un `uid` dado. Opcionalmente sumar custom
 * claims (ej. `{ admin: true }`) via `extra.token`.
 */
export function authedContext(
  env: RulesTestEnvironment,
  uid: string,
  extra?: { token?: TokenOptions }
): RulesTestContext {
  return env.authenticatedContext(uid, extra?.token);
}

/** Context sin autenticacion (request.auth == null). */
export function unauthedContext(env: RulesTestEnvironment): RulesTestContext {
  return env.unauthenticatedContext();
}

/**
 * Asercion: la promesa debe resolver (la operacion fue permitida por las rules).
 * Wrapper sobre `assertSucceeds` para alinear el vocabulario del proyecto.
 */
export function expectAllow<T>(promise: Promise<T>): Promise<T> {
  return assertSucceeds(promise);
}

/**
 * Asercion: la promesa debe rechazarse con "permission denied" (la rule denego).
 * Wrapper sobre `assertFails`.
 */
export function expectDeny<T>(promise: Promise<T>): Promise<T> {
  return assertFails(promise);
}

/** Limpia todos los docs entre tests. Llamar en `beforeEach`. */
export async function clearFirestore(env: RulesTestEnvironment): Promise<void> {
  await env.clearFirestore();
}

/**
 * Helper para sembrar docs en setup, saltando las rules (admin path).
 * Util para fixtures donde el doc inicial necesita campos server-only
 * o estados que las rules de cliente bloquearian.
 */
export async function withAdminContext(
  env: RulesTestEnvironment,
  fn: (ctx: RulesTestContext) => Promise<void>
): Promise<void> {
  await env.withSecurityRulesDisabled(async (adminCtx) => {
    await fn(adminCtx);
  });
}
