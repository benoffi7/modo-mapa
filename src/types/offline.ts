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
  | 'comment_unlike';

/** Status de una accion en cola */
export type OfflineActionStatus = 'pending' | 'syncing' | 'failed';

/** Estructura de una accion encolada en IndexedDB */
export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: OfflineActionPayload;
  userId: string;
  businessId: string;
  businessName?: string;
  createdAt: number;
  retryCount: number;
  status: OfflineActionStatus;
}

/** Union de payloads por tipo de accion. userId/businessId are on OfflineAction, not here. */
export type OfflineActionPayload =
  | RatingUpsertPayload
  | RatingDeletePayload
  | CommentCreatePayload
  | FavoriteTogglePayload
  | PriceLevelUpsertPayload
  | PriceLevelDeletePayload
  | TagTogglePayload
  | CommentLikePayload
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

/** For action types that need no extra data beyond userId/businessId on the action */
export interface EmptyPayload {
  _type?: string;
}
