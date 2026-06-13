#!/usr/bin/env node

/**
 * One-off backfill / audit script para `commentLikes.businessId` (#343).
 *
 * Cierra el guard #302 R3: la query nueva de likes filtra por
 * `(userId == auth.uid, businessId == bId)`. Los docs `commentLikes` legacy
 * (escritos antes de #343) no tienen `businessId`, asi que no aparecen en la
 * query nueva hasta que este script los backfillea.
 *
 * Sigue el patron canonico de `scripts/migrate-displayname-lower-sync.mjs`:
 *   - Modo `--audit` (default, read-only) y `--apply` (escribe correcciones).
 *   - Admin SDK via Application Default Credentials (ADC) — bypasea rules.
 *   - Idempotencia: re-correr `--apply` tras un exito previo es no-op (0 ops).
 *   - Bloque CLI gateado por `import.meta.url === file://${process.argv[1]}`.
 *   - Primitivas exportadas para testeo (`parseMode`, `getDb`, `audit`,
 *     `applyBackfill`, `printAuditReport`, `run`).
 *
 * Logica:
 *   - Cada doc de `commentLikes` con `businessId` string valido → skip.
 *   - Cada doc sin `businessId` → leer `comments/{commentId}.businessId`:
 *       - comment existe → categoria `toBackfill` (`batch.update(businessId)`).
 *       - comment NO existe → categoria `orphan` (`batch.delete`): un like sin
 *         comentario nunca volveria a leerse por la query nueva.
 *   - Reads de `comments` agrupados con `db.getAll(...refs)` en chunks de 30
 *     (mismo patron que `fanOutToFollowers` #312) para evitar N+1.
 *
 * Uso:
 *   gcloud auth application-default login
 *   node scripts/backfill-commentlikes-businessid.mjs            # audit (default)
 *   node scripts/backfill-commentlikes-businessid.mjs --audit
 *   node scripts/backfill-commentlikes-businessid.mjs --apply
 */

import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/** Limite del batch de Firestore (writes maximos por commit). */
export const BATCH_SIZE = 500;

/** Tamano de chunk para `getAll` de comments (mismo que FANOUT_GETALL_CHUNK_SIZE #312). */
export const GETALL_CHUNK_SIZE = 30;

/** Cap de writes/dia del free tier de Firestore. */
export const FREE_TIER_WRITES_PER_DAY = 20000;

/** Valida que businessId tenga el formato esperado (biz_NNN), igual que las rules. */
const BUSINESS_ID_REGEX = /^biz_[0-9]{1,6}$/;

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

/** Divide un array en chunks de tamano `size`. */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * Extrae el `commentId` de un doc de like: del campo `commentId` si existe,
 * o del doc id compuesto `{userId}__{commentId}`.
 * @param {{ id: string, data: Record<string, unknown> }} like
 * @returns {string | undefined}
 */
export function extractCommentId(like) {
  const data = like?.data ?? {};
  if (typeof data.commentId === 'string' && data.commentId.length > 0) return data.commentId;
  const parts = typeof like?.id === 'string' ? like.id.split('__') : [];
  return parts.length === 2 ? parts[1] : undefined;
}

/**
 * Recorre `commentLikes` y produce el reporte de auditoria.
 * NO escribe nada. Usado tanto en modo `audit` como precondicion de `apply`.
 *
 * Clasifica cada doc:
 *   - `withBusinessId`: ya tiene `businessId` string valido → skip (idempotencia).
 *   - `toBackfill`: sin businessId, comment existe → `{ likeId, businessId }`.
 *   - `orphan`: sin businessId, comment borrado/sin commentId → `{ likeId }`.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {Promise<{
 *   total: number,
 *   withBusinessId: number,
 *   toBackfill: { likeId: string, businessId: string }[],
 *   orphan: { likeId: string }[],
 * }>}
 */
export async function audit(db) {
  const likesSnap = await db.collection('commentLikes').get();
  const docs = likesSnap.docs ?? [];
  const total = typeof likesSnap.size === 'number' ? likesSnap.size : docs.length;

  let withBusinessId = 0;
  /** @type {{ likeId: string, commentId: string }[]} */
  const candidates = [];

  for (const likeDoc of docs) {
    const data = likeDoc.data();
    if (typeof data.businessId === 'string' && BUSINESS_ID_REGEX.test(data.businessId)) {
      withBusinessId++;
      continue;
    }
    const commentId = extractCommentId({ id: likeDoc.id, data });
    candidates.push({ likeId: likeDoc.id, commentId });
  }

  // Resolver los comments en chunks de 30 via getAll (evita N+1).
  /** @type {{ likeId: string, businessId: string }[]} */
  const toBackfill = [];
  /** @type {{ likeId: string }[]} */
  const orphan = [];

  // Candidatos sin commentId derivable → orphan directo (no se puede resolver).
  const resolvable = candidates.filter((c) => typeof c.commentId === 'string');
  for (const c of candidates) {
    if (typeof c.commentId !== 'string') orphan.push({ likeId: c.likeId });
  }

  for (const group of chunk(resolvable, GETALL_CHUNK_SIZE)) {
    const refs = group.map((c) => db.collection('comments').doc(c.commentId));
    const commentDocs = await db.getAll(...refs);
    group.forEach((c, idx) => {
      const commentDoc = commentDocs[idx];
      const exists = typeof commentDoc?.exists === 'function' ? commentDoc.exists() : commentDoc?.exists;
      const commentData = typeof commentDoc?.data === 'function' ? commentDoc.data() : undefined;
      const businessId = commentData?.businessId;
      if (exists && typeof businessId === 'string' && businessId.length > 0) {
        toBackfill.push({ likeId: c.likeId, businessId });
      } else {
        orphan.push({ likeId: c.likeId });
      }
    });
  }

  return { total, withBusinessId, toBackfill, orphan };
}

