/**
 * Firestore service for the `ratings` collection.
 */
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { ratingConverter } from '../config/converters';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';
import type { Rating, RatingCriteria } from '../types';

export function getRatingsCollection(): CollectionReference<Rating> {
  return collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter) as CollectionReference<Rating>;
}

export async function upsertRating(
  userId: string,
  businessId: string,
  score: number,
  criteria?: RatingCriteria,
): Promise<void> {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('Score must be an integer between 1 and 5');
  }

  const docId = `${userId}__${businessId}`;
  const ratingRef = doc(db, COLLECTIONS.RATINGS, docId);
  const existing = await getDoc(ratingRef);

  const criteriaField = criteria != null ? { criteria } : {};

  if (existing.exists()) {
    await updateDoc(ratingRef, {
      score,
      ...criteriaField,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ratingRef, {
      userId,
      businessId,
      score,
      ...criteriaField,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  invalidateQueryCache(COLLECTIONS.RATINGS, userId);
  trackEvent('rating_submit', { business_id: businessId, score });

  // Fan-out to followers (fire-and-forget)
  import('./feedFanOut').then(({ fanOutFromAction }) =>
    fanOutFromAction(userId, 'rating', businessId, docId),
  ).catch(() => {});
}

export async function upsertCriteriaRating(
  userId: string,
  businessId: string,
  criteria: RatingCriteria,
): Promise<void> {
  // Validate each criterion score
  for (const [, value] of Object.entries(criteria)) {
    if (value != null && (!Number.isInteger(value) || value < 1 || value > 5)) {
      throw new Error('Criteria scores must be integers between 1 and 5');
    }
  }

  const docId = `${userId}__${businessId}`;
  const ratingRef = doc(db, COLLECTIONS.RATINGS, docId);
  const existing = await getDoc(ratingRef);

  if (!existing.exists()) {
    // Require a global rating before allowing criteria ratings
    throw new Error('Calificá con estrellas antes de agregar detalle por criterio');
  }

  // Merge criteria with existing criteria
  const existingData = existing.data();
  const mergedCriteria = { ...(existingData?.criteria ?? {}), ...criteria };
  await updateDoc(ratingRef, {
    criteria: mergedCriteria,
    updatedAt: serverTimestamp(),
  });

  invalidateQueryCache(COLLECTIONS.RATINGS, userId);
  trackEvent('criteria_rating_submit', { business_id: businessId });
}

export async function deleteRating(
  userId: string,
  businessId: string,
): Promise<void> {
  const docId = `${userId}__${businessId}`;
  await deleteDoc(doc(db, COLLECTIONS.RATINGS, docId));
  invalidateQueryCache(COLLECTIONS.RATINGS, userId);
}
