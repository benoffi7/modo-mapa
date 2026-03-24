/**
 * Firestore service for the `favorites` collection.
 *
 * All Firestore reads/writes for favorites go through this module so
 * components never import Firestore SDK directly.
 */
import { collection, doc, setDoc, deleteDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { favoriteConverter } from '../config/converters';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';
import type { Favorite } from '../types';

export function getFavoritesCollection(): CollectionReference<Favorite> {
  return collection(db, COLLECTIONS.FAVORITES).withConverter(favoriteConverter) as CollectionReference<Favorite>;
}

function docId(userId: string, businessId: string): string {
  return `${userId}__${businessId}`;
}

export async function addFavorite(userId: string, businessId: string): Promise<void> {
  if (!userId || !businessId) {
    throw new Error('userId and businessId are required');
  }

  await setDoc(doc(db, COLLECTIONS.FAVORITES, docId(userId, businessId)), {
    userId,
    businessId,
    createdAt: serverTimestamp(),
  });
  invalidateQueryCache(COLLECTIONS.FAVORITES, userId);
  trackEvent('favorite_toggle', { business_id: businessId, action: 'add' });
}

export async function removeFavorite(userId: string, businessId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.FAVORITES, docId(userId, businessId)));
  invalidateQueryCache(COLLECTIONS.FAVORITES, userId);
  trackEvent('favorite_toggle', { business_id: businessId, action: 'remove' });
}

export async function addFavoritesBatch(
  userId: string,
  businessIds: string[],
): Promise<number> {
  if (!userId || businessIds.length === 0) return 0;

  // Fetch existing favorites to skip duplicates
  const existingSnap = await getDocs(
    query(collection(db, COLLECTIONS.FAVORITES), where('userId', '==', userId)),
  );
  const existingBizIds = new Set(
    existingSnap.docs.map((d) => (d.data() as { businessId: string }).businessId),
  );

  const toAdd = businessIds.filter((id) => !existingBizIds.has(id));
  for (const bizId of toAdd) {
    await setDoc(doc(db, COLLECTIONS.FAVORITES, docId(userId, bizId)), {
      userId,
      businessId: bizId,
      createdAt: serverTimestamp(),
    });
  }

  if (toAdd.length > 0) {
    invalidateQueryCache(COLLECTIONS.FAVORITES, userId);
    trackEvent('favorites_batch_add', { count: toAdd.length });
  }
  return toAdd.length;
}

export async function fetchUserFavoriteIds(userId: string): Promise<string[]> {
  const snap = await getDocs(query(getFavoritesCollection(), where('userId', '==', userId)));
  return snap.docs.map((d) => d.data().businessId);
}
