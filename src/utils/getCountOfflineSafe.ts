import { getCountFromServer } from 'firebase/firestore';
import type { Query } from 'firebase/firestore';

/**
 * Wraps getCountFromServer with offline fallback.
 * Returns 0 when offline instead of throwing.
 */
export async function getCountOfflineSafe(q: Query): Promise<number> {
  if (!navigator.onLine) return 0;
  try {
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch {
    return 0;
  }
}
