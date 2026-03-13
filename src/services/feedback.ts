/**
 * Firestore service for the `feedback` collection.
 */
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { trackEvent } from '../utils/analytics';
import { VALID_CATEGORIES } from '../constants/feedback';
import { MAX_FEEDBACK_LENGTH } from '../constants/validation';
import type { FeedbackCategory } from '../types';

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
