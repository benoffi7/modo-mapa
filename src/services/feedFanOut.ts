/**
 * Client-side fan-out: writes activity feed items to followers' feeds.
 *
 * Called fire-and-forget from service layer after ratings, comments, favorites.
 * Resolves actor/business names internally.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { allBusinesses } from '../hooks/useBusinesses';
import type { ActivityType } from '../types';
import { logger } from '../utils/logger';

export async function fanOutFromAction(
  actorId: string,
  type: ActivityType,
  businessId: string,
  referenceId: string,
): Promise<void> {
  try {
    // Get followers
    const followersSnap = await getDocs(
      query(
        collection(db, COLLECTIONS.FOLLOWS),
        where('followedId', '==', actorId),
      ),
    );
    if (followersSnap.empty) return;

    // Resolve actor name from users collection
    const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, actorId));
    const actorName = userSnap.exists()
      ? (userSnap.data() as { displayName?: string }).displayName ?? 'Alguien'
      : 'Alguien';

    // Resolve business name from local JSON data (not Firestore)
    const biz = allBusinesses.find((b) => b.id === businessId);
    const businessName = biz?.name ?? '';

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Write feed item for each follower
    for (const followDoc of followersSnap.docs) {
      const followerId = followDoc.data().followerId as string;
      const feedItemRef = doc(
        collection(db, COLLECTIONS.ACTIVITY_FEED, followerId, 'items'),
      );
      await setDoc(feedItemRef, {
        actorId,
        actorName,
        type,
        businessId,
        businessName,
        referenceId,
        createdAt: serverTimestamp(),
        expiresAt,
      });
    }
  } catch (err) {
    if (import.meta.env.DEV) logger.error('Feed fan-out failed:', err);
  }
}
