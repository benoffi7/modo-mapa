import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createHash } from 'crypto';
import { logger } from 'firebase-functions';
import { ENFORCE_APP_CHECK, getDb } from '../helpers/env';
import { checkCallableRateLimit } from '../utils/callableRateLimit';

const MAX_EDITORS = 5;
const DAILY_INVITE_LIMIT = 10;

/**
 * Hash email para correlacion en logs sin exponer PII en claro.
 * Patron consistente con `cleanAnonymousData.ts` (sha256(uid).slice(0,12)).
 */
function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 12);
}

export const inviteListEditor = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

    const { listId, targetEmail, databaseId } = request.data as { listId: string; targetEmail: string; databaseId?: string };
    if (!listId || typeof listId !== 'string') {
      throw new HttpsError('invalid-argument', 'listId required');
    }
    if (!targetEmail || typeof targetEmail !== 'string') {
      throw new HttpsError('invalid-argument', 'email required');
    }

    const db = getDb(databaseId);

    await checkCallableRateLimit(db, `editors_invite_${request.auth.uid}`, DAILY_INVITE_LIMIT, request.auth.uid);

    const listSnap = await db.doc(`sharedLists/${listId}`).get();
    if (!listSnap.exists) throw new HttpsError('not-found', 'Lista no encontrada');

    const list = listSnap.data()!;
    if (list.ownerId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Solo el creador puede invitar editores');
    }

    // R13 — uniform response anti-enumeration:
    // los 3 paths (email no registrado, self, ya editor) devuelven `{success:true}`
    // con shape identico al happy path. NO logueamos email en claro — usamos hash.

    // Find user by email via Firebase Auth (users collection doesn't store email)
    let targetUid: string | null;
    try {
      const userRecord = await getAuth().getUserByEmail(targetEmail.toLowerCase().trim());
      targetUid = userRecord.uid;
    } catch {
      logger.warn('inviteListEditor: target email not registered', {
        listId,
        ownerUid: request.auth.uid,
        emailHash: hashEmail(targetEmail),
      });
      return { success: true };
    }

    // Self-invite — silent success
    if (targetUid === request.auth.uid) {
      logger.warn('inviteListEditor: self-invite suppressed', {
        listId,
        ownerUid: request.auth.uid,
        emailHash: hashEmail(targetEmail),
      });
      return { success: true };
    }

    const editorIds: string[] = list.editorIds ?? [];

    // Already editor — idempotent success
    if (editorIds.includes(targetUid)) {
      logger.warn('inviteListEditor: target already editor', {
        listId,
        ownerUid: request.auth.uid,
        emailHash: hashEmail(targetEmail),
      });
      return { success: true };
    }

    // Cap excedido — owner ya conoce el estado de su propia lista, no es leak
    if (editorIds.length >= MAX_EDITORS) {
      throw new HttpsError('resource-exhausted', 'Máximo 5 editores por lista');
    }

    await db.doc(`sharedLists/${listId}`).update({
      editorIds: FieldValue.arrayUnion(targetUid),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  },
);
