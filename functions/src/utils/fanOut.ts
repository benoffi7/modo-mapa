import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import {
  FANOUT_DEDUP_WINDOW_MS,
  FANOUT_MAX_RECIPIENTS_PER_ACTION,
} from '../constants/fanOut';
import { trackFunctionTiming } from './perfTracker';

interface FanOutData {
  actorId: string;
  actorName: string;
  type: 'rating' | 'comment' | 'favorite';
  businessId: string;
  businessName: string;
  referenceId: string;
}

/**
 * Deterministic dedup doc id for `_fanoutDedup/{id}`.
 * One entry per (actor, type, business, follower) within the dedup window.
 */
export function fanOutDedupKey(
  actorId: string,
  type: string,
  businessId: string,
  followerId: string,
): string {
  return createHash('sha256')
    .update(`${actorId}|${type}|${businessId}|${followerId}`)
    .digest('hex');
}

/**
 * Fan-out write: for each follower of the actor, write an activity feed item.
 *
 * Safety rails added in #300:
 * - Skip if actor's profile is private (`userSettings.profilePublic === false`).
 * - Dedup per (actor, type, business, follower) via `_fanoutDedup/{sha256}`
 *   within FANOUT_DEDUP_WINDOW_MS (24h default).
 * - Cap total recipients at FANOUT_MAX_RECIPIENTS_PER_ACTION (5000 default).
 */
export async function fanOutToFollowers(
  db: Firestore,
  data: FanOutData,
): Promise<void> {
  const startMs = performance.now();

  // Check actor's profile is public (skip fan-out only if explicitly set to private)
  const settingsSnap = await db.doc(`userSettings/${data.actorId}`).get();
  if (settingsSnap.exists && settingsSnap.data()?.profilePublic === false) {
    await trackFunctionTiming('fanOutToFollowers', startMs);
    return;
  }

  // Get followers up to the recipient cap — limit at query level to avoid fetching unbounded collections
  const followersSnap = await db.collection('follows')
    .where('followedId', '==', data.actorId)
    .limit(FANOUT_MAX_RECIPIENTS_PER_ACTION)
    .get();

  if (followersSnap.empty) {
    await trackFunctionTiming('fanOutToFollowers', startMs);
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const now = Date.now();
  const cutoff = now - FANOUT_DEDUP_WINDOW_MS;

  const recipients = followersSnap.docs;

  let batch = db.batch();
  let count = 0;

  for (const followDoc of recipients) {
    const followerId = followDoc.data().followerId as string;
    const dedupKey = fanOutDedupKey(data.actorId, data.type, data.businessId, followerId);
    const dedupRef = db.collection('_fanoutDedup').doc(dedupKey);
    const dedupSnap = await dedupRef.get();

    if (dedupSnap.exists) {
      // Support both Timestamp (prod) and number (tests) for createdAt
      const raw = dedupSnap.get('createdAt');
      let createdAtMs = 0;
      if (raw && typeof raw.toMillis === 'function') {
        createdAtMs = raw.toMillis();
      } else if (typeof raw === 'number') {
        createdAtMs = raw;
      }
      if (createdAtMs >= cutoff) {
        continue; // within dedup window — skip this recipient
      }
      // else: doc expired, overwrite below
    }

    const feedRef = db.collection('activityFeed').doc(followerId)
      .collection('items').doc();

    batch.set(dedupRef, {
      actorId: data.actorId,
      type: data.type,
      businessId: data.businessId,
      followerId,
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.set(feedRef, {
      actorId: data.actorId,
      actorName: data.actorName,
      type: data.type,
      businessId: data.businessId,
      businessName: data.businessName,
      referenceId: data.referenceId,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

    count += 2;
    // Firestore batch hard cap is 500 writes; we write 2 per recipient
    if (count >= 500) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  await trackFunctionTiming('fanOutToFollowers', startMs);
}
