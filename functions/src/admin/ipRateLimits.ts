import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { assertAdmin } from '../helpers/assertAdmin';
import { ENFORCE_APP_CHECK_ADMIN, getDb } from '../helpers/env';
import { checkCallableRateLimit } from '../utils/callableRateLimit';
import { logAbuse } from '../utils/abuseLogger';
import { captureException } from '../utils/sentry';
import { trackFunctionTiming } from '../utils/perfTracker';

// ── Types ─────────────────────────────────────────────────────────────

export interface AdminIpRateLimitItem {
  docId: string; // {ipHash}_{action}_{date}
  ipHash: string; // 16 hex chars
  action: string; // e.g. 'anon_create'
  date: string; // 'YYYY-MM-DD'
  count: number;
  windowActive: boolean; // date === todayUTC ('YYYY-MM-DD')
}

interface AdminListIpRateLimitsRequest {
  action?: string;
  ipHash?: string;
  limit?: number;
}

interface AdminListIpRateLimitsResponse {
  items: AdminIpRateLimitItem[];
}

interface AdminResetIpRateLimitRequest {
  docId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

const ACTION_REGEX = /^[a-z0-9_]{1,40}$/;
const IP_HASH_REGEX = /^[a-f0-9]{16}$/;
// Local duplicate (no-append): NOT imported from `rateLimits.ts`.
const DOC_ID_REGEX = /^[a-zA-Z0-9_-]{1,200}$/;

/** Today as `YYYY-MM-DD` in UTC, matching `ipRateLimiter.ts`. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Parses an `_ipRateLimits` docId `{ipHash}_{action}_{date}` into its parts.
 *
 * `action` itself contains underscores (e.g. `anon_create`), so a naive split
 * on `_` would mis-parse it. We take `ipHash` = first segment, `date` = last
 * segment, and `action` = everything in between joined by `_`. Best-effort —
 * used only for the audit detail of `adminResetIpRateLimit`.
 */
export function parseIpRateLimitDocId(docId: string): {
  ipHash: string;
  action: string;
  date: string;
} {
  const parts = docId.split('_');
  if (parts.length < 3) {
    return { ipHash: parts[0] ?? docId, action: '', date: parts[parts.length - 1] ?? '' };
  }
  return {
    ipHash: parts[0],
    action: parts.slice(1, -1).join('_'),
    date: parts[parts.length - 1],
  };
}

// ── Callables ─────────────────────────────────────────────────────────

/**
 * Lists `_ipRateLimits` documents for admin inspection (#348).
 * Admin-only. Rate-limited per admin (30/day) to discourage scraping.
 * Privacy: only exposes `ipHash` — never raw IPs (the collection never stores them).
 */
export const adminListIpRateLimits = onCall<AdminListIpRateLimitsRequest>(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, timeoutSeconds: 30 },
  async (request): Promise<AdminListIpRateLimitsResponse> => {
    const start = performance.now();
    const { auth, data } = request;
    const adminAuth = assertAdmin(auth);
    const db = getDb();

    // Validate input
    if (data?.action !== undefined) {
      if (typeof data.action !== 'string' || !ACTION_REGEX.test(data.action)) {
        throw new HttpsError('invalid-argument', 'action must be a valid action string');
      }
    }
    if (data?.ipHash !== undefined) {
      // NEVER accept raw IPs — only the 16-hex SHA-256 hash.
      if (typeof data.ipHash !== 'string' || !IP_HASH_REGEX.test(data.ipHash)) {
        throw new HttpsError('invalid-argument', 'ipHash must be 16 hex chars');
      }
    }

    let itemLimit = 50;
    if (data?.limit !== undefined) {
      if (typeof data.limit !== 'number' || !Number.isFinite(data.limit)) {
        throw new HttpsError('invalid-argument', 'limit must be a number');
      }
      // Clamp to [1, 100]
      itemLimit = Math.max(1, Math.min(100, Math.floor(data.limit)));
    }

    // Rate limit the callable itself
    await checkCallableRateLimit(
      db,
      `admin_ip_rate_limits_${adminAuth.uid}`,
      30,
      adminAuth.uid,
    );

    try {
      // Query `_ipRateLimits` without a composite index (mirror of
      // adminListRateLimits): a single `where` OR a single `orderBy`, never
      // combined on different fields. When both `ipHash` + `action` are
      // present, filter `action` client-side post-fetch over the `ipHash`
      // result, so no `ipHash+action` composite index is required.
      const baseCol = db.collection('_ipRateLimits');
      let query;
      if (data?.ipHash) {
        query = baseCol.where('ipHash', '==', data.ipHash).limit(itemLimit);
      } else if (data?.action) {
        query = baseCol.where('action', '==', data.action).limit(itemLimit);
      } else {
        // NOTE (Diego obs #1): `orderBy('date','desc')` has no tie-breaker —
        // docs sharing the same `date` (today's) have a non-deterministic order
        // between hashes. Acceptable for a low-volume admin inspector with a
        // `limit`. Do NOT add a composite orderBy (would require an index).
        query = baseCol.orderBy('date', 'desc').limit(itemLimit);
      }

      const snap = await query.get();
      const today = todayUtc();

      let items: AdminIpRateLimitItem[] = snap.docs.map((doc) => {
        const docData = doc.data() as
          | { ipHash?: string; action?: string; date?: string; count?: number }
          | undefined;
        const date = typeof docData?.date === 'string' ? docData.date : '';
        return {
          docId: doc.id,
          ipHash: typeof docData?.ipHash === 'string' ? docData.ipHash : '',
          action: typeof docData?.action === 'string' ? docData.action : '',
          date,
          count: typeof docData?.count === 'number' ? docData.count : 0,
          windowActive: date === today,
        };
      });

      // Client-side `action` filter when both filters provided (avoids
      // composite index).
      if (data?.ipHash && data?.action) {
        items = items.filter((item) => item.action === data.action);
      }

      await trackFunctionTiming('adminListIpRateLimits', start);
      return { items };
    } catch (err) {
      captureException(err);
      logger.error('adminListIpRateLimits failed', { error: String(err) });
      await trackFunctionTiming('adminListIpRateLimits', start);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'No se pudo listar IP rate limits');
    }
  },
);

