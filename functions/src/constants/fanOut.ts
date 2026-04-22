/**
 * Constants for fan-out dedup and recipient cap (#300 H-3).
 *
 * Dedup window prevents billing amplification when an actor with many followers
 * triggers the same (type, business) event multiple times per day.
 */
export const FANOUT_DEDUP_WINDOW_HOURS = 24;
export const FANOUT_DEDUP_WINDOW_MS = FANOUT_DEDUP_WINDOW_HOURS * 3_600_000;

/** Max recipients per single fan-out action (hard cap to bound write cost). */
export const FANOUT_MAX_RECIPIENTS_PER_ACTION = 5000;
