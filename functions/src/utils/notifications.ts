import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

type NotificationType = 'like' | 'photo_approved' | 'photo_rejected' | 'ranking' | 'feedback_response' | 'comment_reply' | 'new_follower' | 'recommendation';

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
  comment_reply: 'notifyReplies',
  new_follower: 'notifyFollowers',
  recommendation: 'notifyRecommendations',
};

// Must match DEFAULT_SETTINGS in src/services/userSettings.ts
const DEFAULT_SETTINGS: Record<string, boolean> = {
  notificationsEnabled: false,
  notifyLikes: false,
  notifyPhotos: false,
  notifyRankings: false,
  notifyFeedback: true,
  notifyReplies: true,
  notifyFollowers: true,
  notifyRecommendations: true,
};

// Types that bypass the master toggle — these are direct admin-to-user
// communications that should work even if the user hasn't enabled the
// master notifications toggle (as long as the per-type toggle is on).
const BYPASS_MASTER_TOGGLE: Set<NotificationType> = new Set(['feedback_response']);

async function shouldNotify(
  db: Firestore,
  userId: string,
  type: NotificationType,
): Promise<boolean> {
  const settingsDoc = await db.doc(`userSettings/${userId}`).get();

  const data = settingsDoc.exists ? settingsDoc.data()! : DEFAULT_SETTINGS;

  // Master toggle — feedback_response bypasses this because it defaults
  // to enabled and is a direct response from the admin team.
  if (!BYPASS_MASTER_TOGGLE.has(type) && data.notificationsEnabled !== true) {
    return false;
  }

  // Per-type toggle (use default if field is missing)
  const settingKey = TYPE_TO_SETTING[type];
  const value = data[settingKey] ?? DEFAULT_SETTINGS[settingKey] ?? false;
  return value === true;
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
