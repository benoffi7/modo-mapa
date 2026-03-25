import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';
import { incrementBusinessCount } from '../utils/aggregates';
import { fanOutToFollowers } from '../utils/fanOut';

export const onFavoriteCreated = onDocumentCreated(
  'favorites/{favoriteId}',
  async (event) => {
    const db = getDb();
    const data = event.data?.data();
    const businessId = data?.businessId as string | undefined;
    const userId = data?.userId as string | undefined;
    await incrementCounter(db, 'favorites', 1);
    await trackWrite(db, 'favorites');
    if (businessId) {
      await incrementBusinessCount(db, 'businessFavorites', businessId, 1);

      // Fan-out to followers
      if (userId) {
        const userSnap = await db.doc(`users/${userId}`).get();
        const actorName = userSnap.exists ? (userSnap.data()!.displayName as string) : 'Alguien';
        const bizSnap = await db.doc(`businesses/${businessId}`).get();
        const businessName = bizSnap.exists ? (bizSnap.data()!.name as string) : '';
        await fanOutToFollowers(db, {
          actorId: userId, actorName, type: 'favorite',
          businessId, businessName, referenceId: event.params.favoriteId,
        });
      }
    }
  },
);

export const onFavoriteDeleted = onDocumentDeleted(
  'favorites/{favoriteId}',
  async (event) => {
    const db = getDb();
    const businessId = event.data?.data().businessId as string | undefined;
    await incrementCounter(db, 'favorites', -1);
    await trackDelete(db, 'favorites');
    if (businessId) {
      await incrementBusinessCount(db, 'businessFavorites', businessId, -1);
    }
  },
);
