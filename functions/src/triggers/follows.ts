import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '../helpers/env';
import { checkRateLimit } from '../utils/rateLimiter';
import { incrementCounter, trackWrite, trackDelete } from '../utils/counters';
import { createNotification } from '../utils/notifications';
import { logAbuse } from '../utils/abuseLogger';

const MAX_FOLLOWS = 200;

export const onFollowCreated = onDocumentCreated(
  'follows/{docId}',
  async (event) => {
    const db = getDb();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const followerId = data.followerId as string;
    const followedId = data.followedId as string;

    // Rate limit: 50 follows per day per user
    const exceeded = await checkRateLimit(
      db,
      { collection: 'follows', limit: 50, windowType: 'daily' },
      followerId,
    );

    if (exceeded) {
      await snap.ref.delete();
      await logAbuse(db, {
        userId: followerId,
        type: 'rate_limit',
        collection: 'follows',
        detail: 'Exceeded 50 follows/day',
      });
      return;
    }

    // Check max follows limit (200)
    const followingCount = await db.collection('follows')
      .where('followerId', '==', followerId)
      .count()
      .get();

    if (followingCount.data().count > MAX_FOLLOWS) {
      await snap.ref.delete();
      return;
    }

    // Check followed user has public profile (only block if explicitly set to private)
    const settingsSnap = await db.doc(`userSettings/${followedId}`).get();
    if (settingsSnap.exists && settingsSnap.data()?.profilePublic === false) {
      await snap.ref.delete();
      return;
    }

    // Increment counters on user docs
    await db.doc(`users/${followerId}`).update({
      followingCount: FieldValue.increment(1),
    }).catch(() => {
      // User doc might not have the field yet
      return db.doc(`users/${followerId}`).set(
        { followingCount: FieldValue.increment(1) },
        { merge: true },
      );
    });

    await db.doc(`users/${followedId}`).update({
      followersCount: FieldValue.increment(1),
    }).catch(() => {
      return db.doc(`users/${followedId}`).set(
        { followersCount: FieldValue.increment(1) },
        { merge: true },
      );
    });

    // Notify the followed user
    const followerSnap = await db.doc(`users/${followerId}`).get();
    const followerName = followerSnap.exists
      ? (followerSnap.data()!.displayName as string)
      : 'Alguien';

    await createNotification(db, {
      userId: followedId,
      type: 'new_follower',
      message: `${followerName} empezo a seguirte`,
      actorId: followerId,
      actorName: followerName,
    });

    await incrementCounter(db, 'follows', 1);
    await trackWrite(db, 'follows');
  },
);

export const onFollowDeleted = onDocumentDeleted(
  'follows/{docId}',
  async (event) => {
    const db = getDb();
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const followerId = data.followerId as string;
    const followedId = data.followedId as string;

    // Decrement counters with floor 0
    const followerDoc = await db.doc(`users/${followerId}`).get();
    const currentFollowing = (followerDoc.data()?.followingCount as number) ?? 0;
    if (currentFollowing > 0) {
      await db.doc(`users/${followerId}`).update({
        followingCount: FieldValue.increment(-1),
      });
    }

    const followedDoc = await db.doc(`users/${followedId}`).get();
    const currentFollowers = (followedDoc.data()?.followersCount as number) ?? 0;
    if (currentFollowers > 0) {
      await db.doc(`users/${followedId}`).update({
        followersCount: FieldValue.increment(-1),
      });
    }

    await incrementCounter(db, 'follows', -1);
    await trackDelete(db, 'follows');
  },
);
