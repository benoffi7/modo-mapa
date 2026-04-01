import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { checkRateLimit } from '../utils/rateLimiter';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';
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

export const onCheckInDeleted = onDocumentDeleted(
  'checkins/{checkinId}',
  async (event) => {
    const db = getDb();
    const snap = event.data;
    if (!snap) {
      await incrementCounter(db, 'checkins', -1);
      await trackDelete(db, 'checkins');
      return;
    }

    const data = snap.data();
    const userId = data.userId as string;

    // Rate limit check for deletes: 20 per day per user
    // We can't undo a delete, so we only log abuse when exceeded
    const today = new Date().toISOString().slice(0, 10);
    const deleteLimitRef = db.doc(`_rateLimits/checkin_delete_${userId}`);
    const limitSnap = await deleteLimitRef.get();
    const limitData = limitSnap.data();
    const deleteCount = limitData?.date === today ? (limitData.count as number) : 0;

    await deleteLimitRef.set({ date: today, count: deleteCount + 1 }, { merge: true });

    if (deleteCount >= 20) {
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'checkins_delete',
        detail: `Exceeded 20 checkin deletes/day (count: ${deleteCount + 1})`,
      });
    }

    await incrementCounter(db, 'checkins', -1);
    await trackDelete(db, 'checkins');
  },
);
