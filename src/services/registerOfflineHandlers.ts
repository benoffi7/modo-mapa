import type { OfflineAction, OfflineActionType } from '../types/offline';
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
import { registerOfflineHandler } from './offlineHandlerRegistry';
import type { OfflineHandler } from './offlineHandlerRegistry';

/**
 * Tabla de handlers por tipo de acción offline (#335).
 *
 * Es un `Record<OfflineActionType, OfflineHandler>`: TypeScript exige que TODOS
 * los miembros de la union `OfflineActionType` esten presentes — si se agrega un
 * tipo nuevo a la union sin handler aca, falla la compilacion. Esto reemplaza el
 * exhaustiveness implicito del switch anterior.
 *
 * Cada handler mantiene el `await import('./service')` dinamico del switch
 * original para preservar el cold-start lazy (los services no entran al import
 * chain de syncEngine en tests) — COMPORTAMIENTO IDENTICO.
 */
const OFFLINE_HANDLERS: Record<OfflineActionType, OfflineHandler> = {
  rating_upsert: async ({ userId, businessId, payload }: OfflineAction) => {
    const { score, criteria } = payload as RatingUpsertPayload;
    const { upsertRating } = await import('./ratings');
    await upsertRating(userId, businessId, score, criteria);
  },
  rating_delete: async ({ userId, businessId }: OfflineAction) => {
    const { deleteRating } = await import('./ratings');
    await deleteRating(userId, businessId);
  },
  comment_create: async ({ userId, businessId, payload }: OfflineAction) => {
    const { userName, text, parentId, questionType } = payload as CommentCreatePayload;
    if (questionType) {
      const { createQuestion } = await import('./comments');
      await createQuestion(userId, userName, businessId, text);
    } else {
      const { addComment } = await import('./comments');
      await addComment(userId, userName, businessId, text, parentId);
    }
  },
  favorite_add: async ({ userId, businessId }: OfflineAction) => {
    const { addFavorite } = await import('./favorites');
    await addFavorite(userId, businessId);
  },
  favorite_remove: async ({ userId, businessId }: OfflineAction) => {
    const { removeFavorite } = await import('./favorites');
    await removeFavorite(userId, businessId);
  },
  price_level_upsert: async ({ userId, businessId, payload }: OfflineAction) => {
    const { level } = payload as PriceLevelUpsertPayload;
    const { upsertPriceLevel } = await import('./priceLevels');
    await upsertPriceLevel(userId, businessId, level);
  },
  price_level_delete: async ({ userId, businessId }: OfflineAction) => {
    const { deletePriceLevel } = await import('./priceLevels');
    await deletePriceLevel(userId, businessId);
  },
  tag_add: async ({ userId, businessId, payload }: OfflineAction) => {
    const { tagId } = payload as TagTogglePayload;
    const { addUserTag } = await import('./tags');
    await addUserTag(userId, businessId, tagId);
  },
  tag_remove: async ({ userId, businessId, payload }: OfflineAction) => {
    const { tagId } = payload as TagTogglePayload;
    const { removeUserTag } = await import('./tags');
    await removeUserTag(userId, businessId, tagId);
  },
  comment_like: async ({ userId, businessId, payload }: OfflineAction) => {
    const { commentId } = payload as CommentLikePayload;
    const { likeComment } = await import('./comments');
    await likeComment(userId, commentId, businessId);
  },
  comment_unlike: async ({ userId, payload }: OfflineAction) => {
    const { commentId } = payload as CommentLikePayload;
    const { unlikeComment } = await import('./comments');
    await unlikeComment(userId, commentId);
  },
  checkin_create: async ({ userId, businessId, payload }: OfflineAction) => {
    const { businessName, location } = payload as CheckinCreatePayload;
    const { createCheckIn } = await import('./checkins');
    await createCheckIn(userId, businessId, businessName, location);
  },
  checkin_delete: async ({ userId, payload }: OfflineAction) => {
    const { checkInId } = payload as CheckinDeletePayload;
    const { deleteCheckIn } = await import('./checkins');
    await deleteCheckIn(userId, checkInId);
  },
  follow_add: async ({ userId, payload }: OfflineAction) => {
    const { followedId } = payload as FollowPayload;
    const { followUser } = await import('./follows');
    await followUser(userId, followedId);
  },
  follow_remove: async ({ userId, payload }: OfflineAction) => {
    const { followedId } = payload as FollowPayload;
    const { unfollowUser } = await import('./follows');
    await unfollowUser(userId, followedId);
  },
  recommendation_create: async ({ userId, businessId, payload }: OfflineAction) => {
    const { recipientId, businessName, senderName, message } = payload as RecommendationPayload;
    const { createRecommendation } = await import('./recommendations');
    await createRecommendation(userId, senderName, recipientId, businessId, businessName, message);
  },
  recommendation_read: async ({ businessId, referenceId }: OfflineAction) => {
    const { markRecommendationAsRead } = await import('./recommendations');
    await markRecommendationAsRead(referenceId ?? businessId);
  },
  list_create: async ({ userId, listId, payload }: OfflineAction) => {
    const { name, description, icon } = payload as ListCreatePayload;
    const { createList } = await import('./sharedLists');
    await createList(userId, name, description, icon, listId);
  },
  list_update: async ({ listId, payload }: OfflineAction) => {
    const { name, description, color, icon } = payload as ListUpdatePayload;
    const { updateList } = await import('./sharedLists');
    if (!listId) throw new Error('list_update requires listId');
    await updateList(listId, name, description, color, icon);
  },
  list_toggle_public: async ({ listId, payload }: OfflineAction) => {
    const { isPublic } = payload as ListTogglePublicPayload;
    const { toggleListPublic } = await import('./sharedLists');
    if (!listId) throw new Error('list_toggle_public requires listId');
    await toggleListPublic(listId, isPublic);
  },
  list_delete: async ({ listId, payload }: OfflineAction) => {
    const { ownerId } = payload as ListDeletePayload;
    const { deleteList } = await import('./sharedLists');
    if (!listId) throw new Error('list_delete requires listId');
    await deleteList(listId, ownerId);
  },
  list_item_add: async ({ businessId, listId, payload }: OfflineAction) => {
    const { addedBy } = payload as ListItemAddPayload;
    const { addBusinessToList } = await import('./sharedLists');
    if (!listId) throw new Error('list_item_add requires listId');
    await addBusinessToList(listId, businessId, addedBy);
  },
  list_item_remove: async ({ businessId, listId }: OfflineAction) => {
    const { removeBusinessFromList } = await import('./sharedLists');
    if (!listId) throw new Error('list_item_remove requires listId');
    await removeBusinessFromList(listId, businessId);
  },
  comment_edit: async ({ userId, payload }: OfflineAction) => {
    const { commentId, text } = payload as CommentEditPayload;
    const { editComment } = await import('./comments');
    await editComment(commentId, userId, text);
  },
  comment_delete: async ({ userId, payload }: OfflineAction) => {
    const { commentId } = payload as CommentDeletePayload;
    const { deleteComment } = await import('./comments');
    await deleteComment(commentId, userId);
  },
  rating_criteria_upsert: async ({ userId, businessId, payload }: OfflineAction) => {
    const { criterionId, value } = payload as RatingCriteriaUpsertPayload;
    const { upsertCriteriaRating } = await import('./ratings');
    await upsertCriteriaRating(userId, businessId, { [criterionId]: value });
  },
};

let registered = false;

/**
 * Registra todos los handlers en el registry. Idempotente: solo registra una
 * vez por proceso. `dispatch` (syncEngine) la invoca antes del lookup.
 */
export function registerOfflineHandlers(): void {
  if (registered) return;
  for (const type of Object.keys(OFFLINE_HANDLERS) as OfflineActionType[]) {
    registerOfflineHandler(type, OFFLINE_HANDLERS[type]);
  }
  registered = true;
}

/** Test-only: permite re-registrar tras `__resetOfflineHandlersForTests`. */
export function __resetRegisteredFlagForTests(): void {
  registered = false;
}
