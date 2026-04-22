/**
 * Firestore service for the `ratings` collection.
 */
import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import type { CollectionReference, QuerySnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { ratingConverter } from '../config/converters';
import { invalidateQueryCache } from './queryCache';
import { getCountOfflineSafe } from './getCountOfflineSafe';
import { measureAsync, measuredGetDoc, measuredGetDocs } from '../utils/perfMetrics';
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
  const existing = await measuredGetDoc('ratings_upsertExists', ratingRef);

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
  const existing = await measuredGetDoc('ratings_criteriaExists', ratingRef);

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

export async function fetchUserRatings(userId: string): Promise<Rating[]> {
  const snap = await measuredGetDocs(
    'ratings_byUser',
    query(getRatingsCollection(), where('userId', '==', userId)),
  );
  return snap.docs.map((d) => d.data());
}

/**
 * Returns the count of ratings written by userId.
 * Uses getCountOfflineSafe to handle offline gracefully.
 */
export async function fetchUserRatingsCount(userId: string): Promise<number> {
  return measureAsync('ratings_countByUser', () => getCountOfflineSafe(
    query(collection(db, COLLECTIONS.RATINGS), where('userId', '==', userId)),
  ));
}

/**
 * Returns true if a rating exists for the given user/business pair.
 * Uses the composite doc ID pattern: {userId}__{businessId}.
 */
export async function hasUserRatedBusiness(
  userId: string,
  businessId: string,
): Promise<boolean> {
  const docId = `${userId}__${businessId}`;
  const snap = await measuredGetDoc('ratings_hasUser', doc(db, COLLECTIONS.RATINGS, docId));
  return snap.exists();
}

export async function fetchRatingsByBusinessIds(businessIds: string[]): Promise<Rating[]> {
  const BATCH_SIZE = 10;
  const batches: Promise<QuerySnapshot<Rating>>[] = [];
  for (let i = 0; i < businessIds.length; i += BATCH_SIZE) {
    const batch = businessIds.slice(i, i + BATCH_SIZE);
    batches.push(getDocs(query(getRatingsCollection(), where('businessId', 'in', batch))));
  }
  const snapshots = await measureAsync('ratings_byBusinessIds', () => Promise.all(batches));
  return snapshots.flatMap((snap) => snap.docs.map((d) => d.data()));
}
