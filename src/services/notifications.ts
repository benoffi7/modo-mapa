import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  getCountFromServer,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { notificationConverter } from '../config/converters';
import type { AppNotification } from '../types';

export async function fetchUserNotifications(
  userId: string,
  maxResults = 50,
): Promise<AppNotification[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.NOTIFICATIONS).withConverter(notificationConverter),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(maxResults),
    ),
  );
  return snap.docs.map((d) => d.data());
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('userId', '==', userId),
      where('read', '==', false),
    ),
  );
  if (snap.empty) return;

  const batch = writeBatch(db);
  for (const d of snap.docs) {
    batch.update(d.ref, { read: true });
  }
  await batch.commit();
}

export async function getUnreadCount(userId: string): Promise<number> {
  const snap = await getCountFromServer(
    query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('userId', '==', userId),
      where('read', '==', false),
    ),
  );
  return snap.data().count;
}
