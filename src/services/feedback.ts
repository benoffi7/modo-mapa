/**
 * Firestore service for the `feedback` collection.
 */
import { collection, addDoc, getDocs, doc, updateDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { feedbackConverter } from '../config/converters';
import { trackEvent } from '../utils/analytics';
import { VALID_CATEGORIES } from '../constants/feedback';
import { MAX_FEEDBACK_LENGTH } from '../constants/validation';
import type { FeedbackCategory, Feedback } from '../types';

export async function sendFeedback(
  userId: string,
  message: string,
  category: FeedbackCategory,
): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > MAX_FEEDBACK_LENGTH) {
    throw new Error('Feedback message must be 1-1000 characters');
  }
  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error('Invalid feedback category');
  }

  await addDoc(collection(db, COLLECTIONS.FEEDBACK), {
    userId,
    message: trimmed,
    category,
    createdAt: serverTimestamp(),
  });
  trackEvent('feedback_submit', { category });
}

export async function fetchUserFeedback(userId: string): Promise<Feedback[]> {
  const ref = collection(db, COLLECTIONS.FEEDBACK).withConverter(feedbackConverter);
  const q = query(ref, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function markFeedbackViewed(feedbackId: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.FEEDBACK, feedbackId);
  await updateDoc(ref, { viewedByUser: true });
}
