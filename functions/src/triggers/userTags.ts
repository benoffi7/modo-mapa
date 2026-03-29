import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { checkRateLimit } from '../utils/rateLimiter';
import { logAbuse } from '../utils/abuseLogger';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';

export const onUserTagCreated = onDocumentCreated(
  'userTags/{tagId}',
  async (event) => {
    const db = getDb();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = data.userId as string;

    // Rate limit: 100 userTags per day per user
    const exceeded = await checkRateLimit(
      db,
      { collection: 'userTags', limit: 100, windowType: 'daily' },
      userId,
    );

    if (exceeded) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'userTags',
        detail: 'Exceeded 100 userTags/day',
      });
      return;
    }

    await incrementCounter(db, 'userTags', 1);
    await trackWrite(db, 'userTags');
  },
);

export const onUserTagDeleted = onDocumentDeleted(
  'userTags/{tagId}',
  async () => {
    const db = getDb();
    await incrementCounter(db, 'userTags', -1);
    await trackDelete(db, 'userTags');
  },
);
