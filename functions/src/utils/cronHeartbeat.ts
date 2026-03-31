import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../helpers/env';

/**
 * Wraps a scheduled function with heartbeat tracking.
 *
 * Writes execution status to `_cronRuns/{cronName}` after each run,
 * recording success/error result, duration, and optional detail string.
 */
export async function withCronHeartbeat(
  cronName: string,
  fn: () => Promise<string | void>,
): Promise<void> {
  const startTime = Date.now();
  try {
    const detail = await fn();
    const durationMs = Date.now() - startTime;
    await getDb().doc(`_cronRuns/${cronName}`).set(
      {
        lastRunAt: FieldValue.serverTimestamp(),
        result: 'success',
        detail: detail ?? '',
        durationMs,
      },
      { merge: true },
    );
  } catch (error: unknown) {
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    try {
      await getDb().doc(`_cronRuns/${cronName}`).set(
        {
          lastRunAt: FieldValue.serverTimestamp(),
          result: 'error',
          detail: message,
          durationMs,
        },
        { merge: true },
      );
    } catch {
      // Heartbeat write failed — log but don't mask the original error
      console.error(`[withCronHeartbeat] Failed to write error heartbeat for ${cronName}`);
    }
    throw error;
  }
}
