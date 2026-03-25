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

    // Resolve names
    const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, actorId));
    const actorName = userSnap.exists()
      ? (userSnap.data() as { displayName?: string }).displayName ?? 'Alguien'
      : 'Alguien';

    let businessName = '';
    // businesses collection uses allBusinesses cache — just read from Firestore
    const bizSnap = await getDoc(doc(db, 'businesses', businessId));
    if (bizSnap.exists()) {
      businessName = (bizSnap.data() as { name?: string }).name ?? '';
    }

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
    // Fan-out is best-effort — don't break the main action
    if (import.meta.env.DEV) logger.error('Feed fan-out failed:', err);
  }
}
