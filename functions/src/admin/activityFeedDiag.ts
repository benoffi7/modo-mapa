import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../helpers/assertAdmin';
import { ENFORCE_APP_CHECK_ADMIN, getDb } from '../helpers/env';

/**
 * Diagnostic callable to inspect a user's activity feed.
 * Admin-only. Returns items with expiry status.
 */
export const getActivityFeedDiag = onCall<{ userId: string; limit?: number }>(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, timeoutSeconds: 60 },
  async (request) => {
    const { auth, data } = request;
    assertAdmin(auth);
    const db = getDb();

    // Validate input
    if (!data.userId || typeof data.userId !== 'string') {
      throw new HttpsError('invalid-argument', 'userId is required and must be a string');
    }

    let itemLimit = 50;
    if (data.limit !== undefined) {
      if (typeof data.limit !== 'number' || data.limit < 1 || data.limit > 50) {
        throw new HttpsError('invalid-argument', 'limit must be a number between 1 and 50');
      }
      itemLimit = data.limit;
    }

    // Query activity feed
    const snap = await db
      .collection('activityFeed')
      .doc(data.userId)
      .collection('items')
      .orderBy('createdAt', 'desc')
      .limit(itemLimit)
      .get();

    const now = Date.now();

    const items = snap.docs.map((doc) => {
      const d = doc.data();
      const createdAt = d.createdAt?.toDate?.() ?? new Date(0);
      const expiresAt = d.expiresAt?.toDate?.() ?? new Date(0);

      return {
        id: doc.id,
        actorId: d.actorId ?? '',
        actorName: d.actorName ?? '',
        type: d.type ?? 'comment',
        businessId: d.businessId ?? '',
        businessName: d.businessName ?? '',
        referenceId: d.referenceId ?? '',
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        isExpired: expiresAt.getTime() < now,
      };
    });

    return { items, total: items.length };
  },
);
