import { getDb } from '../helpers/env';

/**
 * Tracks Cloud Function execution times in a counter doc.
 *
 * Accumulates timings in `config/perfCounters` as arrays keyed by function name.
 * The dailyMetrics scheduled function reads and resets these counters.
 */
const MAX_SAMPLES_PER_FUNCTION = 5000;

export async function trackFunctionTiming(functionName: string, startMs: number): Promise<void> {
  try {
    const elapsed = Math.round(performance.now() - startMs);
    const db = getDb();
    const docRef = db.doc('config/perfCounters');

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      const data = snap.data() ?? {};
      const existing: number[] = Array.isArray(data[functionName]) ? data[functionName] : [];

      if (existing.length >= MAX_SAMPLES_PER_FUNCTION) return; // safety bound
      tx.set(docRef, { [functionName]: [...existing, elapsed] }, { merge: true });
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
