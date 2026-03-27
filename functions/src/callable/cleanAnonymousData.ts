import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { logger } from 'firebase-functions';
import { ENFORCE_APP_CHECK, getDb } from '../helpers/env';
import { deleteAllUserData } from '../utils/deleteUserData';

const RATE_LIMIT_SECONDS = 60;

/**
 * Cleans all server-side data for an anonymous user.
 * Unlike deleteUserAccount, this does NOT require re-authentication
 * (anonymous users have no password) and does NOT delete the Firebase
 * Auth user (anonymous accounts auto-expire).
 */
export const cleanAnonymousData = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    // Only anonymous users can use this endpoint
    if (request.auth.token.email) {
      throw new HttpsError('permission-denied', 'Use deleteUserAccount for email accounts');
    }

    const uid = request.auth.uid;
    const { databaseId } = (request.data as { databaseId?: string }) ?? {};
    const db = getDb(databaseId);

    // Rate limit: 1 per minute
    const rateLimitRef = db.doc(`_rateLimits/clean_${uid}`);
    const rateLimitSnap = await rateLimitRef.get();
    if (rateLimitSnap.exists) {
      const lastAttempt = rateLimitSnap.data()?.lastAttempt?.toDate?.();
      if (lastAttempt && Date.now() - lastAttempt.getTime() < RATE_LIMIT_SECONDS * 1000) {
        throw new HttpsError('resource-exhausted', 'Please wait before retrying');
      }
    }
    await rateLimitRef.set({ lastAttempt: FieldValue.serverTimestamp(), userId: uid });

    // Delete all user data (aggregates, collections, storage)
    await deleteAllUserData(db, uid);

    // Do NOT delete Firebase Auth user — anonymous accounts auto-expire
    // The client will signOut after this succeeds, creating a fresh anonymous session

    const uidHash = createHash('sha256').update(uid).digest('hex').slice(0, 12);
    logger.info('anonymous_data_cleaned', { uidHash, timestamp: new Date().toISOString() });

    return { success: true };
  },
);
