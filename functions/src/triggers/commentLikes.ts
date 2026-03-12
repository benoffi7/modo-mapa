import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { checkRateLimit } from '../utils/rateLimiter';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';

export const onCommentLikeCreated = onDocumentCreated(
  'commentLikes/{docId}',
  async (event) => {
    const db = getFirestore();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const userId = data.userId as string;
    const commentId = data.commentId as string;

    // Rate limit: 50 likes per day per user
    const exceeded = await checkRateLimit(
      db,
      { collection: 'commentLikes', limit: 50, windowType: 'daily' },
      userId,
    );

    if (exceeded) {
      await snap.ref.delete();
      return;
    }

    // Increment likeCount on the comment
    await db.doc(`comments/${commentId}`).update({
      likeCount: FieldValue.increment(1),
    });

    await incrementCounter(db, 'commentLikes', 1);
    await trackWrite(db, 'commentLikes');
  },
);

export const onCommentLikeDeleted = onDocumentDeleted(
  'commentLikes/{docId}',
  async (event) => {
    const db = getFirestore();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const commentId = data.commentId as string;

    // Decrement likeCount on the comment
    await db.doc(`comments/${commentId}`).update({
      likeCount: FieldValue.increment(-1),
    });

    await incrementCounter(db, 'commentLikes', -1);
    await trackDelete(db, 'commentLikes');
  },
);
