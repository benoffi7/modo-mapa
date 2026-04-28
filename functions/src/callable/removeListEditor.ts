import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { logger } from 'firebase-functions';
import { ENFORCE_APP_CHECK, getDb } from '../helpers/env';
import { checkCallableRateLimit } from '../utils/callableRateLimit';

const DAILY_REMOVE_LIMIT = 10;

/**
 * Hash UID para correlacion en logs sin exponer en claro.
 * Mismo patron que inviteListEditor.hashEmail / cleanAnonymousData.uidHash.
 */
function hashUid(uid: string): string {
  return createHash('sha256').update(uid).digest('hex').slice(0, 12);
}

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

    await checkCallableRateLimit(db, `editors_remove_${request.auth.uid}`, DAILY_REMOVE_LIMIT, request.auth.uid);

    const listSnap = await db.doc(`sharedLists/${listId}`).get();
    if (!listSnap.exists) throw new HttpsError('not-found', 'Lista no encontrada');

    const list = listSnap.data()!;
    if (list.ownerId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Solo el creador puede remover editores');
    }

    // R13 mirror de inviteListEditor — uniform response anti-enumeration:
    // si targetUid no esta en editorIds, devolvemos success idempotente
    // sin mutar. De este modo invite("ghost@x") + remove(uidDeGhost) NO
    // permiten distinguir si el email/uid existe vs si el invite fue silently
    // suppressed por uniform response del callable hermano.
    const editorIds: string[] = list.editorIds ?? [];
    if (!editorIds.includes(targetUid)) {
      logger.warn('removeListEditor: target not in editors', {
        listId,
        ownerUid: request.auth.uid,
        targetUidHash: hashUid(targetUid),
      });
      return { success: true };
    }

    await db.doc(`sharedLists/${listId}`).update({
      editorIds: FieldValue.arrayRemove(targetUid),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  },
);
