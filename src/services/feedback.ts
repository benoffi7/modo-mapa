/**
 * Firestore service for the `feedback` collection.
 */
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';

export async function sendFeedback(
  userId: string,
  message: string,
  category: string,
): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.FEEDBACK), {
    userId,
    message,
    category,
    createdAt: serverTimestamp(),
  });
}
