/**
 * Firestore service for the `comments` collection.
 */
import { collection, addDoc, deleteDoc, setDoc, updateDoc, doc, serverTimestamp, increment, writeBatch } from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { commentConverter } from '../config/converters';
import { invalidateQueryCache } from '../hooks/usePaginatedQuery';
import { trackEvent } from '../utils/analytics';
import { MAX_COMMENT_LENGTH, MAX_DISPLAY_NAME_LENGTH } from '../constants/validation';
import type { Comment } from '../types';

export function getCommentsCollection(): CollectionReference<Comment> {
  return collection(db, COLLECTIONS.COMMENTS).withConverter(commentConverter) as CollectionReference<Comment>;
}

export async function addComment(
  userId: string,
  userName: string,
  businessId: string,
  text: string,
  parentId?: string,
): Promise<void> {
  const trimmedText = text.trim();
  const trimmedName = userName.trim();
  if (!trimmedText || trimmedText.length > MAX_COMMENT_LENGTH) {
    throw new Error('Comment text must be 1-500 characters');
  }
  if (!trimmedName || trimmedName.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new Error('User name must be 1-30 characters');
  }

  if (parentId) {
    // Use batch for atomic reply + parent replyCount increment
    const batch = writeBatch(db);
    const newRef = doc(collection(db, COLLECTIONS.COMMENTS));
    batch.set(newRef, {
      userId,
      userName,
      businessId,
      text,
      createdAt: serverTimestamp(),
      parentId,
    });
    batch.update(doc(db, COLLECTIONS.COMMENTS, parentId), {
      replyCount: increment(1),
    });
    await batch.commit();
  } else {
    await addDoc(collection(db, COLLECTIONS.COMMENTS), {
      userId,
      userName,
      businessId,
      text,
      createdAt: serverTimestamp(),
    });
  }

  invalidateQueryCache(COLLECTIONS.COMMENTS, userId);
  trackEvent('comment_submit', { business_id: businessId, is_edit: false, is_reply: !!parentId });
}

export async function editComment(commentId: string, userId: string, newText: string): Promise<void> {
  const trimmed = newText.trim();
  if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error('Comment text must be 1-500 characters');
  }
  await updateDoc(doc(db, COLLECTIONS.COMMENTS, commentId), {
    text: trimmed,
    updatedAt: serverTimestamp(),
  });
  invalidateQueryCache(COLLECTIONS.COMMENTS, userId);
  trackEvent('comment_submit', { is_edit: true });
}

export async function deleteComment(commentId: string, userId: string, parentId?: string): Promise<void> {
  if (parentId) {
    // Use batch for atomic delete + parent replyCount decrement
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.COMMENTS, commentId));
    batch.update(doc(db, COLLECTIONS.COMMENTS, parentId), {
      replyCount: increment(-1),
    });
    await batch.commit();
  } else {
    await deleteDoc(doc(db, COLLECTIONS.COMMENTS, commentId));
  }

  invalidateQueryCache(COLLECTIONS.COMMENTS, userId);
}

export async function likeComment(userId: string, commentId: string): Promise<void> {
  const docId = `${userId}__${commentId}`;
  await setDoc(doc(db, COLLECTIONS.COMMENT_LIKES, docId), {
    userId,
    commentId,
    createdAt: serverTimestamp(),
  });
  trackEvent('comment_like', { comment_id: commentId });
}

export async function unlikeComment(userId: string, commentId: string): Promise<void> {
  const docId = `${userId}__${commentId}`;
  await deleteDoc(doc(db, COLLECTIONS.COMMENT_LIKES, docId));
}
