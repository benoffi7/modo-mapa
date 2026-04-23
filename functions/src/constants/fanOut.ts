/**
 * Constants for fan-out dedup and recipient cap (#300 H-3).
 *
 * Dedup window prevents billing amplification when an actor with many followers
 * triggers the same (type, business) event multiple times per day.
 */
export const FANOUT_DEDUP_WINDOW_HOURS = 24;
export const FANOUT_DEDUP_WINDOW_MS = FANOUT_DEDUP_WINDOW_HOURS * 3_600_000;

/**
 * Max recipients per single fan-out action (conservative cap to bound write cost).
 * 500 = 250 recipients × 2 writes each (feed + dedup) stays within one Firestore batch limit,
 * and keeps per-invocation cost predictable.
 */
export const FANOUT_MAX_RECIPIENTS_PER_ACTION = 500;

/**
 * Max refs per db.getAll() call (Admin SDK hard limit).
 * Dedup reads are chunked in groups of this size and fetched in parallel.
 */
export const FANOUT_GETALL_CHUNK_SIZE = 30;
