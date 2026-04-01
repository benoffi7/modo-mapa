import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { checkRateLimit } from '../utils/rateLimiter';
import { logAbuse } from '../utils/abuseLogger';
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
      const userId = data.userId as string;
      const businessId = data.businessId as string;
      const score = data.score as number;

      // Rate limit: 30 ratings per day per user
      const exceeded = await checkRateLimit(db, { collection: 'ratings', limit: 30, windowType: 'daily' }, userId);
      if (exceeded) {
        await after!.ref.delete();
        await logAbuse(db, { userId, type: 'rate_limit', collection: 'ratings', detail: 'Exceeded 30 ratings/day' });
        return;
      }

      await Promise.all([
        incrementCounter(db, 'ratings', 1),
        trackWrite(db, 'ratings'),
        updateRatingAggregates(db, businessId, 'add', score),
      ]);

      // Fan-out to followers
      const [userSnap, bizSnap] = await Promise.all([
        db.doc(`users/${userId}`).get(),
        db.doc(`businesses/${businessId}`).get(),
      ]);
      const actorName = userSnap.exists ? (userSnap.data()!.displayName as string) : 'Alguien';
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
      await Promise.all([
        incrementCounter(db, 'ratings', -1),
        trackDelete(db, 'ratings'),
        updateRatingAggregates(db, businessId, 'remove', score),
      ]);
    }

    await trackFunctionTiming('onRatingWritten', startMs);
  },
);
