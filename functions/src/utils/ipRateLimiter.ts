import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';

interface IpRateLimitConfig {
  action: string;
  limit: number;
}

/** Hash IP with SHA-256 for privacy (never store raw IPs) */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

/** Extract IP from a callable request */
export function extractIp(request: CallableRequest): string {
  return request.rawRequest?.ip || 'unknown';
}

/**
 * Check if an IP has exceeded the rate limit for a given action.
 * Uses _ipRateLimits collection with daily reset.
 * Returns true if the limit is exceeded.
 */
export async function checkIpRateLimit(
  db: Firestore,
  config: IpRateLimitConfig,
  rawIp: string,
): Promise<boolean> {
  if (rawIp === 'unknown') return false;

  const ipHash = hashIp(rawIp);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const docId = `${ipHash}_${config.action}_${today}`;
  const ref = db.collection('_ipRateLimits').doc(docId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? (snap.data()!.count as number) : 0;

    if (count >= config.limit) {
      return true; // exceeded
    }

    if (snap.exists) {
      tx.update(ref, { count: FieldValue.increment(1) });
    } else {
      tx.set(ref, {
        ipHash,
        action: config.action,
        date: today,
        count: 1,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return false;
  });

  return result;
}

/**
 * Get the current action count for an IP (for threshold checks without blocking).
 */
export async function getIpActionCount(
  db: Firestore,
  action: string,
  rawIp: string,
): Promise<number> {
  if (rawIp === 'unknown') return 0;

  const ipHash = hashIp(rawIp);
  const today = new Date().toISOString().slice(0, 10);
  const docId = `${ipHash}_${action}_${today}`;
  const snap = await db.collection('_ipRateLimits').doc(docId).get();

  return snap.exists ? (snap.data()!.count as number) : 0;
}