/**
 * Aplica el backfill identificado por `audit()`. Idempotente: si no hay ops,
 * no commitea ningun batch (re-correr post-apply es no-op).
 *
 *   - `toBackfill` → `batch.update(ref, { businessId })`.
 *   - `orphan`     → `batch.delete(ref)`.
 *
 * Commit cada `BATCH_SIZE` ops.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{ toBackfill: { likeId: string, businessId: string }[], orphan: { likeId: string }[] }} plan
 * @param {{ logger?: { log?: (...args: unknown[]) => void, error?: (...args: unknown[]) => void } }} [opts]
 * @returns {Promise<{ updated: number, deleted: number }>}
 */
export async function applyBackfill(db, plan, opts = {}) {
  const logger = opts.logger ?? console;
  const toBackfill = plan?.toBackfill ?? [];
  const orphan = plan?.orphan ?? [];

  const ops = [
    ...toBackfill.map((b) => ({ kind: 'update', likeId: b.likeId, businessId: b.businessId })),
    ...orphan.map((o) => ({ kind: 'delete', likeId: o.likeId })),
  ];

  if (ops.length === 0) return { updated: 0, deleted: 0 };

  let batch = db.batch();
  let inBatch = 0;
  let committed = 0;
  let updated = 0;
  let deleted = 0;

  const flush = async (final) => {
    if (inBatch === 0) return;
    try {
      await batch.commit();
    } catch (error) {
      logger.error?.(`Batch failed at ${committed} ops committed, ${ops.length - committed} pending`, error);
      throw error;
    }
    committed += inBatch;
    logger.log?.(`Committed ${final ? 'final ' : ''}batch of ${inBatch} ops (total: ${committed})`);
    batch = db.batch();
    inBatch = 0;
  };

  for (const op of ops) {
    const ref = db.collection('commentLikes').doc(op.likeId);
    if (op.kind === 'update') {
      batch.update(ref, { businessId: op.businessId });
      updated++;
    } else {
      batch.delete(ref);
      deleted++;
    }
    inBatch++;
    if (inBatch >= BATCH_SIZE) await flush(false);
  }
  await flush(true);

  return { updated, deleted };
}

/**
 * Imprime el reporte de auditoria con un formato consistente.
 * @param {Awaited<ReturnType<typeof audit>>} report
 * @param {'audit' | 'apply'} mode
 * @param {{ log?: (...args: unknown[]) => void }} [logger=console]
 */
export function printAuditReport(report, mode, logger = console) {
  const log = logger.log ?? (() => {});
  const toBackfill = report.toBackfill?.length ?? 0;
  const orphan = report.orphan?.length ?? 0;
  const legacy = toBackfill + orphan;

  log('Scanning commentLikes collection...');
  log(`Total commentLikes: ${report.total}`);
  log('');
  log('Clasificacion:');
  log(`  Con businessId valido (skip): ${report.withBusinessId}`);
  log(`  A backfillear (comment existe): ${toBackfill}`);
  log(`  Huerfanos a eliminar (comment borrado): ${orphan}`);
  log('');
  log(`Legacy docs a escribir: ${legacy}. Cap free tier writes/dia: ${FREE_TIER_WRITES_PER_DAY}. Ventanear si N supera el cap.`);
  log('');

  if (mode === 'audit') {
    log('DRY RUN — no writes. Re-run with --apply para backfillear y limpiar huerfanos.');
  }
}

/**
 * Punto de entrada principal del script. Inyectable: el caller (CLI o test)
 * pasa `db`, `argv`. Devuelve un objeto resumen para que el caller decida
 * exit codes.
 *
 * @param {{
 *   db?: import('firebase-admin/firestore').Firestore,
 *   argv?: string[],
 *   logger?: { log?: (...args: unknown[]) => void, error?: (...args: unknown[]) => void },
 * }} [opts]
 * @returns {Promise<{
 *   ok: true,
 *   mode: 'audit' | 'apply',
 *   report: Awaited<ReturnType<typeof audit>>,
 *   updated: number,
 *   deleted: number,
 * }>}
 */
export async function run(opts = {}) {
  const argv = opts.argv ?? process.argv.slice(2);
  const logger = opts.logger ?? console;

  const mode = parseMode(argv);
  const db = opts.db ?? getDb();

  const report = await audit(db);
  printAuditReport(report, mode, logger);

  let updated = 0;
  let deleted = 0;
  if (mode === 'apply') {
    const result = await applyBackfill(db, report, { logger });
    updated = result.updated;
    deleted = result.deleted;
    logger.log?.(`Backfill complete. Updated ${updated}, deleted ${deleted} orphans (total ${report.total} docs).`);
  }

  return { ok: true, mode, report, updated, deleted };
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
