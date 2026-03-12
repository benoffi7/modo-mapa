/**
 * Firestore service for the `ratings` collection.
 */
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { invalidateQueryCache } from '../hooks/usePaginatedQuery';

export async function upsertRating(
  userId: string,
  businessId: string,
  score: number,
): Promise<void> {
  const docId = `${userId}__${businessId}`;
  await setDoc(
    doc(db, COLLECTIONS.RATINGS, docId),
    {
      userId,
      businessId,
      score,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  invalidateQueryCache(COLLECTIONS.RATINGS, userId);
}
