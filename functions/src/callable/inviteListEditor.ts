import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { ENFORCE_APP_CHECK, getDb } from '../helpers/env';

const MAX_EDITORS = 5;

export const inviteListEditor = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

    const { listId, targetEmail } = request.data as { listId: string; targetEmail: string };
    if (!listId || typeof listId !== 'string') {
      throw new HttpsError('invalid-argument', 'listId required');
    }
    if (!targetEmail || typeof targetEmail !== 'string') {
      throw new HttpsError('invalid-argument', 'email required');
    }

    const db = getDb();
    const listSnap = await db.doc(`sharedLists/${listId}`).get();
    if (!listSnap.exists) throw new HttpsError('not-found', 'Lista no encontrada');

    const list = listSnap.data()!;
    if (list.ownerId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Solo el creador puede invitar editores');
    }

    // Find user by email
    const usersSnap = await db.collection('users')
      .where('email', '==', targetEmail.toLowerCase().trim())
      .limit(1).get();
    if (usersSnap.empty) {
      throw new HttpsError('not-found', 'Usuario no encontrado');
    }

    const targetUid = usersSnap.docs[0].id;
    if (targetUid === request.auth.uid) {
      throw new HttpsError('invalid-argument', 'No podés invitarte a vos mismo');
    }

    const editorIds: string[] = list.editorIds ?? [];
    if (editorIds.includes(targetUid)) {
      throw new HttpsError('already-exists', 'Este usuario ya es editor');
    }
    if (editorIds.length >= MAX_EDITORS) {
      throw new HttpsError('resource-exhausted', 'Máximo 5 editores por lista');
    }

    await db.doc(`sharedLists/${listId}`).update({
      editorIds: FieldValue.arrayUnion(targetUid),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true, targetUid };
  },
);
