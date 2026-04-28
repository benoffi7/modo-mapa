#!/usr/bin/env node

/**
 * One-off migration / audit script for `users.displayNameLower`.
 *
 * Reusa la conexion del Admin SDK al estilo de `scripts/migrateDisplayNameLower.ts`,
 * pero agrega:
 *   - Modo `--audit` (default, read-only) y `--apply` (escribe correcciones).
 *   - Detecciones separadas: `missing`, `desync`, `invalidRegex`.
 *   - Idempotencia: re-correr `--apply` tras un exito previo es no-op.
 *   - Precondition check de `GOOGLE_APPLICATION_CREDENTIALS` antes de
 *     `initializeApp()` para que el error sea accionable y no un stack trace
 *     del Admin SDK.
 *
 * Sirve la pre-condicion del rollout S3 del PRD #322 (equality bidireccional
 * displayName / displayNameLower). Ver `docs/feat/security/322-firestore-rules-hardening-bootstrap-admin/specs.md`
 * seccion "Migracion: scripts/migrate-displayname-lower-sync.mjs" para el
 * detalle del rollout (Fase 9 del plan).
 *
 * Modos:
 *   - `--audit` (default): cuenta + samples por categoria. NO escribe.
 *   - `--apply`: corrige `missing` y `desync` (idempotent). NO toca
 *     `invalidRegex` — eso requiere decision del usuario sobre el displayName
 *     visible.
 *
 * Uso:
 *   export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
 *   node scripts/migrate-displayname-lower-sync.mjs           # audit (default)
 *   node scripts/migrate-displayname-lower-sync.mjs --audit
 *   node scripts/migrate-displayname-lower-sync.mjs --apply
 *
 * El modulo exporta sus primitivas para ser testeables en aislamiento.
 * Cuando el archivo se importa desde un test runner el bloque CLI no se
 * ejecuta (gated por `import.meta.url === file://${process.argv[1]}`).
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Regex de `displayName` que las rules van a aplicar tras el deploy de S3 (#322).
 * Rechaza whitespace inicial/final/total y exige que el primer y ultimo char
 * NO sean `.` ni espacio. Tradeoff: rechaza `"L."`, `"Mr."`, `"   "`, `" Juan"`,
 * `"Juan "`. Ver PRD seccion S3 / Out of Scope.
 */
export const NEW_DISPLAYNAME_REGEX = /^[A-Za-z0-9À-ÿ_-]([A-Za-z0-9À-ÿ ._-]*[A-Za-z0-9À-ÿ_-])?$/;

/** Limite del batch de Firestore (writes maximos por commit). */
export const BATCH_SIZE = 500;

/** Cantidad maxima de samples por categoria que se imprimen en audit. */
export const SAMPLE_LIMIT = 5;

/**
 * Parsea argv buscando `--audit` o `--apply`. Default: `audit`.
 * Si se pasan ambos, `--apply` gana (intencion explicita del operador).
 * @param {string[]} argv
 * @returns {'audit' | 'apply'}
 */
export function parseMode(argv) {
  const list = Array.isArray(argv) ? argv : [];
  if (list.includes('--apply')) return 'apply';
  return 'audit';
}

/**
 * Verifica que `GOOGLE_APPLICATION_CREDENTIALS` este seteada. Si no, imprime
 * mensaje accionable y devuelve `false` — el caller decide salir con
 * `process.exit(1)` (mantenemos la separacion para tests).
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {{ error?: (...args: unknown[]) => void }} [logger=console]
 * @returns {boolean}
 */
export function checkCredentials(env = process.env, logger = console) {
  if (!env.GOOGLE_APPLICATION_CREDENTIALS) {
    logger.error?.('Error: GOOGLE_APPLICATION_CREDENTIALS env var not set.');
    logger.error?.('Set it to the path of a service account JSON with Firestore read/write access.');
    logger.error?.('Example: export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json');
    return false;
  }
  return true;
}

let _cachedDb;

/**
 * Lazily initializes firebase-admin (Application Default Credentials) y
 * devuelve un cliente Firestore. Cacheado por proceso.
 * @returns {import('firebase-admin/firestore').Firestore}
 */
export function getDb() {
  if (_cachedDb) return _cachedDb;
  if (!getApps().length) initializeApp({ credential: applicationDefault() });
  _cachedDb = getFirestore();
  return _cachedDb;
}

