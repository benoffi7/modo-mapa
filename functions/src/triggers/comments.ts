import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
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

export const onCommentUpdated = onDocumentUpdated(
  'comments/{commentId}',
  async (event) => {
    const db = getFirestore();
    const after = event.data?.after;
    const before = event.data?.before;
    if (!after || !before) return;

    const afterData = after.data();
    const beforeData = before.data();

    // Only re-moderate if text changed (ignore likeCount updates from Cloud Functions)
    if (afterData.text !== beforeData.text) {
      const flagged = await checkModeration(db, afterData.text as string);
      if (flagged && !afterData.flagged) {
        await after.ref.update({ flagged: true });
        await logAbuse(db, {
          userId: afterData.userId as string,
          type: 'flagged',
          collection: 'comments',
          detail: `Flagged edited text: "${(afterData.text as string).slice(0, 100)}"`,
        });
      }
      // If text is now clean but was flagged, remove flag
      if (!flagged && afterData.flagged) {
        await after.ref.update({ flagged: false });
      }
    }
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
