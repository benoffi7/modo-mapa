import { beforeUserCreated } from 'firebase-functions/v2/identity';
import { HttpsError } from 'firebase-functions/v2/https';
import { getDb } from '../helpers/env';
import { checkIpRateLimit, getIpActionCount, hashIp } from '../utils/ipRateLimiter';
import { logAbuse } from '../utils/abuseLogger';
import {
  MAX_ANON_CREATES_PER_IP_PER_DAY,
  ANON_FLOOD_ALERT_THRESHOLD,
} from '../constants/ipRateLimits';

export const onBeforeUserCreated = beforeUserCreated(async (event) => {
  const ip = event.ipAddress;
  const isAnonymous = event.additionalUserInfo?.providerId === 'anonymous';

  // Only rate-limit anonymous account creation
  if (!isAnonymous || !ip) return;

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
});