/**
 * Resets (deletes) an `_ipRateLimits` doc to unblock an IP+action (#348).
 * Admin-only. Rate-limited per admin (20/day) and writes an `abuseLog` for
 * audit trail. Unblocks a legitimately limited IP (corporate NAT, shared
 * office) before the daily window auto-resets.
 */
export const adminResetIpRateLimit = onCall<AdminResetIpRateLimitRequest>(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, timeoutSeconds: 30 },
  async (request): Promise<{ success: true }> => {
    const start = performance.now();
    const { auth, data } = request;
    const adminAuth = assertAdmin(auth);
    const db = getDb();

    // Validate input
    if (!data || typeof data.docId !== 'string' || data.docId.length === 0) {
      throw new HttpsError('invalid-argument', 'docId is required');
    }
    if (!DOC_ID_REGEX.test(data.docId)) {
      throw new HttpsError('invalid-argument', 'docId contains invalid characters');
    }

    // Rate limit the callable itself
    await checkCallableRateLimit(
      db,
      `admin_ip_rate_limit_reset_${adminAuth.uid}`,
      20,
      adminAuth.uid,
    );

    try {
      const docRef = db.collection('_ipRateLimits').doc(data.docId);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw new HttpsError('not-found', 'IP rate limit doc not found');
      }

      await docRef.delete();

      const { ipHash, action: ipAction } = parseIpRateLimitDocId(data.docId);
      await logAbuse(db, {
        userId: adminAuth.uid,
        type: 'config_edit',
        collection: '_ipRateLimits',
        detail: JSON.stringify({
          action: 'reset_ip_rate_limit',
          docId: data.docId,
          ipHash,
          ipAction,
        }),
      });

      await trackFunctionTiming('adminResetIpRateLimit', start);
      return { success: true };
    } catch (err) {
      if (!(err instanceof HttpsError)) {
        captureException(err);
        logger.error('adminResetIpRateLimit failed', { error: String(err) });
      }
      await trackFunctionTiming('adminResetIpRateLimit', start);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'No se pudo resetear el IP rate limit');
    }
  },
);
