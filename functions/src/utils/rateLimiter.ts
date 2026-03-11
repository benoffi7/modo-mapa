import type { Firestore } from 'firebase-admin/firestore';

export interface RateLimitConfig {
  collection: string;
  limit: number;
  windowType: 'daily' | 'per_entity';
}

function getStartOfDay(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Checks if a user has exceeded the rate limit.
 * Returns true if the limit is EXCEEDED (caller should delete the doc).
 */
export async function checkRateLimit(
  db: Firestore,
  config: RateLimitConfig,
  userId: string,
  entityId?: string,
): Promise<boolean> {
  const ref = db.collection(config.collection);

  let q = ref.where('userId', '==', userId);

  if (config.windowType === 'daily') {
    q = q.where('createdAt', '>=', getStartOfDay());
  } else if (config.windowType === 'per_entity' && entityId) {
    q = q.where('businessId', '==', entityId);
  }

  const snapshot = await q.count().get();
  const count = snapshot.data().count;

  // The newly created doc is already in the collection, so count includes it.
  // Limit of 20 means docs 1-20 are OK, doc 21 exceeds.
  return count > config.limit;
}
