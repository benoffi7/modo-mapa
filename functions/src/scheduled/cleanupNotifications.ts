import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getDb } from '../helpers/env';

export const cleanupExpiredNotifications = onSchedule(
  { schedule: '0 5 * * *', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => {
    const db = getDb();
    const now = new Date();

    const expired = await db.collection('notifications')
      .where('expiresAt', '<', now)
      .get();

    const batch = db.batch();
    for (const doc of expired.docs) {
      batch.delete(doc.ref);
    }

    if (expired.size > 0) {
      await batch.commit();
    }

    console.log(`Cleaned up ${expired.size} expired notifications`);
  },
);
