import { httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { functions, db } from '../../config/firebase';
import { COLLECTIONS } from '../../config/collections';
import { moderationLogConverter } from '../../config/adminConverters';
import type {
  ModerationAction,
  ModerationLog,
} from '../../types/admin';

/**
 * Moderate a comment via Cloud Function
 */
export async function moderateComment(
  commentId: string,
  action: ModerationAction,
  reason?: string
): Promise<void> {
  const func = httpsCallable<{
    commentId: string;
    action: ModerationAction;
    reason?: string;
  }>(functions, 'moderateComment');
  await func({ commentId, action, reason });
}

/**
 * Moderate a rating via Cloud Function
 */
export async function moderateRating(
  ratingId: string,
  reason?: string
): Promise<void> {
  const func = httpsCallable<{
    ratingId: string;
    reason?: string;
  }>(functions, 'moderateRating');
  await func({ ratingId, reason });
}

/**
 * Moderate a custom tag via Cloud Function
 */
export async function moderateCustomTag(
  tagId: string,
  reason?: string
): Promise<void> {
  const func = httpsCallable<{
    tagId: string;
    reason?: string;
  }>(functions, 'moderateCustomTag');
  await func({ tagId, reason });
}

/**
 * Fetch latest moderation logs
 */
export async function fetchModerationLogs(
  pageSize: number = 20
): Promise<ModerationLog[]> {
  const q = query(
    collection(db, COLLECTIONS.MODERATION_LOGS).withConverter(moderationLogConverter),
    orderBy('timestamp', 'desc'),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
}
