import type { OfflineAction } from '../types/offline';
import * as offlineQueue from './offlineQueue';
import { OFFLINE_MAX_RETRIES } from '../constants/offline';
import type {
  RatingUpsertPayload,
  CommentCreatePayload,
  PriceLevelUpsertPayload,
  TagTogglePayload,
  CommentLikePayload,
  CheckinCreatePayload,
  CheckinDeletePayload,
  FollowPayload,
  RecommendationPayload,
  ListCreatePayload,
  ListUpdatePayload,
  ListTogglePublicPayload,
  ListDeletePayload,
  ListItemAddPayload,
  CommentEditPayload,
  CommentDeletePayload,
  RatingCriteriaUpsertPayload,
} from '../types/offline';

let syncing = false;

export async function executeAction(action: OfflineAction): Promise<void> {
  const { userId, businessId } = action;
  const p = action.payload;
  switch (action.type) {
    case 'rating_upsert': {
      const { score, criteria } = p as RatingUpsertPayload;
      const { upsertRating } = await import('./ratings');
      await upsertRating(userId, businessId, score, criteria);
      break;
    }
    case 'rating_delete': {
      const { deleteRating } = await import('./ratings');
      await deleteRating(userId, businessId);
      break;
    }
    case 'comment_create': {
      const { userName, text, parentId, questionType } = p as CommentCreatePayload;
      if (questionType) {
        const { createQuestion } = await import('./comments');
        await createQuestion(userId, userName, businessId, text);
      } else {
        const { addComment } = await import('./comments');
        await addComment(userId, userName, businessId, text, parentId);
      }
      break;
    }
    case 'favorite_add': {
      const { addFavorite } = await import('./favorites');
      await addFavorite(userId, businessId);
      break;
    }
    case 'favorite_remove': {
      const { removeFavorite } = await import('./favorites');
      await removeFavorite(userId, businessId);
      break;
    }
    case 'price_level_upsert': {
      const { level } = p as PriceLevelUpsertPayload;
      const { upsertPriceLevel } = await import('./priceLevels');
      await upsertPriceLevel(userId, businessId, level);
      break;
    }
    case 'price_level_delete': {
      const { deletePriceLevel } = await import('./priceLevels');
      await deletePriceLevel(userId, businessId);
      break;
    }
    case 'tag_add': {
      const { tagId } = p as TagTogglePayload;
      const { addUserTag } = await import('./tags');
      await addUserTag(userId, businessId, tagId);
      break;
    }
    case 'tag_remove': {
      const { tagId } = p as TagTogglePayload;
      const { removeUserTag } = await import('./tags');
      await removeUserTag(userId, businessId, tagId);
      break;
    }
    case 'comment_like': {
      const { commentId } = p as CommentLikePayload;
      const { likeComment } = await import('./comments');
      await likeComment(userId, commentId);
      break;
    }
    case 'comment_unlike': {
      const { commentId } = p as CommentLikePayload;
      const { unlikeComment } = await import('./comments');
      await unlikeComment(userId, commentId);
      break;
    }
    case 'checkin_create': {
      const { businessName, location } = p as CheckinCreatePayload;
      const { createCheckIn } = await import('./checkins');
      await createCheckIn(userId, businessId, businessName, location);
      break;
    }
    case 'checkin_delete': {
      const { checkInId } = p as CheckinDeletePayload;
      const { deleteCheckIn } = await import('./checkins');
      await deleteCheckIn(userId, checkInId);
      break;
    }
    case 'follow_add': {
      const { followedId } = p as FollowPayload;
      const { followUser } = await import('./follows');
      await followUser(userId, followedId);
      break;
    }
    case 'follow_remove': {
      const { followedId } = p as FollowPayload;
      const { unfollowUser } = await import('./follows');
      await unfollowUser(userId, followedId);
      break;
    }
    case 'recommendation_create': {
      const { recipientId, businessName, senderName, message } = p as RecommendationPayload;
      const { createRecommendation } = await import('./recommendations');
      await createRecommendation(userId, senderName, recipientId, businessId, businessName, message);
      break;
    }
    case 'recommendation_read': {
      const { markRecommendationAsRead } = await import('./recommendations');
      await markRecommendationAsRead(action.referenceId ?? businessId);
      break;
    }
    case 'list_create': {
      const { name, description, icon } = p as ListCreatePayload;
      const { createList } = await import('./sharedLists');
      await createList(userId, name, description, icon, action.listId);
      break;
    }
    case 'list_update': {
      const { name, description, color, icon } = p as ListUpdatePayload;
      const { updateList } = await import('./sharedLists');
      if (!action.listId) throw new Error('list_update requires listId');
      await updateList(action.listId, name, description, color, icon);
      break;
    }
    case 'list_toggle_public': {
      const { isPublic } = p as ListTogglePublicPayload;
      const { toggleListPublic } = await import('./sharedLists');
      if (!action.listId) throw new Error('list_toggle_public requires listId');
      await toggleListPublic(action.listId, isPublic);
      break;
    }
    case 'list_delete': {
      const { ownerId } = p as ListDeletePayload;
      const { deleteList } = await import('./sharedLists');
      if (!action.listId) throw new Error('list_delete requires listId');
      await deleteList(action.listId, ownerId);
      break;
    }
    case 'list_item_add': {
      const { addedBy } = p as ListItemAddPayload;
      const { addBusinessToList } = await import('./sharedLists');
      if (!action.listId) throw new Error('list_item_add requires listId');
      await addBusinessToList(action.listId, businessId, addedBy);
      break;
    }
    case 'list_item_remove': {
      const { removeBusinessFromList } = await import('./sharedLists');
      if (!action.listId) throw new Error('list_item_remove requires listId');
      await removeBusinessFromList(action.listId, businessId);
      break;
    }
    case 'comment_edit': {
      const { commentId, text } = p as CommentEditPayload;
      const { editComment } = await import('./comments');
      await editComment(commentId, userId, text);
      break;
    }
    case 'comment_delete': {
      const { commentId } = p as CommentDeletePayload;
      const { deleteComment } = await import('./comments');
      await deleteComment(commentId, userId);
      break;
    }
    case 'rating_criteria_upsert': {
      const { criterionId, value } = p as RatingCriteriaUpsertPayload;
      const { upsertCriteriaRating } = await import('./ratings');
      await upsertCriteriaRating(userId, businessId, { [criterionId]: value });
      break;
    }
  }
}

export async function processQueue(
  onActionSynced: (action: OfflineAction) => void,
  onActionFailed: (action: OfflineAction, error: Error) => void,
  onComplete: (syncedCount: number, failedCount: number) => void,
): Promise<void> {
  if (syncing) return;
  syncing = true;

  try {
    await offlineQueue.cleanup();
    const pending = await offlineQueue.getPending();

    let syncedCount = 0;
    let failedCount = 0;
    const deferred: OfflineAction[] = [];

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
          deferred.push(action);
        }
      }
    }

    onComplete(syncedCount, failedCount);
  } finally {
    syncing = false;
  }
}

/** Reset for testing */
export function _resetSyncingForTest(): void {
  syncing = false;
}
