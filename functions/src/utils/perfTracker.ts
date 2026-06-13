import { getDb } from '../helpers/env';

/**
 * Tracks Cloud Function execution times in a counter doc.
 *
 * Accumulates timings in `config/perfCounters` as arrays keyed by function name.
 * The dailyMetrics scheduled function reads and resets these counters.
 *
 * Cap: keeps the last MAX_SAMPLES_PER_FUNCTION samples (truncates oldest in-handler)
 * so we never silently drop new samples once the cap is reached. Cap kept low (2000)
 * to bound the perfCounters doc size: a single field with 2000 numbers is ~30 KB,
 * well under Firestore's 1 MB document limit even with ~30 functions tracked.
 */
const MAX_SAMPLES_PER_FUNCTION = 2000;

export async function trackFunctionTiming(functionName: string, startMs: number): Promise<void> {
  try {
    const elapsed = Math.round(performance.now() - startMs);
    const db = getDb();
    const docRef = db.doc('config/perfCounters');

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const data = snap.data() ?? {};
      const existing: number[] = Array.isArray(data[functionName]) ? data[functionName] : [];

      // Truncate oldest samples in-handler so we never drop the new sample.
      // Keep the last (cap-1) plus the new one == cap.
      const kept = existing.length >= MAX_SAMPLES_PER_FUNCTION
        ? existing.slice(-(MAX_SAMPLES_PER_FUNCTION - 1))
        : existing;
      tx.set(docRef, { [functionName]: [...kept, elapsed] }, { merge: true });
    });
  } catch {
    // Best-effort — don't let perf tracking break the trigger
  }
}

/**
 * Calculates percentile from a sorted-or-unsorted number array.
 */
export function calculatePercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
