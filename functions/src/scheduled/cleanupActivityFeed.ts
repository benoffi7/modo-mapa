import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getDb } from '../helpers/env';

export const cleanupActivityFeed = onSchedule(
  { schedule: '0 5 * * *', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => {
    const db = getDb();
    const now = new Date();

    // Collection group query on 'items' subcollection
    const expired = await db.collectionGroup('items')
      .where('expiresAt', '<', now)
      .limit(500)
      .get();

    if (expired.empty) {
      console.log('No expired activity feed items to clean up');
      return;
    }

    const batch = db.batch();
    for (const doc of expired.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    console.log(`Cleaned up ${expired.size} expired activity feed items`);
  },
);
