import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { assertAdmin } from '../helpers/assertAdmin';
import { ENFORCE_APP_CHECK_ADMIN, getDb } from '../helpers/env';
import { checkCallableRateLimit } from '../utils/callableRateLimit';
import { logAbuse } from '../utils/abuseLogger';
import { captureException } from '../utils/sentry';
import { trackFunctionTiming } from '../utils/perfTracker';

// ── Types ─────────────────────────────────────────────────────────────

export interface AdminRateLimitItem {
  docId: string;
  category: string;
  userId: string;
  count: number;
  resetAt: number;
  windowActive: boolean;
}

interface AdminListRateLimitsRequest {
  userId?: string;
  limit?: number;
}

interface AdminListRateLimitsResponse {
  items: AdminRateLimitItem[];
}

interface AdminResetRateLimitRequest {
  docId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Known prefixes for `_rateLimits` doc IDs. Order matters — longer/compound
 * prefixes MUST come before their shorter cousins so `editors_invite_{uid}`
 * matches "editors_invite" and not "editors".
 */
const KNOWN_RATE_LIMIT_PREFIXES = [
  'moderation_edit',
  'editors_invite',
  'editors_remove',
  'rate_limits_list',
  'rate_limits_reset',
  'list_item_delete',
  'admin_rate_limits',
  'admin_rate_limit_reset',
  'admin_delete_list_item',
  'commentLikes_50d',
  'sharedLists',
  'comments',
  'backup',
  'perf',
  'delete',
  'clean',
] as const;

/**
 * Parses a `_rateLimits` docId into `{ category, userId }`.
 * Falls back to `category: 'unknown'` when no prefix matches.
 */
export function categorizeRateLimit(docId: string): { category: string; userId: string } {
  for (const prefix of KNOWN_RATE_LIMIT_PREFIXES) {
    const fullPrefix = `${prefix}_`;
    if (docId.startsWith(fullPrefix)) {
      return { category: prefix, userId: docId.slice(fullPrefix.length) };
    }
  }
  // Fallback — split on last underscore; uid is typically 20+ chars alnum.
  const lastUnderscore = docId.lastIndexOf('_');
  if (lastUnderscore > 0 && lastUnderscore < docId.length - 1) {
    return {
      category: docId.slice(0, lastUnderscore),
      userId: docId.slice(lastUnderscore + 1),
    };
  }
  return { category: 'unknown', userId: docId };
}

const UID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const DOC_ID_REGEX = /^[a-zA-Z0-9_-]{1,200}$/;

// ── Callables ─────────────────────────────────────────────────────────

/**
 * Lists active rate limit documents for admin inspection.
 * Admin-only. Rate-limited per admin (30/day) to discourage scraping.
 */
export const adminListRateLimits = onCall<AdminListRateLimitsRequest>(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, timeoutSeconds: 30 },
  async (request): Promise<AdminListRateLimitsResponse> => {
    const start = performance.now();
    const { auth, data } = request;
    const adminAuth = assertAdmin(auth);
    const db = getDb();

    // Validate input
    if (data?.userId !== undefined) {
      if (typeof data.userId !== 'string' || !UID_REGEX.test(data.userId)) {
        throw new HttpsError('invalid-argument', 'userId must be a valid uid string');
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
      `admin_rate_limits_${adminAuth.uid}`,
      30,
      adminAuth.uid,
    );

    try {
      // Query `_rateLimits` collection. If userId filter, match using `userId`
      // field first (set by checkCallableRateLimit); skip orderBy to avoid
      // needing a composite index. Otherwise scan all ordered by resetAt desc.
      const baseCol = db.collection('_rateLimits');
      const query = data?.userId
        ? baseCol.where('userId', '==', data.userId).limit(itemLimit)
        : baseCol.orderBy('resetAt', 'desc').limit(itemLimit);

      const snap = await query.get();
      const now = Date.now();

      const items: AdminRateLimitItem[] = snap.docs.map((doc) => {
        const docData = doc.data() as { count?: number; resetAt?: number; userId?: string } | undefined;
        const count = typeof docData?.count === 'number' ? docData.count : 0;
        const resetAt = typeof docData?.resetAt === 'number' ? docData.resetAt : 0;
        const { category, userId: parsedUserId } = categorizeRateLimit(doc.id);
        return {
          docId: doc.id,
          category,
          userId: docData?.userId ?? parsedUserId,
          count,
          resetAt,
          windowActive: now < resetAt,
        };
      });

      await trackFunctionTiming('adminListRateLimits', start);
      return { items };
    } catch (err) {
      captureException(err);
      logger.error('adminListRateLimits failed', { error: String(err) });
      await trackFunctionTiming('adminListRateLimits', start);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'No se pudo listar rate limits');
    }
  },
);

/**
 * Resets (deletes) a `_rateLimits` doc to unblock a user.
 * Admin-only. Rate-limited per admin (20/day) and writes an `abuseLog` for audit trail.
 */
export const adminResetRateLimit = onCall<AdminResetRateLimitRequest>(
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
      `admin_rate_limit_reset_${adminAuth.uid}`,
      20,
      adminAuth.uid,
    );

    try {
      const docRef = db.collection('_rateLimits').doc(data.docId);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw new HttpsError('not-found', 'Rate limit doc not found');
      }

      await docRef.delete();

      const { category, userId: targetUserId } = categorizeRateLimit(data.docId);
      await logAbuse(db, {
        userId: adminAuth.uid,
        type: 'config_edit',
        collection: '_rateLimits',
        detail: JSON.stringify({
          action: 'reset_rate_limit',
          docId: data.docId,
          category,
          targetUserId,
        }),
      });

      await trackFunctionTiming('adminResetRateLimit', start);
      return { success: true };
    } catch (err) {
      if (!(err instanceof HttpsError)) {
        captureException(err);
        logger.error('adminResetRateLimit failed', { error: String(err) });
      }
      await trackFunctionTiming('adminResetRateLimit', start);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'No se pudo resetear el rate limit');
    }
  },
);
