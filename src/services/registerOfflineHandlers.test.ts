import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { OfflineAction, OfflineActionType } from '../types/offline';

// Mocks de todos los services que invocan los handlers (#335).
vi.mock('./ratings', () => ({
  upsertRating: vi.fn().mockResolvedValue(undefined),
  deleteRating: vi.fn().mockResolvedValue(undefined),
  upsertCriteriaRating: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./comments', () => ({
  addComment: vi.fn().mockResolvedValue(undefined),
  createQuestion: vi.fn().mockResolvedValue('q1'),
  likeComment: vi.fn().mockResolvedValue(undefined),
  unlikeComment: vi.fn().mockResolvedValue(undefined),
  editComment: vi.fn().mockResolvedValue(undefined),
  deleteComment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./favorites', () => ({
  addFavorite: vi.fn().mockResolvedValue(undefined),
  removeFavorite: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./priceLevels', () => ({
  upsertPriceLevel: vi.fn().mockResolvedValue(undefined),
  deletePriceLevel: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./tags', () => ({
  addUserTag: vi.fn().mockResolvedValue(undefined),
  removeUserTag: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./checkins', () => ({
  createCheckIn: vi.fn().mockResolvedValue(undefined),
  deleteCheckIn: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./follows', () => ({
  followUser: vi.fn().mockResolvedValue(undefined),
  unfollowUser: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./recommendations', () => ({
  createRecommendation: vi.fn().mockResolvedValue(undefined),
  markRecommendationAsRead: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./sharedLists', () => ({
  createList: vi.fn().mockResolvedValue('list1'),
  updateList: vi.fn().mockResolvedValue(undefined),
  toggleListPublic: vi.fn().mockResolvedValue(undefined),
  deleteList: vi.fn().mockResolvedValue(undefined),
  addBusinessToList: vi.fn().mockResolvedValue(undefined),
  removeBusinessFromList: vi.fn().mockResolvedValue(undefined),
}));

import {
  registerOfflineHandlers,
  __resetRegisteredFlagForTests,
} from './registerOfflineHandlers';
import {
  getOfflineHandler,
  hasOfflineHandler,
  __resetOfflineHandlersForTests,
} from './offlineHandlerRegistry';

// Lista canonica de todos los tipos de la union OfflineActionType. El test
// "cada tipo tiene handler" la cruza contra el registry; si se agrega un tipo
// nuevo a la union sin handler, falla la compilacion del Record en
// registerOfflineHandlers.ts Y este test (si se olvida actualizar la lista).
const ALL_ACTION_TYPES: OfflineActionType[] = [
  'rating_upsert',
  'rating_delete',
  'comment_create',
  'favorite_add',
  'favorite_remove',
  'price_level_upsert',
  'price_level_delete',
  'tag_add',
  'tag_remove',
  'comment_like',
  'comment_unlike',
  'checkin_create',
  'checkin_delete',
  'follow_add',
  'follow_remove',
  'recommendation_create',
  'recommendation_read',
  'list_create',
  'list_update',
  'list_toggle_public',
  'list_delete',
  'list_item_add',
  'list_item_remove',
  'comment_edit',
  'comment_delete',
  'rating_criteria_upsert',
];

function makeAction(overrides: Partial<OfflineAction> = {}): OfflineAction {
  return {
    id: crypto.randomUUID(),
    type: 'rating_upsert',
    payload: { score: 4 },
    userId: 'u1',
    businessId: 'b1',
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
    ...overrides,
  };
}

describe('registerOfflineHandlers (#335 registry pattern)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetOfflineHandlersForTests();
    __resetRegisteredFlagForTests();
  });

  it('registers a handler for every OfflineActionType', () => {
    registerOfflineHandlers();
    for (const type of ALL_ACTION_TYPES) {
      expect(hasOfflineHandler(type), `missing handler for ${type}`).toBe(true);
    }
  });

  it('registers exactly the canonical set (no extra, no missing)', () => {
    registerOfflineHandlers();
    const registeredCount = ALL_ACTION_TYPES.filter((t) => hasOfflineHandler(t)).length;
    expect(registeredCount).toBe(ALL_ACTION_TYPES.length);
  });

  it('is idempotent: calling twice does not throw and keeps handlers', () => {
    registerOfflineHandlers();
    registerOfflineHandlers();
    expect(hasOfflineHandler('rating_upsert')).toBe(true);
  });

  it('dispatches rating_criteria_upsert to upsertCriteriaRating', async () => {
    registerOfflineHandlers();
    const handler = getOfflineHandler('rating_criteria_upsert')!;
    const { upsertCriteriaRating } = await import('./ratings');
    await handler(makeAction({ type: 'rating_criteria_upsert', payload: { criterionId: 'food', value: 4 } }));
    expect(upsertCriteriaRating).toHaveBeenCalledWith('u1', 'b1', { food: 4 });
  });

  it('dispatches comment_edit to editComment', async () => {
    registerOfflineHandlers();
    const handler = getOfflineHandler('comment_edit')!;
    const { editComment } = await import('./comments');
    await handler(makeAction({ type: 'comment_edit', payload: { commentId: 'c1', text: 'Editado' } }));
    expect(editComment).toHaveBeenCalledWith('c1', 'u1', 'Editado');
  });

  it('list_item_remove handler throws without listId', async () => {
    registerOfflineHandlers();
    const handler = getOfflineHandler('list_item_remove')!;
    await expect(
      handler(makeAction({ type: 'list_item_remove', payload: {} })),
    ).rejects.toThrow('list_item_remove requires listId');
  });
});
