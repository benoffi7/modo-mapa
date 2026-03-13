import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

type NotificationType = 'like' | 'photo_approved' | 'photo_rejected' | 'ranking';

interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  message: string;
  actorId?: string;
  actorName?: string;
  businessId?: string;
  businessName?: string;
  referenceId?: string;
}

const EXPIRY_DAYS = 30;

export async function createNotification(
  db: Firestore,
  data: CreateNotificationData,
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

  await db.collection('notifications').add({
    userId: data.userId,
    type: data.type,
    message: data.message,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
    ...(data.actorId != null && { actorId: data.actorId }),
    ...(data.actorName != null && { actorName: data.actorName }),
    ...(data.businessId != null && { businessId: data.businessId }),
    ...(data.businessName != null && { businessName: data.businessName }),
    ...(data.referenceId != null && { referenceId: data.referenceId }),
  });
}
