import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * Tracks Cloud Function execution times in a counter doc.
 *
 * Accumulates timings in `config/perfCounters` as arrays keyed by function name.
 * The dailyMetrics scheduled function reads and resets these counters.
 */
export async function trackFunctionTiming(functionName: string, startMs: number): Promise<void> {
  try {
    const elapsed = performance.now() - startMs;
    const db = getFirestore();

    await db.doc('config/perfCounters').set(
      { [functionName]: FieldValue.arrayUnion(Math.round(elapsed)) },
      { merge: true },
    );
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
