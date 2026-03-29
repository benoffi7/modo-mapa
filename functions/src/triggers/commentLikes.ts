import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../helpers/env';
import { checkRateLimit } from '../utils/rateLimiter';
import { logAbuse } from '../utils/abuseLogger';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';
import { createNotification } from '../utils/notifications';

export const onCommentLikeCreated = onDocumentCreated(
  'commentLikes/{docId}',
  async (event) => {
    const db = getDb();
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
      await logAbuse(db, { userId, type: 'rate_limit', collection: 'commentLikes', detail: 'Exceeded 50 commentLikes/day' });
      return;
    }

    // Increment likeCount on the comment
    await db.doc(`comments/${commentId}`).update({
      likeCount: FieldValue.increment(1),
    });

    // Create notification for comment author (don't notify self-likes)
    const commentSnap = await db.doc(`comments/${commentId}`).get();
    if (commentSnap.exists) {
      const commentData = commentSnap.data()!;
      const commentAuthorId = commentData.userId as string;
      if (commentAuthorId !== userId) {
        // Fetch liker's display name
        const userSnap = await db.doc(`users/${userId}`).get();
        const actorName = userSnap.exists
          ? (userSnap.data()!.displayName as string)
          : 'Alguien';

        await createNotification(db, {
          userId: commentAuthorId,
          type: 'like',
          message: `${actorName} le dio me gusta a tu comentario`,
          actorId: userId,
          actorName,
          businessId: commentData.businessId as string,
          referenceId: commentId,
        });
      }
    }

    await incrementCounter(db, 'commentLikes', 1);
    await trackWrite(db, 'commentLikes');
  },
);

export const onCommentLikeDeleted = onDocumentDeleted(
  'commentLikes/{docId}',
  async (event) => {
    const db = getDb();
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
