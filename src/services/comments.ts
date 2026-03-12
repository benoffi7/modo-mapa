/**
 * Firestore service for the `comments` collection.
 */
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { invalidateQueryCache } from '../hooks/usePaginatedQuery';

export async function addComment(
  userId: string,
  userName: string,
  businessId: string,
  text: string,
): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.COMMENTS), {
    userId,
    userName,
    businessId,
    text,
    createdAt: serverTimestamp(),
  });
  invalidateQueryCache(COLLECTIONS.COMMENTS, userId);
}

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.COMMENTS, commentId));
  invalidateQueryCache(COLLECTIONS.COMMENTS, userId);
}