/**
 * Clasifica un user doc en una o mas categorias.
 * Un mismo doc puede caer en `missing`+`invalidRegex` o `desync`+`invalidRegex`
 * — `invalidRegex` se chequea independiente del estado de `displayNameLower`.
 *
 * Retorna `null` si el doc no es candidato (no tiene `displayName` string —
 * ese caso sera tratado por las rules en otro flow, no es responsabilidad
 * de este script).
 *
 * @param {{ id: string, data: Record<string, unknown> }} doc
 * @returns {{
 *   id: string,
 *   displayName: string,
 *   currentLower: string | undefined,
 *   expectedLower: string,
 *   missing: boolean,
 *   desync: boolean,
 *   invalidRegex: boolean,
 * } | null}
 */
export function classifyDoc(doc) {
  const data = doc?.data ?? {};
  const displayName = data.displayName;
  if (typeof displayName !== 'string' || displayName.length === 0) return null;

  const currentLower = data.displayNameLower;
  const expectedLower = displayName.toLowerCase();

  const missing = currentLower === undefined || currentLower === null;
  const desync = !missing && currentLower !== expectedLower;
  const invalidRegex = !NEW_DISPLAYNAME_REGEX.test(displayName);

  return {
    id: doc.id,
    displayName,
    currentLower: typeof currentLower === 'string' ? currentLower : undefined,
    expectedLower,
    missing,
    desync,
    invalidRegex,
  };
}

/**
 * Recorre `users` y produce el reporte de auditoria.
 * NO escribe nada. Usado tanto en modo `audit` como precondicion del modo
 * `apply` (calcula la lista de docs a corregir).
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {Promise<{
 *   total: number,
 *   counts: { missing: number, desync: number, invalidRegex: number },
 *   samples: { missing: object[], desync: object[], invalidRegex: object[] },
 *   toFix: { id: string, expectedLower: string }[],
 * }>}
 */
export async function audit(db) {
  const usersSnap = await db.collection('users').get();
  const docs = usersSnap.docs ?? [];
  const total = typeof usersSnap.size === 'number' ? usersSnap.size : docs.length;

  const counts = { missing: 0, desync: 0, invalidRegex: 0 };
  const samples = { missing: [], desync: [], invalidRegex: [] };
  const toFix = [];

  for (const userDoc of docs) {
    const classified = classifyDoc({ id: userDoc.id, data: userDoc.data() });
    if (!classified) continue;

    if (classified.missing) {
      counts.missing++;
      if (samples.missing.length < SAMPLE_LIMIT) {
        samples.missing.push({ id: classified.id, displayName: classified.displayName });
      }
      toFix.push({ id: classified.id, expectedLower: classified.expectedLower });
    } else if (classified.desync) {
      counts.desync++;
      if (samples.desync.length < SAMPLE_LIMIT) {
        samples.desync.push({
          id: classified.id,
          displayName: classified.displayName,
          currentLower: classified.currentLower,
          expectedLower: classified.expectedLower,
        });
      }
      toFix.push({ id: classified.id, expectedLower: classified.expectedLower });
    }

    if (classified.invalidRegex) {
      counts.invalidRegex++;
      if (samples.invalidRegex.length < SAMPLE_LIMIT) {
        samples.invalidRegex.push({ id: classified.id, displayName: classified.displayName });
      }
    }
  }

  return { total, counts, samples, toFix };
}

/**
 * Aplica las correcciones identificadas por `audit()`. Idempotente: si
 * `toFix` viene vacio, no commitea ningun batch (re-correr post-apply es
 * no-op).
 *
 * NO toca usuarios con `invalidRegex` — esa decision requiere intervencion
 * humana sobre el `displayName` visible.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ id: string, expectedLower: string }[]} toFix
 * @param {{ logger?: { log?: (...args: unknown[]) => void } }} [opts]
 * @returns {Promise<number>} cantidad de docs actualizados
 */
