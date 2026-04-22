import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { CallableRequest } from 'firebase-functions/v2/https';

interface IpRateLimitConfig {
  action: string;
  limit: number;
}

/**
 * Detect IPv6 address (excluding IPv4-mapped `::ffff:`).
 * IPv4-mapped IPv6 should be treated as IPv4 for bucketing purposes.
 */
export function isIpv6(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  if (!ip.includes(':')) return false;
  // IPv4-mapped IPv6 (e.g. `::ffff:192.0.2.1`) — treat as IPv4
  if (ip.toLowerCase().startsWith('::ffff:')) return false;
  return true;
}

/**
 * Bucket an IPv6 address to its /64 prefix (first 4 hextets).
 * Strips zone id (`%eth0`) and normalizes to lowercase.
 *
 * Rationale: IPv6 /128 rotation by attackers trivially bypasses rate-limits.
 * Residential/mobile IPv6 allocations are at least /64, so bucketing
 * to /64 groups traffic from the same subscriber.
 */
export function bucketIpv6(ip: string): string {
  const stripped = ip.split('%')[0].toLowerCase();
  // Expand `::` to missing zero hextets if present, but only to the extent needed
  // to extract first 4 hextets safely.
  const parts = stripped.split(':');
  const doubleColonIdx = stripped.indexOf('::');

  if (doubleColonIdx === -1) {
    // Full form — take first 4 hextets
    return parts.slice(0, 4).join(':');
  }

  // `::` shorthand — split on `::` and reconstruct
  const [head, tail] = stripped.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const zerosNeeded = 8 - headParts.length - tailParts.length;
  const zeros = Array<string>(Math.max(0, zerosNeeded)).fill('0');
  const full = [...headParts, ...zeros, ...tailParts];
  return full.slice(0, 4).join(':');
}

/** Hash IP with SHA-256 for privacy (never store raw IPs).
 *
 *  For IPv6, bucket to /64 before hashing so that a single subscriber
 *  rotating /128 addresses cannot bypass the rate limit (#300 H-4).
 *  IPv4 and IPv4-mapped IPv6 are hashed as-is.
 */
export function hashIp(ip: string): string {
  const input = isIpv6(ip) ? bucketIpv6(ip) : ip;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
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
