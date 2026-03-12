/**
 * Firestore service for the `favorites` collection.
 *
 * All Firestore reads/writes for favorites go through this module so
 * components never import Firestore SDK directly.
 */
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { invalidateQueryCache } from '../hooks/usePaginatedQuery';

function docId(userId: string, businessId: string): string {
  return `${userId}__${businessId}`;
}

export async function addFavorite(userId: string, businessId: string): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.FAVORITES, docId(userId, businessId)), {
    userId,
    businessId,
    createdAt: serverTimestamp(),
  });
  invalidateQueryCache(COLLECTIONS.FAVORITES, userId);
}

export async function removeFavorite(userId: string, businessId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.FAVORITES, docId(userId, businessId)));
  invalidateQueryCache(COLLECTIONS.FAVORITES, userId);
}