export async function applyMigration(db, toFix, opts = {}) {
  const logger = opts.logger ?? console;
  if (!Array.isArray(toFix) || toFix.length === 0) return 0;

  let batch = db.batch();
  let inBatch = 0;
  let committed = 0;

  for (const item of toFix) {
    const ref = db.collection('users').doc(item.id);
    batch.update(ref, { displayNameLower: item.expectedLower });
    inBatch++;

    if (inBatch >= BATCH_SIZE) {
      await batch.commit();
      committed += inBatch;
      logger.log?.(`Committed batch of ${inBatch} updates (total: ${committed})`);
      batch = db.batch();
      inBatch = 0;
    }
  }

  if (inBatch > 0) {
    await batch.commit();
    committed += inBatch;
    logger.log?.(`Committed final batch of ${inBatch} updates (total: ${committed})`);
  }

  return committed;
}

/**
 * Imprime el reporte de auditoria con un formato consistente.
 * @param {Awaited<ReturnType<typeof audit>>} report
 * @param {'audit' | 'apply'} mode
 * @param {{ log?: (...args: unknown[]) => void }} [logger=console]
 */
export function printAuditReport(report, mode, logger = console) {
  const log = logger.log ?? (() => {});
  log('Scanning users collection...');
  log(`Total users: ${report.total}`);
  log('');
  log('Issues:');
  log(`  Missing displayNameLower: ${report.counts.missing}`);
  log(`  Desynced (lower !== name.toLowerCase()): ${report.counts.desync}`);
  log(`  Invalid displayName regex (post-fix would block): ${report.counts.invalidRegex}`);
  log('');

  if (report.samples.missing.length > 0) {
    log(`Sample missing (max ${SAMPLE_LIMIT}):`);
    for (const s of report.samples.missing) {
      log(`  - ${s.id}: displayName="${s.displayName}"`);
    }
    log('');
  }

  if (report.samples.desync.length > 0) {
    log(`Sample desync (max ${SAMPLE_LIMIT}):`);
    for (const s of report.samples.desync) {
      log(`  - ${s.id}: displayName="${s.displayName}", currentLower="${s.currentLower}", expectedLower="${s.expectedLower}"`);
    }
    log('');
  }

  if (report.samples.invalidRegex.length > 0) {
    log(`Sample invalidRegex (max ${SAMPLE_LIMIT}):`);
    for (const s of report.samples.invalidRegex) {
      log(`  - ${s.id}: displayName="${s.displayName}"`);
    }
    log('');
  }

  if (mode === 'audit') {
    log('DRY RUN — no writes. Re-run with --apply to migrate `missing` and `desync`.');
    log('NOTE: `invalidRegex` is NOT auto-fixable (requires human review of visible displayName).');
  }
}

/**
 * Punto de entrada principal del script. Inyectable: el caller (CLI o test)
 * pasa `db`, `argv` y `env`. Devuelve un objeto resumen para que el caller
 * decida exit codes.
 *
 * @param {{
 *   db?: import('firebase-admin/firestore').Firestore,
 *   argv?: string[],
 *   env?: NodeJS.ProcessEnv,
 *   logger?: { log?: (...args: unknown[]) => void, error?: (...args: unknown[]) => void },
 * }} [opts]
 * @returns {Promise<{
 *   ok: true,
 *   mode: 'audit' | 'apply',
 *   report: Awaited<ReturnType<typeof audit>>,
 *   updated: number,
 * } | { ok: false, reason: 'missing-credentials' }>}
 */
export async function run(opts = {}) {
  const argv = opts.argv ?? process.argv.slice(2);
  const env = opts.env ?? process.env;
  const logger = opts.logger ?? console;

  if (!checkCredentials(env, logger)) {
    return { ok: false, reason: 'missing-credentials' };
  }

  const mode = parseMode(argv);
  const db = opts.db ?? getDb();

  const report = await audit(db);
  printAuditReport(report, mode, logger);

  let updated = 0;
  if (mode === 'apply') {
    updated = await applyMigration(db, report.toFix, { logger });
    logger.log?.(`Migration complete. Updated ${updated} of ${report.total} users.`);
  }

  return { ok: true, mode, report, updated };
}

// Guard de ejecucion directa via CLI. Cuando el archivo se importa desde un
// test runner (Vitest), `process.argv[1]` apunta al runner, no a este script,
// y el bloque no se ejecuta.
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await run();
    if (!result.ok) process.exit(1);
  } catch (e) {
    console.error(e?.message ?? e);
    process.exit(1);
  }
}
