/**
 * Constants for fan-out dedup and recipient cap (#300 H-3).
 *
 * Dedup window prevents billing amplification when an actor with many followers
 * triggers the same (type, business) event multiple times per day.
 */
export const FANOUT_DEDUP_WINDOW_HOURS = 24;
export const FANOUT_DEDUP_WINDOW_MS = FANOUT_DEDUP_WINDOW_HOURS * 3_600_000;

/**
 * Max recipients per fan-out action (product decision — caps blast radius).
 *
 * Arithmetic: 500 recipients × 2 writes (feed + dedup) = 1000 writes total,
 * which triggers 2 Firestore batched commits of BATCH_COMMIT_MAX_OPS (500 ops each).
 *
 * Separate from BATCH_COMMIT_MAX_OPS (defined in utils/fanOut.ts), which is
 * the SDK-imposed per-batch cap. This constant is the business-level cap.
 */
export const FANOUT_MAX_RECIPIENTS_PER_ACTION = 500;

/**
 * Max refs per db.getAll() call (Admin SDK hard limit).
 * Dedup reads are chunked in groups of this size and fetched in parallel.
 */
export const FANOUT_GETALL_CHUNK_SIZE = 30;
