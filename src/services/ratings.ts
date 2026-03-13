/**
 * Firestore service for the `ratings` collection.
 */
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { ratingConverter } from '../config/converters';
import { invalidateQueryCache } from '../hooks/usePaginatedQuery';
import { trackEvent } from '../utils/analytics';
import type { Rating } from '../types';

export function getRatingsCollection(): CollectionReference<Rating> {
  return collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter) as CollectionReference<Rating>;
}

export async function upsertRating(
  userId: string,
  businessId: string,
  score: number,
): Promise<void> {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('Score must be an integer between 1 and 5');
  }

  const docId = `${userId}__${businessId}`;
  const ratingRef = doc(db, COLLECTIONS.RATINGS, docId);
  const existing = await getDoc(ratingRef);

  if (existing.exists()) {
    await updateDoc(ratingRef, {
      score,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ratingRef, {
      userId,
      businessId,
      score,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  invalidateQueryCache(COLLECTIONS.RATINGS, userId);
  trackEvent('rating_submit', { business_id: businessId, score });
}

export async function deleteRating(
  userId: string,
  businessId: string,
): Promise<void> {
  const docId = `${userId}__${businessId}`;
  await deleteDoc(doc(db, COLLECTIONS.RATINGS, docId));
  invalidateQueryCache(COLLECTIONS.RATINGS, userId);
}
