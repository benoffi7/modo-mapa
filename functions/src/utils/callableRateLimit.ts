import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Transactional daily rate limiter for Cloud Function callables.
 * Uses `_rateLimits` collection with atomic counter and daily window reset.
 *
 * @param db  Firestore instance
 * @param key Document ID under `_rateLimits` (e.g. `editors_invite_{userId}`)
 * @param limit Maximum allowed invocations per day
 * @throws HttpsError with code `resource-exhausted` when limit exceeded
 */
export async function checkCallableRateLimit(
  db: Firestore,
  key: string,
  limit: number,
): Promise<void> {
  const docRef = db.collection('_rateLimits').doc(key);
  const now = Date.now();
  const startOfTomorrow = new Date();
  startOfTomorrow.setHours(24, 0, 0, 0);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.data() as { count: number; resetAt: number } | undefined;

    if (!data || now >= data.resetAt) {
      tx.set(docRef, { count: 1, resetAt: startOfTomorrow.getTime() });
      return;
    }

    if (data.count >= limit) {
      throw new HttpsError('resource-exhausted', 'Limite diario alcanzado. Intenta manana.');
    }

    tx.update(docRef, { count: data.count + 1 });
  });
}
