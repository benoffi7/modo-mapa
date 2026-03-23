import type { OfflineAction } from '../types/offline';
import * as offlineQueue from './offlineQueue';
import { OFFLINE_MAX_RETRIES, OFFLINE_BACKOFF_BASE_MS } from '../constants/offline';
import type {
  RatingUpsertPayload,
  RatingDeletePayload,
  CommentCreatePayload,
  FavoriteTogglePayload,
  PriceLevelUpsertPayload,
  PriceLevelDeletePayload,
  TagAddPayload,
  TagRemovePayload,
} from '../types/offline';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeAction(action: OfflineAction): Promise<void> {
  const p = action.payload;
  switch (action.type) {
    case 'rating_upsert': {
      const rp = p as RatingUpsertPayload;
      const { upsertRating } = await import('./ratings');
      await upsertRating(rp.userId, rp.businessId, rp.score, rp.criteria);
      break;
    }
    case 'rating_delete': {
      const rp = p as RatingDeletePayload;
      const { deleteRating } = await import('./ratings');
      await deleteRating(rp.userId, rp.businessId);
      break;
    }
    case 'comment_create': {
      const cp = p as CommentCreatePayload;
      const { addComment } = await import('./comments');
      await addComment(cp.userId, cp.userName, cp.businessId, cp.text, cp.parentId);
      break;
    }
    case 'favorite_add': {
      const fp = p as FavoriteTogglePayload;
      const { addFavorite } = await import('./favorites');
      await addFavorite(fp.userId, fp.businessId);
      break;
    }
    case 'favorite_remove': {
      const fp = p as FavoriteTogglePayload;
      const { removeFavorite } = await import('./favorites');
      await removeFavorite(fp.userId, fp.businessId);
      break;
    }
    case 'price_level_upsert': {
      const pp = p as PriceLevelUpsertPayload;
      const { upsertPriceLevel } = await import('./priceLevels');
      await upsertPriceLevel(pp.userId, pp.businessId, pp.level);
      break;
    }
    case 'price_level_delete': {
      const pp = p as PriceLevelDeletePayload;
      const { deletePriceLevel } = await import('./priceLevels');
      await deletePriceLevel(pp.userId, pp.businessId);
      break;
    }
    case 'tag_add': {
      const tp = p as TagAddPayload;
      const { addUserTag } = await import('./tags');
      await addUserTag(tp.userId, tp.businessId, tp.tagId);
      break;
    }
    case 'tag_remove': {
      const tp = p as TagRemovePayload;
      const { removeUserTag } = await import('./tags');
      await removeUserTag(tp.userId, tp.businessId, tp.tagId);
      break;
    }
  }
}

export async function processQueue(
  onActionSynced: (action: OfflineAction) => void,
  onActionFailed: (action: OfflineAction, error: Error) => void,
  onComplete: (syncedCount: number, failedCount: number) => void,
): Promise<void> {
  await offlineQueue.cleanup();
  const pending = await offlineQueue.getPending();

  let syncedCount = 0;
  let failedCount = 0;

  for (const action of pending) {
    await offlineQueue.updateStatus(action.id, 'syncing');

    try {
      await executeAction(action);
      await offlineQueue.remove(action.id);
      syncedCount++;
      onActionSynced(action);
    } catch (err) {
      const newRetry = action.retryCount + 1;
      if (newRetry >= OFFLINE_MAX_RETRIES) {
        await offlineQueue.updateStatus(action.id, 'failed', newRetry);
        failedCount++;
        onActionFailed(action, err instanceof Error ? err : new Error(String(err)));
      } else {
        await offlineQueue.updateStatus(action.id, 'pending', newRetry);
        const backoff = OFFLINE_BACKOFF_BASE_MS * Math.pow(2, newRetry);
        await delay(backoff);
      }
    }
  }

  onComplete(syncedCount, failedCount);
}
