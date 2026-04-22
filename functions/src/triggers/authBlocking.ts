import { beforeUserCreated } from 'firebase-functions/v2/identity';
import { HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { getDb } from '../helpers/env';
import { checkIpRateLimit, getIpActionCount, hashIp } from '../utils/ipRateLimiter';
import { logAbuse } from '../utils/abuseLogger';
import {
  MAX_ANON_CREATES_PER_IP_PER_DAY,
  ANON_FLOOD_ALERT_THRESHOLD,
} from '../constants/ipRateLimits';

/**
 * Seed `userSettings/{uid}` with `profilePublic: false` default.
 * Idempotent via `{ merge: true }` — will not overwrite existing settings.
 *
 * Guarantees that the `follows` rule (which requires
 * `exists(userSettings) && profilePublic == true`) never fails because of a
 * race with `onUserCreated`.
 */
async function seedUserSettings(uid: string): Promise<void> {
  try {
    const db = getDb();
    await db.doc(`userSettings/${uid}`).set(
      {
        profilePublic: false,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    // Best-effort — do not block sign-up if the seed fails (onUserCreated or
    // the client AuthContext will reconcile).
    logger.error('seedUserSettings_failed', { uid, error: String(err) });
  }
}

export const onBeforeUserCreated = beforeUserCreated(async (event) => {
  const ip = event.ipAddress;
  const uid = event.data?.uid;
  const isAnonymous = event.additionalUserInfo?.providerId === 'anonymous';

  // Rate-limit anonymous account creation when we can identify an IP
  if (isAnonymous && ip) {
    const db = getDb();

    // Check if alert threshold reached (log but don't block)
    const currentCount = await getIpActionCount(db, 'anon_create', ip);
    if (currentCount >= ANON_FLOOD_ALERT_THRESHOLD && currentCount < MAX_ANON_CREATES_PER_IP_PER_DAY) {
      await logAbuse(db, {
        userId: hashIp(ip),
        type: 'anon_flood',
        detail: `IP created ${currentCount + 1} anonymous accounts today (threshold: ${ANON_FLOOD_ALERT_THRESHOLD})`,
        severity: 'medium',
      });
    }

    // Check rate limit (block if exceeded)
    const exceeded = await checkIpRateLimit(
      db,
      { action: 'anon_create', limit: MAX_ANON_CREATES_PER_IP_PER_DAY },
      ip,
    );

    if (exceeded) {
      await logAbuse(db, {
        userId: hashIp(ip),
        type: 'anon_flood',
        detail: `IP exceeded ${MAX_ANON_CREATES_PER_IP_PER_DAY} anonymous accounts/day — blocked`,
        severity: 'high',
      });
      throw new HttpsError('resource-exhausted', 'Too many accounts created from this network.');
    }
  }

  // #300 R-10: seed userSettings with profilePublic=false default so the
  // follows rule (exists(userSettings) && profilePublic == true) never races.
  if (uid) {
    await seedUserSettings(uid);
  }
});
