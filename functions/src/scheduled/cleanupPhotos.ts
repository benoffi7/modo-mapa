import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getDb } from '../helpers/env';
import { getStorage } from 'firebase-admin/storage';
import { withCronHeartbeat } from '../utils/cronHeartbeat';

async function run(): Promise<string> {
  const db = getDb();
  const bucket = getStorage().bucket();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const rejected = await db.collection('menuPhotos')
    .where('status', '==', 'rejected')
    .where('reviewedAt', '<', sevenDaysAgo)
    .get();

  for (const doc of rejected.docs) {
    const data = doc.data();
    try {
      await bucket.file(data.storagePath).delete();
      if (data.thumbnailPath) {
        await bucket.file(data.thumbnailPath).delete();
      }
    } catch { /* file may not exist */ }
    await doc.ref.delete();
  }

  return `Cleaned up ${rejected.size} rejected photos`;
}

export const cleanupRejectedPhotos = onSchedule(
  { schedule: '0 4 * * *', timeZone: 'America/Argentina/Buenos_Aires' },
  async () => {
    await withCronHeartbeat('cleanupRejectedPhotos', run);
  },
);
