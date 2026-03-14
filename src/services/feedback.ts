/**
 * Firestore + Storage service for the `feedback` collection.
 */
import { collection, addDoc, getDocs, doc, updateDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { feedbackConverter } from '../config/converters';
import { trackEvent } from '../utils/analytics';
import { VALID_CATEGORIES, MAX_FEEDBACK_MEDIA_SIZE } from '../constants/feedback';
import { MAX_FEEDBACK_LENGTH } from '../constants/validation';
import type { FeedbackCategory, Feedback } from '../types';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function sendFeedback(
  userId: string,
  message: string,
  category: FeedbackCategory,
  mediaFile?: File,
): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > MAX_FEEDBACK_LENGTH) {
    throw new Error('Feedback message must be 1-1000 characters');
  }
  if (!VALID_CATEGORIES.includes(category)) {
    throw new Error('Invalid feedback category');
  }

  if (mediaFile) {
    if (!ALLOWED_IMAGE_TYPES.includes(mediaFile.type)) {
      throw new Error('Formato no soportado. Usa JPG, PNG o WebP.');
    }
    if (mediaFile.size > MAX_FEEDBACK_MEDIA_SIZE) {
      throw new Error('La imagen es muy grande. Máximo 10 MB.');
    }
  }

  const docRef = await addDoc(collection(db, COLLECTIONS.FEEDBACK), {
    userId,
    message: trimmed,
    category,
    createdAt: serverTimestamp(),
  });

  if (mediaFile) {
    const storagePath = `feedback-media/${docRef.id}/${mediaFile.name}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, mediaFile, { contentType: mediaFile.type });
    const mediaUrl = await getDownloadURL(storageRef);
    await updateDoc(docRef, { mediaUrl, mediaType: 'image' });
  }

  trackEvent('feedback_submit', { category });
}

export async function fetchUserFeedback(userId: string): Promise<Feedback[]> {
  const ref = collection(db, COLLECTIONS.FEEDBACK).withConverter(feedbackConverter);
  const q = query(ref, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function markFeedbackViewed(feedbackId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.FEEDBACK, feedbackId);
  await updateDoc(docRef, { viewedByUser: true });
}
