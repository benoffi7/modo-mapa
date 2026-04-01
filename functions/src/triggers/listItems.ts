import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { incrementCounter, trackWrite } from '../utils/counters';
import { logAbuse } from '../utils/abuseLogger';
import { trackFunctionTiming } from '../utils/perfTracker';

export const onListItemCreated = onDocumentCreated(
  'listItems/{itemId}',
  async (event) => {
    const startMs = performance.now();
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const db = getDb();
    const addedBy = data.addedBy as string | undefined;

    // Always increment counters (the write was already accepted by rules)
    await incrementCounter(db, 'listItems', 1);
    await trackWrite(db, 'listItems');

    // Rate limit: 100 listItems per day per user
    // Uses addedBy field (not userId) — query directly instead of checkRateLimit
    if (!addedBy) return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const snapshot = await db.collection('listItems')
      .where('addedBy', '==', addedBy)
      .where('createdAt', '>=', startOfDay)
      .count().get();
    const exceeded = snapshot.data().count > 100;

    if (exceeded) {
      // Delete the offending document FIRST (admin SDK bypasses rules)
      await snap.ref.delete();
      await logAbuse(db, {
        userId: addedBy,
        type: 'rate_limit',
        collection: 'listItems',
        detail: 'Exceeded 100 listItems/day — document deleted',
      });
    }
    await trackFunctionTiming('onListItemCreated', startMs);
  },
);
