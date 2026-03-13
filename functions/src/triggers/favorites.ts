import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';
import { incrementBusinessCount } from '../utils/aggregates';

export const onFavoriteCreated = onDocumentCreated(
  'favorites/{favoriteId}',
  async (event) => {
    const db = getFirestore();
    const businessId = event.data?.data().businessId as string | undefined;
    await incrementCounter(db, 'favorites', 1);
    await trackWrite(db, 'favorites');
    if (businessId) {
      await incrementBusinessCount(db, 'businessFavorites', businessId, 1);
    }
  },
);

export const onFavoriteDeleted = onDocumentDeleted(
  'favorites/{favoriteId}',
  async (event) => {
    const db = getFirestore();
    const businessId = event.data?.data().businessId as string | undefined;
    await incrementCounter(db, 'favorites', -1);
    await trackDelete(db, 'favorites');
    if (businessId) {
      await incrementBusinessCount(db, 'businessFavorites', businessId, -1);
    }
  },
);
