/**
 * Firestore service for the `priceLevels` collection.
 */
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { priceLevelConverter } from '../config/converters';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';
import type { PriceLevel } from '../types';

/** Safety bound: max docs to fetch (covers ~500 users × 40 businesses) */
const MAX_PRICE_LEVELS = 20_000;

/**
 * Fetches all price level docs and returns a map of businessId -> averaged level.
 * Safety bound: fetches at most MAX_PRICE_LEVELS docs.
 */
export async function fetchPriceLevelMap(
  maxDocs = MAX_PRICE_LEVELS,
): Promise<Map<string, number>> {
  const snap = await getDocs(query(
    collection(db, COLLECTIONS.PRICE_LEVELS).withConverter(priceLevelConverter),
    limit(maxDocs),
  ));
  const byBusiness = new Map<string, number[]>();
  for (const docSnap of snap.docs) {
    const pl: PriceLevel = docSnap.data();
    const arr = byBusiness.get(pl.businessId) ?? [];
    arr.push(pl.level);
    byBusiness.set(pl.businessId, arr);
  }

  const result = new Map<string, number>();
  for (const [bId, levels] of byBusiness) {
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    result.set(bId, Math.round(avg));
  }
  return result;
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
