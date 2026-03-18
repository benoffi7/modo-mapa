import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { assertAdmin } from '../helpers/assertAdmin';
import { IS_EMULATOR } from '../helpers/env';

export const toggleFeaturedList = onCall(
  { enforceAppCheck: !IS_EMULATOR },
  async (request) => {
    assertAdmin(request.auth as never);

    const { listId, featured } = request.data as { listId: string; featured: boolean };
    if (!listId || typeof listId !== 'string') {
      throw new HttpsError('invalid-argument', 'listId required');
    }
    if (typeof featured !== 'boolean') {
      throw new HttpsError('invalid-argument', 'featured must be boolean');
    }

    const db = getFirestore();
    const listRef = db.doc(`sharedLists/${listId}`);
    const snap = await listRef.get();

    if (!snap.exists) throw new HttpsError('not-found', 'Lista no encontrada');

    if (featured && !snap.data()?.isPublic) {
      throw new HttpsError('failed-precondition', 'Solo listas públicas pueden ser destacadas');
    }

    await listRef.update({ featured });
    return { success: true };
  },
);
