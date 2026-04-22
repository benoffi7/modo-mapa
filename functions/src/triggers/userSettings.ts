import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDb } from '../helpers/env';
import { trackFunctionTiming } from '../utils/perfTracker';

/**
 * Syncs profilePublic from userSettings to the users doc for denormalized access.
 * This allows cross-user reads of profilePublic without exposing all settings.
 */
export const onUserSettingsWritten = onDocumentWritten(
  'userSettings/{userId}',
  async (event) => {
    const startMs = performance.now();
    const db = getDb();
    const userId = event.params.userId;
    const after = event.data?.after;

    if (!after?.exists) return;

    const profilePublic = after.data()?.profilePublic === true;

    await db.doc(`users/${userId}`).update({ profilePublic }).catch(() => {
      // User doc might not exist yet — set with merge
      return db.doc(`users/${userId}`).set({ profilePublic }, { merge: true });
    });
    await trackFunctionTiming('onUserSettingsWritten', startMs);
  },
);
