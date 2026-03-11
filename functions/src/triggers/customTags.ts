import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { checkRateLimit } from '../utils/rateLimiter';
import { checkModeration } from '../utils/moderator';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';
import { logAbuse } from '../utils/abuseLogger';

export const onCustomTagCreated = onDocumentCreated(
  'customTags/{tagId}',
  async (event) => {
    const db = getFirestore();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = data.userId as string;
    const businessId = data.businessId as string;

    // 1. Rate limit: 10 custom tags per business per user
    const exceeded = await checkRateLimit(
      db,
      { collection: 'customTags', limit: 10, windowType: 'per_entity' },
      userId,
      businessId,
    );

    if (exceeded) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'customTags',
        detail: `Exceeded 10 customTags for business ${businessId}`,
      });
      return;
    }

    // 2. Content moderation on label
    const flagged = await checkModeration(db, data.label as string);
    if (flagged) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId,
        type: 'flagged',
        collection: 'customTags',
        detail: `Flagged label: "${data.label as string}"`,
      });
      return;
    }

    // 3. Counters
    await incrementCounter(db, 'customTags', 1);
    await trackWrite(db, 'customTags');
  },
);

export const onCustomTagDeleted = onDocumentDeleted(
  'customTags/{tagId}',
  async () => {
    const db = getFirestore();
    await incrementCounter(db, 'customTags', -1);
    await trackDelete(db, 'customTags');
  },
);
