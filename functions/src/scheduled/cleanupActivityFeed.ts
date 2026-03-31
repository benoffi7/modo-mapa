import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getDb } from '../helpers/env';
import { withCronHeartbeat } from '../utils/cronHeartbeat';

async function run(): Promise<string> {
  const db = getDb();
  const now = new Date();

  // Collection group query on 'items' subcollection
  const expired = await db.collectionGroup('items')
    .where('expiresAt', '<', now)
    .limit(500)
    .get();

  if (expired.empty) {
    return 'No expired activity feed items to clean up';
  }

  const batch = db.batch();
  let count = 0;
  for (const doc of expired.docs) {
    // Only delete docs under activityFeed/*/items (not other 'items' subcollections)
    if (doc.ref.parent.parent?.parent?.id === 'activityFeed') {
      batch.delete(doc.ref);
      count++;
    }
  }
  if (count === 0) {
    return 'No expired activity feed items to clean up';
  }
  await batch.commit();

  return `Cleaned up ${count} expired activity feed items`;
}

export const cleanupActivityFeed = onSchedule(
  { schedule: '0 5 * * *', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => {
    await withCronHeartbeat('cleanupActivityFeed', run);
  },
);
