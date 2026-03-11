import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { checkRateLimit } from '../utils/rateLimiter';
import { checkModeration } from '../utils/moderator';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';
import { logAbuse } from '../utils/abuseLogger';

export const onCommentCreated = onDocumentCreated(
  'comments/{commentId}',
  async (event) => {
    const db = getFirestore();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = data.userId as string;

    // 1. Rate limit: 20 comments per day per user
    const exceeded = await checkRateLimit(
      db,
      { collection: 'comments', limit: 20, windowType: 'daily' },
      userId,
    );

    if (exceeded) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId,
        type: 'rate_limit',
        collection: 'comments',
        detail: 'Exceeded 20 comments/day',
      });
      return;
    }

    // 2. Content moderation
    const flagged = await checkModeration(db, data.text as string);
    if (flagged) {
      await snap.ref.update({ flagged: true });
      await logAbuse(db, {
        userId,
        type: 'flagged',
        collection: 'comments',
        detail: `Flagged text: "${(data.text as string).slice(0, 100)}"`,
      });
    }

    // 3. Counters
    await incrementCounter(db, 'comments', 1);
    await trackWrite(db, 'comments');
  },
);

export const onCommentDeleted = onDocumentDeleted(
  'comments/{commentId}',
  async () => {
    const db = getFirestore();
    await incrementCounter(db, 'comments', -1);
    await trackDelete(db, 'comments');
  },
);
