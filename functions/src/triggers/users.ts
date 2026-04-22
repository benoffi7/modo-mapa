import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { incrementCounter, trackWrite } from '../utils/counters';
import { trackFunctionTiming } from '../utils/perfTracker';

export const onUserCreated = onDocumentCreated(
  'users/{userId}',
  async (event) => {
    const startMs = performance.now();
    const db = getDb();
    await incrementCounter(db, 'users', 1);
    await trackWrite(db, 'users');

    // Add displayNameLower for search and initialize follow counters
    const data = event.data?.data();
    if (data?.displayName) {
      await event.data!.ref.update({
        displayNameLower: (data.displayName as string).toLowerCase(),
        followersCount: 0,
        followingCount: 0,
      });
    }
    await trackFunctionTiming('onUserCreated', startMs);
  },
);
