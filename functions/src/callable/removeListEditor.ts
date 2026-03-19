import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { ENFORCE_APP_CHECK, getDb } from '../helpers/env';

export const removeListEditor = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

    const { listId, targetUid, databaseId } = request.data as { listId: string; targetUid: string; databaseId?: string };
    if (!listId || typeof listId !== 'string') {
      throw new HttpsError('invalid-argument', 'listId required');
    }
    if (!targetUid || typeof targetUid !== 'string') {
      throw new HttpsError('invalid-argument', 'targetUid required');
    }

    const db = getDb(databaseId);
    const listSnap = await db.doc(`sharedLists/${listId}`).get();
    if (!listSnap.exists) throw new HttpsError('not-found', 'Lista no encontrada');

    const list = listSnap.data()!;
    if (list.ownerId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Solo el creador puede remover editores');
    }

    await db.doc(`sharedLists/${listId}`).update({
      editorIds: FieldValue.arrayRemove(targetUid),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  },
);
