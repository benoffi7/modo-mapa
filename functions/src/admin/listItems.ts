import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { FieldValue } from 'firebase-admin/firestore';
import { assertAdmin } from '../helpers/assertAdmin';
import { ENFORCE_APP_CHECK_ADMIN, getDb } from '../helpers/env';
import { checkCallableRateLimit } from '../utils/callableRateLimit';
import { logAbuse } from '../utils/abuseLogger';
import { captureException } from '../utils/sentry';
import { trackFunctionTiming } from '../utils/perfTracker';

interface AdminDeleteListItemRequest {
  itemId: string;
}

const ITEM_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Deletes a `listItems/{itemId}` doc as admin.
 * Atomically decrements `sharedLists/{listId}.itemCount`.
 * Admin-only. Rate-limited per admin (50/day) and writes `abuseLog` for audit trail.
 */
export const adminDeleteListItem = onCall<AdminDeleteListItemRequest>(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, timeoutSeconds: 30 },
  async (request): Promise<{ success: true }> => {
    const start = performance.now();
    const { auth, data } = request;
    const adminAuth = assertAdmin(auth);
    const db = getDb();

    // Validate input
    if (!data || typeof data.itemId !== 'string' || data.itemId.length === 0) {
      throw new HttpsError('invalid-argument', 'itemId is required');
    }
    if (!ITEM_ID_REGEX.test(data.itemId)) {
      throw new HttpsError('invalid-argument', 'itemId contains invalid characters');
    }

    // Rate limit the callable itself
    await checkCallableRateLimit(
      db,
      `admin_delete_list_item_${adminAuth.uid}`,
      50,
      adminAuth.uid,
    );

    try {
      const itemRef = db.collection('listItems').doc(data.itemId);
      const itemSnap = await itemRef.get();
      if (!itemSnap.exists) {
        throw new HttpsError('not-found', 'List item not found');
      }

      const itemData = itemSnap.data() as
        | { listId?: string; businessId?: string; addedBy?: string }
        | undefined;
      const listId = typeof itemData?.listId === 'string' ? itemData.listId : '';
      const businessId = typeof itemData?.businessId === 'string' ? itemData.businessId : '';

      if (!listId) {
        throw new HttpsError('failed-precondition', 'List item has no listId');
      }

      // Atomic batch — delete item + decrement counter on parent list
      const batch = db.batch();
      batch.delete(itemRef);
      batch.update(db.collection('sharedLists').doc(listId), {
        itemCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();

      await logAbuse(db, {
        userId: adminAuth.uid,
        type: 'config_edit',
        collection: 'listItems',
        detail: JSON.stringify({
          action: 'delete_list_item',
          itemId: data.itemId,
          listId,
          businessId,
          addedBy: itemData?.addedBy ?? '',
        }),
      });

      await trackFunctionTiming('adminDeleteListItem', start);
      return { success: true };
    } catch (err) {
      if (!(err instanceof HttpsError)) {
        captureException(err);
        logger.error('adminDeleteListItem failed', { error: String(err) });
      }
      await trackFunctionTiming('adminDeleteListItem', start);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', 'No se pudo eliminar el item');
    }
  },
);
