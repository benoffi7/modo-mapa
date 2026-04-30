/** Tipos de acciones encolables offline */
export type OfflineActionType =
  | 'rating_upsert'
  | 'rating_delete'
  | 'comment_create'
  | 'favorite_add'
  | 'favorite_remove'
  | 'price_level_upsert'
  | 'price_level_delete'
  | 'tag_add'
  | 'tag_remove'
  | 'comment_like'
  | 'comment_unlike'
  | 'checkin_create'
  | 'checkin_delete'
  | 'follow_add'
  | 'follow_remove'
  | 'recommendation_create'
  | 'recommendation_read'
  // Lists domain (#304)
  | 'list_create'
  | 'list_update'
  | 'list_toggle_public'
  | 'list_delete'
  | 'list_item_add'
  | 'list_item_remove'
  // NEW (#323)
  | 'comment_edit'
  | 'comment_delete'
  | 'rating_criteria_upsert';

/** Status de una acción en cola */
export type OfflineActionStatus = 'pending' | 'syncing' | 'failed';

/** Estructura de una acción encolada en IndexedDB */
export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: OfflineActionPayload;
  userId: string;
  businessId: string;
  businessName?: string;
  /** Generic reference ID for actions where businessId doesn't apply (e.g. recommendation_read stores recommendationId here) */
  referenceId?: string;
  /** List ID for list_* action types (#304) */
  listId?: string;
  createdAt: number;
  retryCount: number;
  status: OfflineActionStatus;
}

/** Union de payloads por tipo de acción. userId/businessId are on OfflineAction, not here. */
export type OfflineActionPayload =
  | RatingUpsertPayload
  | RatingDeletePayload
  | CommentCreatePayload
  | FavoriteTogglePayload
  | PriceLevelUpsertPayload
  | PriceLevelDeletePayload
  | TagTogglePayload
  | CommentLikePayload
  | CheckinCreatePayload
  | CheckinDeletePayload
  | FollowPayload
  | RecommendationPayload
  // Lists domain (#304)
  | ListCreatePayload
  | ListUpdatePayload
  | ListTogglePublicPayload
  | ListDeletePayload
  | ListItemAddPayload
  // NEW (#323)
  | CommentEditPayload
  | CommentDeletePayload
  | RatingCriteriaUpsertPayload
  | EmptyPayload;

export interface RatingUpsertPayload {
  score: number;
  criteria?: import('./index').RatingCriteria;
}

export interface RatingDeletePayload {
  _type: 'rating_delete';
}

export interface CommentCreatePayload {
  userName: string;
  text: string;
  parentId?: string;
  questionType?: boolean;
}

export interface FavoriteTogglePayload {
  action: 'add' | 'remove';
}

export interface PriceLevelUpsertPayload {
  level: number;
}

export interface PriceLevelDeletePayload {
  _type: 'price_level_delete';
}

export interface TagTogglePayload {
  tagId: string;
}

export interface CommentLikePayload {
  commentId: string;
}

export interface CheckinCreatePayload {
  businessName: string;
  location?: { lat: number; lng: number } | undefined;
}

export interface CheckinDeletePayload {
  checkInId: string;
}

export interface RecommendationPayload {
  recipientId: string;
  businessName: string;
  senderName: string;
  message: string;
}

export interface FollowPayload {
  followedId: string;
}

/** Lists domain payloads (#304) */
export interface ListCreatePayload {
  name: string;
  description: string;
  icon?: string;
}

export interface ListUpdatePayload {
  name: string;
  description: string;
  color?: string;
  icon?: string;
}

export interface ListTogglePublicPayload {
  isPublic: boolean;
}

export interface ListDeletePayload {
  ownerId: string;
}

export interface ListItemAddPayload {
  addedBy?: string;
}

/** Edit de comment ya sincronizado. Replay → editComment(commentId, userId, text). (#323) */
export interface CommentEditPayload {
  commentId: string;
  text: string;
}

/** Delete de comment ya sincronizado. Replay → deleteComment(commentId, userId).
 * onCommentDeleted Cloud Function se encarga del cascade server-side. (#323) */
export interface CommentDeletePayload {
  commentId: string;
}

/** Upsert parcial de un criterio individual de rating.
 * Replay → upsertCriteriaRating(userId, businessId, { [criterionId]: value }).
 * El service hace merge no-destructivo con criterios existentes. (#323) */
export interface RatingCriteriaUpsertPayload {
  criterionId: import('./business').RatingCriterionId;
  value: number;
}

/** For action types that need no extra data beyond userId/businessId on the action */
export interface EmptyPayload {
  _type?: string;
}
