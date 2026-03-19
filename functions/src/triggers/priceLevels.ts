import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { incrementCounter, trackWrite } from '../utils/counters';

export const onPriceLevelCreated = onDocumentCreated(
  'priceLevels/{docId}',
  async () => {
    const db = getDb();
    await incrementCounter(db, 'priceLevels', 1);
    await trackWrite(db, 'priceLevels');
  },
);

export const onPriceLevelUpdated = onDocumentUpdated(
  'priceLevels/{docId}',
  async () => {
    const db = getDb();
    await trackWrite(db, 'priceLevels');
  },
);
