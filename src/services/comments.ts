/**
 * Firestore service for the `comments` collection.
 */
import { collection, addDoc, deleteDoc, setDoc, updateDoc, doc, serverTimestamp, query, where, orderBy, getDocs } from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { commentConverter } from '../config/converters';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';
import { MAX_COMMENT_LENGTH, MAX_DISPLAY_NAME_LENGTH } from '../constants/validation';
import { MAX_QUESTION_LENGTH } from '../constants/questions';
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

  const commentData: Record<string, unknown> = {
    userId,
    userName: trimmedName,
    businessId,
    text: trimmedText,
    createdAt: serverTimestamp(),
  };
  if (parentId) {
    commentData.parentId = parentId;
  }
  await addDoc(collection(db, COLLECTIONS.COMMENTS), commentData);

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

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.COMMENTS, commentId));
  // replyCount decrement and cascade delete of orphaned replies
  // are handled server-side by the onCommentDeleted Cloud Function.
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

export async function fetchQuestions(businessId: string): Promise<Comment[]> {
  const q = query(
    getCommentsCollection(),
    where('businessId', '==', businessId),
    where('type', '==', 'question'),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function createQuestion(
  userId: string,
  userName: string,
  businessId: string,
  text: string,
): Promise<string> {
  const trimmedText = text.trim();
  const trimmedName = userName.trim();
  if (!trimmedText || trimmedText.length > MAX_QUESTION_LENGTH) {
    throw new Error('Question text must be 1-500 characters');
  }
  if (!trimmedName || trimmedName.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new Error('User name must be 1-30 characters');
  }

  const ref = await addDoc(collection(db, COLLECTIONS.COMMENTS), {
    userId,
    userName: trimmedName,
    businessId,
    text: trimmedText,
    type: 'question',
    createdAt: serverTimestamp(),
  });

  invalidateQueryCache(COLLECTIONS.COMMENTS, userId);
  trackEvent('question_created', { business_id: businessId });
  return ref.id;
}
