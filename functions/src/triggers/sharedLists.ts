import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { incrementCounter, trackWrite } from '../utils/counters';
import { logAbuse } from '../utils/abuseLogger';
import { trackFunctionTiming } from '../utils/perfTracker';

export const onSharedListCreated = onDocumentCreated(
  'sharedLists/{listId}',
  async (event) => {
    const startMs = performance.now();
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const db = getDb();
    const ownerId = data.ownerId as string | undefined;

    await incrementCounter(db, 'sharedLists', 1);
    await trackWrite(db, 'sharedLists');

    if (!ownerId) return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const snapshot = await db.collection('sharedLists')
      .where('ownerId', '==', ownerId)
      .where('createdAt', '>=', startOfDay)
      .count().get();
    const exceeded = snapshot.data().count > 10;

    if (exceeded) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId: ownerId,
        type: 'rate_limit',
        collection: 'sharedLists',
        detail: 'Exceeded 10 sharedLists/day — document deleted',
      });
    }
    await trackFunctionTiming('onSharedListCreated', startMs);
  },
);
