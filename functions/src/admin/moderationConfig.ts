import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../helpers/assertAdmin';
import { ENFORCE_APP_CHECK_ADMIN, getDb } from '../helpers/env';
import { checkCallableRateLimit } from '../utils/callableRateLimit';
import { logAbuse } from '../utils/abuseLogger';

/**
 * Update moderation bannedWords config.
 * Admin-only callable with rate limiting and audit logging.
 */
export const updateModerationConfig = onCall<{ bannedWords: string[] }>(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, timeoutSeconds: 60 },
  async (request) => {
    const { auth, data } = request;
    const adminAuth = assertAdmin(auth);
    const db = getDb();

    // Validate input
    if (!Array.isArray(data.bannedWords)) {
      throw new HttpsError('invalid-argument', 'bannedWords must be an array');
    }

    if (data.bannedWords.length > 500) {
      throw new HttpsError('invalid-argument', 'bannedWords array exceeds 500 items');
    }

    for (const word of data.bannedWords) {
      if (typeof word !== 'string') {
        throw new HttpsError('invalid-argument', 'Each bannedWord must be a string');
      }
      if (word.length > 50) {
        throw new HttpsError('invalid-argument', 'Each bannedWord must be 50 characters or less');
      }
    }

    // Rate limit: 5 per day per admin
    await checkCallableRateLimit(db, `moderation_edit_${adminAuth.uid}`, 5, adminAuth.uid);

    // Read previous config for audit log
    const configRef = db.collection('config').doc('moderation');
    const prevSnap = await configRef.get();
    const prevWords: string[] = prevSnap.exists ? (prevSnap.data()?.bannedWords ?? []) : [];

    // Write updated config
    await configRef.set({ bannedWords: data.bannedWords }, { merge: true });

    // Audit log
    await logAbuse(db, {
      userId: adminAuth.uid,
      type: 'config_edit',
      collection: 'config',
      detail: JSON.stringify({
        field: 'bannedWords',
        before: prevWords,
        after: data.bannedWords,
      }),
    });

    return { success: true };
  },
);
