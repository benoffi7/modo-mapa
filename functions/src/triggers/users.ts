import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { incrementCounter, trackWrite } from '../utils/counters';

export const onUserCreated = onDocumentCreated(
  'users/{userId}',
  async () => {
    const db = getFirestore();
    await incrementCounter(db, 'users', 1);
    await trackWrite(db, 'users');
  },
);
