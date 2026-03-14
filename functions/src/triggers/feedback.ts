import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { checkRateLimit } from '../utils/rateLimiter';
import { checkModeration } from '../utils/moderator';
import { incrementCounter, trackWrite } from '../utils/counters';
import { logAbuse } from '../utils/abuseLogger';

export const onFeedbackCreated = onDocumentCreated(
  'feedback/{feedbackId}',
  async (event) => {
    const db = getFirestore();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = data.userId as string;

    // 1. Rate limit: 5 feedback per day per user
    const exceeded = await checkRateLimit(
      db,
      { collection: 'feedback', limit: 5, windowType: 'daily' },
      userId,
    );

    if (exceeded) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'feedback',
        detail: 'Exceeded 5 feedback/day',
      });
      return;
    }

    // 2. Content moderation on message
    const flagged = await checkModeration(db, data.message as string);
    if (flagged) {
      await snap.ref.update({ flagged: true });
      await logAbuse(db, {
        userId,
        type: 'flagged',
        collection: 'feedback',
        detail: `Flagged message: "${(data.message as string).slice(0, 100)}"`,
      });
    }

    // 3. Set initial status
    await snap.ref.update({ status: 'pending' });

    // 4. Counters
    await incrementCounter(db, 'feedback', 1);
    await trackWrite(db, 'feedback');
  },
);
