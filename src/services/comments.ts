/**
 * Firestore service for the `comments` collection.
 */
import { collection, addDoc, deleteDoc, setDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
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

export async function editComment(commentId: string, userId: string, newText: string): Promise<void> {
  const trimmed = newText.trim();
  if (!trimmed || trimmed.length > 500) {
    throw new Error('Comment text must be 1-500 characters');
  }
  await updateDoc(doc(db, COLLECTIONS.COMMENTS, commentId), {
    text: trimmed,
    updatedAt: serverTimestamp(),
  });
  invalidateQueryCache(COLLECTIONS.COMMENTS, userId);
}

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.COMMENTS, commentId));
  invalidateQueryCache(COLLECTIONS.COMMENTS, userId);
}

export async function likeComment(userId: string, commentId: string): Promise<void> {
  const docId = `${userId}__${commentId}`;
  await setDoc(doc(db, COLLECTIONS.COMMENT_LIKES, docId), {
    userId,
    commentId,
    createdAt: serverTimestamp(),
  });
}

export async function unlikeComment(userId: string, commentId: string): Promise<void> {
  const docId = `${userId}__${commentId}`;
  await deleteDoc(doc(db, COLLECTIONS.COMMENT_LIKES, docId));
}
