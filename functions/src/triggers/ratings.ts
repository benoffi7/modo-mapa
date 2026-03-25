import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';
import { updateRatingAggregates } from '../utils/aggregates';
import { trackFunctionTiming } from '../utils/perfTracker';
import { fanOutToFollowers } from '../utils/fanOut';

export const onRatingWritten = onDocumentWritten(
  'ratings/{ratingId}',
  async (event) => {
    const startMs = performance.now();
    const db = getDb();
    const before = event.data?.before;
    const after = event.data?.after;
    const beforeExists = before?.exists;
    const afterExists = after?.exists;

    if (!beforeExists && afterExists) {
      // Create
      const data = after!.data()!;
      const businessId = data.businessId as string;
      const score = data.score as number;
      await incrementCounter(db, 'ratings', 1);
      await trackWrite(db, 'ratings');
      await updateRatingAggregates(db, businessId, 'add', score);

      // Fan-out to followers
      const userId = data.userId as string;
      const userSnap = await db.doc(`users/${userId}`).get();
      const actorName = userSnap.exists ? (userSnap.data()!.displayName as string) : 'Alguien';
      const bizSnap = await db.doc(`businesses/${businessId}`).get();
      const businessName = bizSnap.exists ? (bizSnap.data()!.name as string) : '';
      await fanOutToFollowers(db, {
        actorId: userId, actorName, type: 'rating',
        businessId, businessName, referenceId: event.params.ratingId,
      });
    } else if (beforeExists && afterExists) {
      // Update (score change)
      const oldScore = before!.data()!.score as number;
      const newScore = after!.data()!.score as number;
      const businessId = after!.data()!.businessId as string;
      await trackWrite(db, 'ratings');
      if (oldScore !== newScore) {
        await updateRatingAggregates(db, businessId, 'add', newScore, oldScore);
      }
    } else if (beforeExists && !afterExists) {
      // Delete
      const data = before!.data()!;
      const businessId = data.businessId as string;
      const score = data.score as number;
      await incrementCounter(db, 'ratings', -1);
      await trackDelete(db, 'ratings');
      await updateRatingAggregates(db, businessId, 'remove', score);
    }

    await trackFunctionTiming('onRatingWritten', startMs);
  },
);
