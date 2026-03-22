import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { checkRateLimit } from '../utils/rateLimiter';
import { incrementCounter, trackWrite } from '../utils/counters';
import { logAbuse } from '../utils/abuseLogger';

export const onCheckInCreated = onDocumentCreated(
  'checkins/{checkinId}',
  async (event) => {
    const db = getDb();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = data.userId as string;

    // Rate limit: 10 check-ins per day per user
    const exceeded = await checkRateLimit(
      db,
      { collection: 'checkins', limit: 10, windowType: 'daily' },
      userId,
    );

    if (exceeded) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'checkins',
        detail: 'Exceeded daily check-in limit (10)',
      });
      return;
    }

    await incrementCounter(db, 'checkins', 1);
    await trackWrite(db, 'checkins');
  },
);
