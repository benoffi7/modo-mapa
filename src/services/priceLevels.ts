/**
 * Firestore service for the `priceLevels` collection.
 */
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { priceLevelConverter } from '../config/converters';
import { invalidateQueryCache } from '../hooks/usePaginatedQuery';
import { trackEvent } from '../utils/analytics';
import type { PriceLevel } from '../types';

export function getPriceLevelsCollection(): CollectionReference<PriceLevel> {
  return collection(db, COLLECTIONS.PRICE_LEVELS)
    .withConverter(priceLevelConverter) as CollectionReference<PriceLevel>;
}

export async function upsertPriceLevel(
  userId: string,
  businessId: string,
  level: number,
): Promise<void> {
  if (!Number.isInteger(level) || level < 1 || level > 3) {
    throw new Error('Level must be 1, 2, or 3');
  }

  const docId = `${userId}__${businessId}`;
  const plRef = doc(db, COLLECTIONS.PRICE_LEVELS, docId);
  const existing = await getDoc(plRef);

  if (existing.exists()) {
    await updateDoc(plRef, {
      level,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(plRef, {
      userId,
      businessId,
      level,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  invalidateQueryCache(COLLECTIONS.PRICE_LEVELS, userId);
  trackEvent('price_level_vote', { business_id: businessId, level });
}

export async function deletePriceLevel(
  userId: string,
  businessId: string,
): Promise<void> {
  const docId = `${userId}__${businessId}`;
  await deleteDoc(doc(db, COLLECTIONS.PRICE_LEVELS, docId));
  invalidateQueryCache(COLLECTIONS.PRICE_LEVELS, userId);
}
