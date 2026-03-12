/**
 * Firestore service for the `comments` collection.
 */
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { commentConverter } from '../config/converters';
import { invalidateQueryCache } from '../hooks/usePaginatedQuery';
import type { Comment } from '../types';

export function getCommentsCollection(): CollectionReference<Comment> {
  return collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter) as CollectionReference<Comment>;
}

export async function addComment(
  userId: string,
  userName: string,
  businessId: string,
  text: string,
): Promise<void> {
  const trimmedText = text.trim();
  const trimmedName = userName.trim();
  if (!trimmedText || trimmedText.length > 500) {
    throw new Error('Comment text must be 1-500 characters');
  }
  if (!trimmedName || trimmedName.length > 30) {
    throw new Error('User name must be 1-30 characters');
  }

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
