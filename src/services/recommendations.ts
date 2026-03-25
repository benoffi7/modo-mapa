/**
 * Firestore service for the `recommendations` collection.
 */
import {
  collection, addDoc, getDocs, updateDoc, doc, writeBatch,
  query, where, serverTimestamp, getCountFromServer,
} from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { recommendationConverter } from '../config/converters';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';
import { EVT_RECOMMENDATION_SENT } from '../constants/analyticsEvents';
import { MAX_RECOMMENDATION_MESSAGE_LENGTH } from '../constants/validation';
import type { Recommendation } from '../types';

export function getRecommendationsCollection(): CollectionReference<Recommendation> {
  return collection(db, COLLECTIONS.RECOMMENDATIONS)
    .withConverter(recommendationConverter) as CollectionReference<Recommendation>;
}

export async function createRecommendation(
  senderId: string,
  senderName: string,
  recipientId: string,
  businessId: string,
  businessName: string,
  message: string,
): Promise<void> {
  if (!senderId || !recipientId || !businessId) {
    throw new Error('senderId, recipientId, and businessId are required');
  }
  if (senderId === recipientId) {
    throw new Error('No podes recomendarte a vos mismo');
  }
  const trimmed = message.trim().slice(0, MAX_RECOMMENDATION_MESSAGE_LENGTH);

  await addDoc(collection(db, COLLECTIONS.RECOMMENDATIONS), {
    senderId,
    senderName,
    recipientId,
    businessId,
    businessName,
    message: trimmed,
    read: false,
    createdAt: serverTimestamp(),
  });

  incrementSentTodayCache(senderId);
  invalidateQueryCache(COLLECTIONS.RECOMMENDATIONS, senderId);
  trackEvent(EVT_RECOMMENDATION_SENT, { business_id: businessId, recipient_id: recipientId });
}

export async function markRecommendationAsRead(recommendationId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.RECOMMENDATIONS, recommendationId), { read: true });
}

export async function markAllRecommendationsAsRead(userId: string): Promise<void> {
  const unread = await getDocs(
    query(
      collection(db, COLLECTIONS.RECOMMENDATIONS),
      where('recipientId', '==', userId),
      where('read', '==', false),
    ),
  );
  if (unread.empty) return;
  const batch = writeBatch(db);
  for (const d of unread.docs) {
    batch.update(d.ref, { read: true });
  }
  await batch.commit();
  invalidateQueryCache(COLLECTIONS.RECOMMENDATIONS, userId);
}

export async function countUnreadRecommendations(userId: string): Promise<number> {
  const snap = await getCountFromServer(
    query(
      collection(db, COLLECTIONS.RECOMMENDATIONS),
      where('recipientId', '==', userId),
      where('read', '==', false),
    ),
  );
  return snap.data().count;
}

const sentTodayCache = new Map<string, { count: number; day: number }>();

/** @internal test-only */
export function _resetSentTodayCacheForTest(): void {
  sentTodayCache.clear();
}

export async function countRecommendationsSentToday(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayTs = today.getTime();

  const cached = sentTodayCache.get(userId);
  if (cached && cached.day === dayTs) return cached.count;

  try {
    const snap = await getCountFromServer(
      query(
        collection(db, COLLECTIONS.RECOMMENDATIONS),
        where('senderId', '==', userId),
        where('createdAt', '>=', today),
      ),
    );
    const count = snap.data().count;
    sentTodayCache.set(userId, { count, day: dayTs });
    return count;
  } catch {
    // Offline: return cached value from previous session or 0
    return cached?.count ?? 0;
  }
}

function incrementSentTodayCache(userId: string): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayTs = today.getTime();
  const cached = sentTodayCache.get(userId);
  if (cached && cached.day === dayTs) {
    cached.count++;
  } else {
    sentTodayCache.set(userId, { count: 1, day: dayTs });
  }
}
