/**
 * Firestore service for the `checkins` collection.
 */
import { collection, doc, addDoc, deleteDoc, getDocs, query, where, orderBy, limit as firestoreLimit, serverTimestamp } from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { checkinConverter } from '../config/converters';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';
import type { CheckIn } from '../types';

export function getCheckinsCollection(): CollectionReference<CheckIn> {
  return collection(db, COLLECTIONS.CHECKINS).withConverter(checkinConverter) as CollectionReference<CheckIn>;
}

export async function createCheckIn(
  userId: string,
  businessId: string,
  businessName: string,
  location?: { lat: number; lng: number },
): Promise<string> {
  if (!userId || !businessId || !businessName) {
    throw new Error('userId, businessId, and businessName are required');
  }
  if (!/^biz_\d{3}$/.test(businessId)) {
    throw new Error('Invalid businessId format');
  }

  const ref = await addDoc(collection(db, COLLECTIONS.CHECKINS), {
    userId,
    businessId,
    businessName,
    createdAt: serverTimestamp(),
    ...(location && { location }),
  });

  invalidateQueryCache(COLLECTIONS.CHECKINS, userId);
  trackEvent('checkin_created', {
    business_id: businessId,
    has_location: String(!!location),
  });

  return ref.id;
}

export async function fetchMyCheckIns(
  userId: string,
  limitCount?: number,
): Promise<CheckIn[]> {
  const q = limitCount
    ? query(getCheckinsCollection(), where('userId', '==', userId), orderBy('createdAt', 'desc'), firestoreLimit(limitCount))
    : query(getCheckinsCollection(), where('userId', '==', userId), orderBy('createdAt', 'desc'));

  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function fetchCheckInsForBusiness(
  businessId: string,
  userId: string,
): Promise<CheckIn[]> {
  const snap = await getDocs(
    query(
      getCheckinsCollection(),
      where('userId', '==', userId),
      where('businessId', '==', businessId),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => d.data());
}

export async function deleteCheckIn(userId: string, checkInId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.CHECKINS, checkInId));
  invalidateQueryCache(COLLECTIONS.CHECKINS, userId);
  trackEvent('checkin_deleted', { checkin_id: checkInId });
}
