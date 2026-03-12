/**
 * Firestore service for the `feedback` collection.
 */
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import type { FeedbackCategory } from '../types';

const VALID_CATEGORIES: FeedbackCategory[] = ['bug', 'sugerencia', 'otro'];

export async function sendFeedback(
  userId: string,
  message: string,
  category: FeedbackCategory,
): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 1000) {
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
}
