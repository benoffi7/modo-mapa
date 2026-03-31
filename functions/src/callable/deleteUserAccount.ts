import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { logger } from 'firebase-functions';
import { ENFORCE_APP_CHECK, getDb } from '../helpers/env';
import { deleteAllUserData } from '../utils/deleteUserData';
import { logAbuse } from '../utils/abuseLogger';
import { USER_OWNED_COLLECTIONS } from '../shared/userOwnedCollections';
import type { DeletionStatus } from '../utils/deleteUserData';

const RATE_LIMIT_SECONDS = 60;

export const deleteUserAccount = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    if (!request.auth.token.email) {
      throw new HttpsError('permission-denied', 'Anonymous accounts cannot be deleted via this endpoint');
    }

    const uid = request.auth.uid;
    const { databaseId } = (request.data as { databaseId?: string }) ?? {};
    const db = getDb(databaseId);

    // Rate limit: 1 per minute
    const rateLimitRef = db.doc(`_rateLimits/delete_${uid}`);
    const rateLimitSnap = await rateLimitRef.get();
    if (rateLimitSnap.exists) {
      const lastAttempt = rateLimitSnap.data()?.lastAttempt?.toDate?.();
      if (lastAttempt && Date.now() - lastAttempt.getTime() < RATE_LIMIT_SECONDS * 1000) {
        throw new HttpsError('resource-exhausted', 'Please wait before retrying');
      }
    }
    await rateLimitRef.set({ lastAttempt: FieldValue.serverTimestamp(), userId: uid });

    // Delete all user data (aggregates, collections, storage)
    const result = await deleteAllUserData(db, uid);

    // Delete Firebase Auth user
    try {
      await getAuth().deleteUser(uid);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    const uidHash = createHash('sha256').update(uid).digest('hex').slice(0, 12);

    // Determine status from result
    const status: DeletionStatus =
      result.collectionsFailed.length === 0 && result.aggregatesCorrected
        ? 'success'
        : result.collectionsFailed.length === USER_OWNED_COLLECTIONS.length
          ? 'failure'
          : 'partial_failure';

    // Persist audit log (best-effort — don't block user response)
    try {
      await db.collection('deletionAuditLogs').add({
        uidHash,
        type: 'account_delete',
        status,
        collectionsProcessed: result.collectionsProcessed,
        collectionsFailed: result.collectionsFailed,
        storageFilesDeleted: result.storageFilesDeleted,
        storageFilesFailed: result.storageFilesFailed,
        aggregatesCorrected: result.aggregatesCorrected,
        durationMs: result.durationMs,
        triggeredBy: 'user',
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.error('Failed to persist deletion audit log', { uidHash, error: String(err) });
    }

    // Log abuse on failure
    if (status !== 'success') {
      try {
        await logAbuse(db, {
          userId: uidHash,
          type: 'deletion_failure',
          detail: `account_delete ${status}: ${result.collectionsFailed.length} collections failed [${result.collectionsFailed.join(', ')}], aggregates=${result.aggregatesCorrected}`,
        });
      } catch (err) {
        logger.error('Failed to log deletion abuse', { uidHash, error: String(err) });
      }
    }

    logger.info('account_deleted', { uidHash, status, timestamp: new Date().toISOString() });

    return { success: true };
  },
);
