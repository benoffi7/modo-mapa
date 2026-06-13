/**
 * Admin services — list items moderation wrappers (#327).
 *
 * Thin wrapper around the `adminDeleteListItem` Firebase callable. The
 * callable atomically deletes the `listItems/{itemId}` doc and decrements
 * `sharedLists/{listId}.itemCount`, plus writes an `abuseLogs` entry.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';

interface DeleteListItemRequest {
  itemId: string;
}

interface SuccessResponse {
  success: true;
}

/** Delete a `listItems/{itemId}` doc with cascade decrement of `itemCount`. Admin-only. */
export async function adminDeleteListItem(itemId: string): Promise<void> {
  const fn = httpsCallable<DeleteListItemRequest, SuccessResponse>(
    functions,
    'adminDeleteListItem',
  );
  await fn({ itemId });
}
