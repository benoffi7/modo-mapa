import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { incrementCounter, trackWrite } from '../utils/counters';

export const onUserCreated = onDocumentCreated(
  'users/{userId}',
  async () => {
    const db = getDb();
    await incrementCounter(db, 'users', 1);
    await trackWrite(db, 'users');
  },
);
