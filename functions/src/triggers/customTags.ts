import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { checkRateLimit } from '../utils/rateLimiter';
import { checkModeration } from '../utils/moderator';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';
import { logAbuse } from '../utils/abuseLogger';
import { trackFunctionTiming } from '../utils/perfTracker';

export const onCustomTagCreated = onDocumentCreated(
  'customTags/{tagId}',
  async (event) => {
    const startMs = performance.now();
    const db = getDb();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = data.userId as string;
    const businessId = data.businessId as string;

    // 1a. Rate limit: 10 custom tags per business per user
    const exceededPerEntity = await checkRateLimit(
      db,
      { collection: 'customTags', limit: 10, windowType: 'per_entity' },
      userId,
      businessId,
    );

    if (exceededPerEntity) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'customTags',
        detail: `Exceeded 10 customTags for business ${businessId}`,
      });
      return;
    }

    // 1b. Rate limit: 50 custom tags per day per user (across all businesses)
    const exceededDaily = await checkRateLimit(
      db,
      { collection: 'customTags', limit: 50, windowType: 'daily' },
      userId,
    );

    if (exceededDaily) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'customTags',
        detail: 'Exceeded 50 customTags/day',
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
    await trackFunctionTiming('onCustomTagCreated', startMs);
  },
);

export const onCustomTagDeleted = onDocumentDeleted(
  'customTags/{tagId}',
  async () => {
    const startMs = performance.now();
    const db = getDb();
    await incrementCounter(db, 'customTags', -1);
    await trackDelete(db, 'customTags');
    await trackFunctionTiming('onCustomTagDeleted', startMs);
  },
);
