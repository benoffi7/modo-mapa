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
  | 'tag_remove';

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

/** Union de payloads por tipo de accion */
export type OfflineActionPayload =
  | RatingUpsertPayload
  | RatingDeletePayload
  | CommentCreatePayload
  | FavoriteTogglePayload
  | PriceLevelUpsertPayload
  | PriceLevelDeletePayload
  | TagAddPayload
  | TagRemovePayload;

export interface RatingUpsertPayload {
  userId: string;
  businessId: string;
  score: number;
  criteria?: import('./index').RatingCriteria;
}

export interface RatingDeletePayload {
  userId: string;
  businessId: string;
}

export interface CommentCreatePayload {
  userId: string;
  userName: string;
  businessId: string;
  text: string;
  parentId?: string;
}

export interface FavoriteTogglePayload {
  userId: string;
  businessId: string;
  action: 'add' | 'remove';
}

export interface PriceLevelUpsertPayload {
  userId: string;
  businessId: string;
  level: number;
}

export interface PriceLevelDeletePayload {
  userId: string;
  businessId: string;
}

export interface TagAddPayload {
  userId: string;
  businessId: string;
  tagId: string;
}

export interface TagRemovePayload {
  userId: string;
  businessId: string;
  tagId: string;
}
