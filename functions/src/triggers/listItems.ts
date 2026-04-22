import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { incrementCounter, trackWrite } from '../utils/counters';
import { logAbuse } from '../utils/abuseLogger';
import { trackFunctionTiming } from '../utils/perfTracker';

const DAILY_LIMIT = 100;

export const onListItemCreated = onDocumentCreated(
  'listItems/{itemId}',
  async (event) => {
    const startMs = performance.now();
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const db = getDb();
    const addedBy = data.addedBy as string | undefined;

    // #300 M-5: rate limit ANTES de incrementar counter para evitar drift
    // cuando se excede el limite. Antes: siempre incrementaba y luego borraba.
    if (addedBy) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const countSnap = await db.collection('listItems')
        .where('addedBy', '==', addedBy)
        .where('createdAt', '>=', startOfDay)
        .count().get();
      const exceeded = countSnap.data().count >= DAILY_LIMIT;

      if (exceeded) {
        // Delete the offending document FIRST (admin SDK bypasses rules)
        await snap.ref.delete();
        await logAbuse(db, {
          userId: addedBy,
          type: 'rate_limit',
          collection: 'listItems',
          detail: `Exceeded ${DAILY_LIMIT} listItems/day — document deleted`,
        });
        await trackFunctionTiming('onListItemCreated', startMs);
        return; // do NOT incrementCounter when rate-limited
      }
    }

    // Rate limit ok (or no addedBy to limit) — increment counters
    await incrementCounter(db, 'listItems', 1);
    await trackWrite(db, 'listItems');

    await trackFunctionTiming('onListItemCreated', startMs);
  },
);
