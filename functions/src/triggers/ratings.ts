import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';

export const onRatingWritten = onDocumentWritten(
  'ratings/{ratingId}',
  async (event) => {
    const db = getFirestore();
    const before = event.data?.before?.exists;
    const after = event.data?.after?.exists;

    if (!before && after) {
      // Create
      await incrementCounter(db, 'ratings', 1);
      await trackWrite(db, 'ratings');
    } else if (before && after) {
      // Update (score change)
      await trackWrite(db, 'ratings');
    } else if (before && !after) {
      // Delete
      await incrementCounter(db, 'ratings', -1);
      await trackDelete(db, 'ratings');
    }
  },
);
