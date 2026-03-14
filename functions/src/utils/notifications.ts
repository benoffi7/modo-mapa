import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

type NotificationType = 'like' | 'photo_approved' | 'photo_rejected' | 'ranking' | 'feedback_response';

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

const TYPE_TO_SETTING: Record<NotificationType, string> = {
  like: 'notifyLikes',
  photo_approved: 'notifyPhotos',
  photo_rejected: 'notifyPhotos',
  ranking: 'notifyRankings',
  feedback_response: 'notifyFeedback',
};

async function shouldNotify(
  db: Firestore,
  userId: string,
  type: NotificationType,
): Promise<boolean> {
  const settingsDoc = await db.doc(`userSettings/${userId}`).get();

  if (!settingsDoc.exists) {
    // No settings doc → defaults are all false (notifications off)
    return false;
  }

  const data = settingsDoc.data()!;

  // Master toggle
  if (data.notificationsEnabled !== true) return false;

  // Per-type toggle
  const settingKey = TYPE_TO_SETTING[type];
  return data[settingKey] === true;
}

export async function createNotification(
  db: Firestore,
  data: CreateNotificationData,
): Promise<void> {
  // Check user notification preferences
  const allowed = await shouldNotify(db, data.userId, data.type);
  if (!allowed) return;

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
