import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { incrementCounter, trackWrite } from '../utils/counters';

export const onPriceLevelCreated = onDocumentCreated(
  'priceLevels/{docId}',
  async () => {
    const db = getFirestore();
    await incrementCounter(db, 'priceLevels', 1);
    await trackWrite(db, 'priceLevels');
  },
);

export const onPriceLevelUpdated = onDocumentUpdated(
  'priceLevels/{docId}',
  async () => {
    const db = getFirestore();
    await trackWrite(db, 'priceLevels');
  },
);
