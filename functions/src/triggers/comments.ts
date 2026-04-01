import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../helpers/env';
import { checkRateLimit } from '../utils/rateLimiter';
import { checkModeration } from '../utils/moderator';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';
import { incrementBusinessCount } from '../utils/aggregates';
import { logAbuse } from '../utils/abuseLogger';
import { createNotification } from '../utils/notifications';
import { trackFunctionTiming } from '../utils/perfTracker';
import { fanOutToFollowers } from '../utils/fanOut';

export const onCommentCreated = onDocumentCreated(
  'comments/{commentId}',
  async (event) => {
    const startMs = performance.now();
    const db = getDb();
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

    // 3. Increment parent replyCount (server-side — H2 security fix)
    const parentId = data.parentId as string | undefined;
    let parentSnap: FirebaseFirestore.DocumentSnapshot | null = null;
    if (parentId) {
      const parentRef = db.collection('comments').doc(parentId);
      const [, snap] = await Promise.all([
        parentRef.update({ replyCount: FieldValue.increment(1) }),
        parentRef.get(),
      ]);
      parentSnap = snap;
    }

    // 4. Counters + aggregates
    const businessId = data.businessId as string | undefined;
    await incrementCounter(db, 'comments', 1);
    await trackWrite(db, 'comments');
    if (businessId) {
      await incrementBusinessCount(db, 'businessComments', businessId, 1);
    }

    // 5. Notify parent comment author about the reply
    if (parentId && parentSnap?.exists) {
      const parentData = parentSnap.data()!;
      const parentAuthorId = parentData.userId as string;

      // Don't notify if replying to own comment
      if (parentAuthorId !== userId) {
        const displayName = (data.userName as string) || 'Alguien';
        const replyText = (data.text as string) || '';
        const truncatedText = replyText.length > 80 ? replyText.slice(0, 80) + '…' : replyText;

        await createNotification(db, {
          userId: parentAuthorId,
          type: 'comment_reply',
          message: `${displayName} respondió tu comentario: "${truncatedText}"`,
          actorId: userId,
          actorName: displayName,
          businessId: businessId,
          businessName: data.businessName as string | undefined,
          referenceId: parentId,
        });
      }
    }

    // 6. Fan-out to followers (only for root comments, not replies)
    if (!parentId && businessId) {
      const displayName = (data.userName as string) || 'Alguien';
      const bizSnap = await db.doc(`businesses/${businessId}`).get();
      const bizName = bizSnap.exists ? (bizSnap.data()!.name as string) : '';
      await fanOutToFollowers(db, {
        actorId: userId, actorName: displayName, type: 'comment',
        businessId, businessName: bizName, referenceId: event.params.commentId,
      });
    }

    await trackFunctionTiming('onCommentCreated', startMs);
  },
);

export const onCommentUpdated = onDocumentUpdated(
  'comments/{commentId}',
  async (event) => {
    const db = getDb();
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
  async (event) => {
    const db = getDb();
    const data = event.data?.data();
    const commentId = event.params.commentId;

    // 1. Decrement parent replyCount if this was a reply (H2 security fix)
    const parentId = data?.parentId as string | undefined;
    if (parentId) {
      const parentRef = db.collection('comments').doc(parentId);
      const parentSnap = await parentRef.get();
      if (parentSnap.exists) {
        const currentCount = (parentSnap.data()?.replyCount as number) ?? 0;
        await parentRef.update({ replyCount: Math.max(0, currentCount - 1) });
      }
    }

    // 2. Cascade delete orphaned replies if this was a parent comment (M1 fix)
    const repliesSnap = await db.collection('comments')
      .where('parentId', '==', commentId)
      .get();

    if (!repliesSnap.empty) {
      const batch = db.batch();
      for (const replyDoc of repliesSnap.docs) {
        batch.delete(replyDoc.ref);
      }
      await batch.commit();
      // Each deleted reply will trigger its own onCommentDeleted (for counter decrement)
    }

    // 3. Counters + aggregates
    const businessId = data?.businessId as string | undefined;
    await incrementCounter(db, 'comments', -1);
    await trackDelete(db, 'comments');
    if (businessId) {
      await incrementBusinessCount(db, 'businessComments', businessId, -1);
    }
  },
);
