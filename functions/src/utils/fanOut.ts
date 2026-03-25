import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

interface FanOutData {
  actorId: string;
  actorName: string;
  type: 'rating' | 'comment' | 'favorite';
  businessId: string;
  businessName: string;
  referenceId: string;
}

/**
 * Fan-out write: for each follower of the actor, write an activity feed item.
 * Checks that the actor's profile is public before writing.
 */
export async function fanOutToFollowers(
  db: Firestore,
  data: FanOutData,
): Promise<void> {
  // Check actor's profile is public
  const settingsSnap = await db.doc(`userSettings/${data.actorId}`).get();
  if (settingsSnap.exists && settingsSnap.data()?.profilePublic !== true) {
    return;
  }

  // Get all followers of the actor
  const followersSnap = await db.collection('follows')
    .where('followedId', '==', data.actorId)
    .get();

  if (followersSnap.empty) return;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  // Batch write feed items (max 500 per batch)
  let batch = db.batch();
  let count = 0;

  for (const followDoc of followersSnap.docs) {
    const followerId = followDoc.data().followerId as string;
    const feedRef = db.collection('activityFeed').doc(followerId)
      .collection('items').doc();

    batch.set(feedRef, {
      actorId: data.actorId,
      actorName: data.actorName,
      type: data.type,
      businessId: data.businessId,
      businessName: data.businessName,
      referenceId: data.referenceId,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

    count++;
    if (count % 500 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
  }
}
