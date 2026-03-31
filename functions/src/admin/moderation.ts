import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { assertAdmin } from '../helpers/assertAdmin';
import { ENFORCE_APP_CHECK_ADMIN, getDb } from '../helpers/env';
import { checkCallableRateLimit } from '../utils/callableRateLimit';
import type { ModerationAction, ModerationTargetCollection } from '../shared/types/admin';

/**
 * Helper to write an audit log for moderation actions
 */
async function writeModerationLog(
  adminId: string,
  action: ModerationAction,
  targetCollection: ModerationTargetCollection,
  targetDocId: string,
  targetUserId: string,
  snapshot: Record<string, unknown>,
  reason?: string
) {
  const db = getDb();
  await db.collection('moderationLogs').add({
    adminId,
    action,
    targetCollection,
    targetDocId,
    targetUserId,
    reason: reason || null,
    snapshot,
    timestamp: FieldValue.serverTimestamp(),
  });
}

/**
 * Moderate a comment (delete or hide)
 * Cascades: deletes replies and likes if deleted
 */
export const moderateComment = onCall<{
  commentId: string;
  action: ModerationAction;
  reason?: string;
}>(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, timeoutSeconds: 60 },
  async (request) => {
  const { auth, data } = request;
  assertAdmin(auth);
  const db = getDb();

  if (!data.commentId || !data.action) {
    throw new HttpsError('invalid-argument', 'Missing commentId or action');
  }

  await checkCallableRateLimit(db, `moderate_${auth!.uid}`, 10, auth!.uid);

  const commentRef = db.collection('comments').doc(data.commentId);
  const commentSnap = await commentRef.get();

  if (!commentSnap.exists) {
    throw new HttpsError('not-found', 'Comment not found');
  }

  const commentData = commentSnap.data()!;

  if (data.action === 'hide') {
    await commentRef.update({ hidden: true, updatedAt: FieldValue.serverTimestamp() });
    await writeModerationLog(
      auth!.uid,
      'hide',
      'comments',
      data.commentId,
      commentData.userId,
      commentData,
      data.reason
    );
    return { success: true };
  }

  // Delete path: requires cascade
  const batch = db.batch();

  // 1. Delete replies
  const repliesSnap = await db
    .collection('comments')
    .where('parentId', '==', data.commentId)
    .get();
  
  repliesSnap.docs.forEach((doc) => batch.delete(doc.ref));

  // 2. Delete likes
  const likesSnap = await db
    .collection('commentLikes')
    .where('commentId', '==', data.commentId)
    .get();
  
  likesSnap.docs.forEach((doc) => batch.delete(doc.ref));

  // 3. Decrement parent replyCount if it's a reply
  if (commentData.parentId) {
    const parentRef = db.collection('comments').doc(commentData.parentId);
    batch.update(parentRef, {
      replyCount: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // 4. Delete the comment itself
  batch.delete(commentRef);

  await batch.commit();
  
  await writeModerationLog(
    auth!.uid,
    'delete',
    'comments',
    data.commentId,
    commentData.userId,
    commentData,
    data.reason
  );

  return { success: true };
});

/**
 * Moderate a rating (delete only)
 */
export const moderateRating = onCall<{
  ratingId: string; // userId__businessId
  reason?: string;
}>(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, timeoutSeconds: 60 },
  async (request) => {
  const { auth, data } = request;
  assertAdmin(auth);
  const db = getDb();

  if (!data.ratingId) {
    throw new HttpsError('invalid-argument', 'Missing ratingId');
  }

  await checkCallableRateLimit(db, `moderate_${auth!.uid}`, 10, auth!.uid);

  const ratingRef = db.collection('ratings').doc(data.ratingId);
  const ratingSnap = await ratingRef.get();

  if (!ratingSnap.exists) {
    throw new HttpsError('not-found', 'Rating not found');
  }

  const ratingData = ratingSnap.data()!;

  await ratingRef.delete();
  
  await writeModerationLog(
    auth!.uid,
    'delete',
    'ratings',
    data.ratingId,
    ratingData.userId,
    ratingData,
    data.reason
  );

  return { success: true };
});

/**
 * Moderate a custom tag (delete only)
 */
export const moderateCustomTag = onCall<{
  tagId: string;
  reason?: string;
}>(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, timeoutSeconds: 60 },
  async (request) => {
  const { auth, data } = request;
  assertAdmin(auth);
  const db = getDb();

  if (!data.tagId) {
    throw new HttpsError('invalid-argument', 'Missing tagId');
  }

  await checkCallableRateLimit(db, `moderate_${auth!.uid}`, 10, auth!.uid);

  const tagRef = db.collection('customTags').doc(data.tagId);
  const tagSnap = await tagRef.get();

  if (!tagSnap.exists) {
    throw new HttpsError('not-found', 'Custom tag not found');
  }

  const tagData = tagSnap.data()!;

  await tagRef.delete();
  
  await writeModerationLog(
    auth!.uid,
    'delete',
    'customTags',
    data.tagId,
    tagData.userId,
    tagData,
    data.reason
  );

  return { success: true };
});
