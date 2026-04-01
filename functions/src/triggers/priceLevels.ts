import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { incrementCounter, trackWrite } from '../utils/counters';
import { checkRateLimit } from '../utils/rateLimiter';
import { logAbuse } from '../utils/abuseLogger';
import { trackFunctionTiming } from '../utils/perfTracker';

export const onPriceLevelCreated = onDocumentCreated(
  'priceLevels/{docId}',
  async (event) => {
    const startMs = performance.now();
    const db = getDb();
    const snap = event.data;
    if (!snap) return;
    const userId = snap.data().userId as string | undefined;

    if (userId) {
      const exceeded = await checkRateLimit(db, { collection: 'priceLevels', limit: 50, windowType: 'daily' }, userId);
      if (exceeded) {
        await snap.ref.delete();
        await logAbuse(db, { userId, type: 'rate_limit', collection: 'priceLevels', detail: 'Exceeded 50 priceLevels/day' });
        return;
      }
    }

    await incrementCounter(db, 'priceLevels', 1);
    await trackWrite(db, 'priceLevels');
    await trackFunctionTiming('onPriceLevelCreated', startMs);
  },
);

export const onPriceLevelUpdated = onDocumentUpdated(
  'priceLevels/{docId}',
  async () => {
    const startMs = performance.now();
    const db = getDb();
    await trackWrite(db, 'priceLevels');
    await trackFunctionTiming('onPriceLevelUpdated', startMs);
  },
);
