import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';

export const onFavoriteCreated = onDocumentCreated(
  'favorites/{favoriteId}',
  async () => {
    const db = getFirestore();
    await incrementCounter(db, 'favorites', 1);
    await trackWrite(db, 'favorites');
  },
);

export const onFavoriteDeleted = onDocumentDeleted(
  'favorites/{favoriteId}',
  async () => {
    const db = getFirestore();
    await incrementCounter(db, 'favorites', -1);
    await trackDelete(db, 'favorites');
  },
);
