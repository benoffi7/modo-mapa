import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { processQueue, executeAction, _resetSyncingForTest } from './syncEngine';
import * as offlineQueue from './offlineQueue';
import type { OfflineAction } from '../types/offline';

vi.mock('./sharedLists', () => ({
  createList: vi.fn().mockResolvedValue('list1'),
  updateList: vi.fn().mockResolvedValue(undefined),
  toggleListPublic: vi.fn().mockResolvedValue(undefined),
  deleteList: vi.fn().mockResolvedValue(undefined),
  addBusinessToList: vi.fn().mockResolvedValue(undefined),
  removeBusinessFromList: vi.fn().mockResolvedValue(undefined),
}));

// Mock all Firestore services
vi.mock('./ratings', () => ({
  upsertRating: vi.fn().mockResolvedValue(undefined),
  deleteRating: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./comments', () => ({
  addComment: vi.fn().mockResolvedValue(undefined),
  createQuestion: vi.fn().mockResolvedValue('q1'),
  likeComment: vi.fn().mockResolvedValue(undefined),
  unlikeComment: vi.fn().mockResolvedValue(undefined),
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

import { upsertRating, deleteRating } from './ratings';
import { addComment, createQuestion, likeComment, unlikeComment } from './comments';
import { addFavorite, removeFavorite } from './favorites';
import { upsertPriceLevel, deletePriceLevel } from './priceLevels';
import { addUserTag, removeUserTag } from './tags';
import { createCheckIn, deleteCheckIn } from './checkins';
import { followUser, unfollowUser } from './follows';
import { createRecommendation, markRecommendationAsRead } from './recommendations';
import { createList, updateList, toggleListPublic, deleteList, addBusinessToList, removeBusinessFromList } from './sharedLists';

function makeFullAction(overrides: Partial<OfflineAction> = {}): OfflineAction {
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

describe('syncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSyncingForTest();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('executeAction', () => {
    it('maps rating_upsert', async () => {
      await executeAction(makeFullAction({ type: 'rating_upsert', payload: { score: 5 } }));
      expect(upsertRating).toHaveBeenCalledWith('u1', 'b1', 5, undefined);
    });

    it('maps rating_delete', async () => {
      await executeAction(makeFullAction({ type: 'rating_delete', payload: { _type: 'rating_delete' } }));
      expect(deleteRating).toHaveBeenCalledWith('u1', 'b1');
    });

    it('maps comment_create', async () => {
      await executeAction(makeFullAction({
        type: 'comment_create',
        payload: { userName: 'Test', text: 'Hello', parentId: 'p1' },
      }));
      expect(addComment).toHaveBeenCalledWith('u1', 'Test', 'b1', 'Hello', 'p1');
    });

    it('maps comment_create with questionType', async () => {
      await executeAction(makeFullAction({
        type: 'comment_create',
        payload: { userName: 'Test', text: 'Question?', questionType: true },
      }));
      expect(createQuestion).toHaveBeenCalledWith('u1', 'Test', 'b1', 'Question?');
    });

    it('maps favorite_add', async () => {
      await executeAction(makeFullAction({ type: 'favorite_add', payload: { action: 'add' } }));
      expect(addFavorite).toHaveBeenCalledWith('u1', 'b1');
    });

    it('maps favorite_remove', async () => {
      await executeAction(makeFullAction({ type: 'favorite_remove', payload: { action: 'remove' } }));
      expect(removeFavorite).toHaveBeenCalledWith('u1', 'b1');
    });

    it('maps price_level_upsert', async () => {
      await executeAction(makeFullAction({ type: 'price_level_upsert', payload: { level: 2 } }));
      expect(upsertPriceLevel).toHaveBeenCalledWith('u1', 'b1', 2);
    });

    it('maps price_level_delete', async () => {
      await executeAction(makeFullAction({ type: 'price_level_delete', payload: { _type: 'price_level_delete' } }));
      expect(deletePriceLevel).toHaveBeenCalledWith('u1', 'b1');
    });

    it('maps tag_add', async () => {
      await executeAction(makeFullAction({ type: 'tag_add', payload: { tagId: 't1' } }));
      expect(addUserTag).toHaveBeenCalledWith('u1', 'b1', 't1');
    });

    it('maps tag_remove', async () => {
      await executeAction(makeFullAction({ type: 'tag_remove', payload: { tagId: 't1' } }));
      expect(removeUserTag).toHaveBeenCalledWith('u1', 'b1', 't1');
    });

    it('maps comment_like', async () => {
      await executeAction(makeFullAction({ type: 'comment_like', payload: { commentId: 'c1' } }));
      expect(likeComment).toHaveBeenCalledWith('u1', 'c1');
    });

    it('maps comment_unlike', async () => {
      await executeAction(makeFullAction({ type: 'comment_unlike', payload: { commentId: 'c1' } }));
      expect(unlikeComment).toHaveBeenCalledWith('u1', 'c1');
    });

    it('maps checkin_create', async () => {
      await executeAction(makeFullAction({
        type: 'checkin_create',
        payload: { businessName: 'Café', location: { lat: -34.6, lng: -58.3 } },
      }));
      expect(createCheckIn).toHaveBeenCalledWith('u1', 'b1', 'Café', { lat: -34.6, lng: -58.3 });
    });

    it('maps checkin_delete', async () => {
      await executeAction(makeFullAction({
        type: 'checkin_delete',
        payload: { checkInId: 'ci1' },
      }));
      expect(deleteCheckIn).toHaveBeenCalledWith('u1', 'ci1');
    });

    it('maps follow_add', async () => {
      await executeAction(makeFullAction({
        type: 'follow_add',
        payload: { followedId: 'u2' },
      }));
      expect(followUser).toHaveBeenCalledWith('u1', 'u2');
    });

    it('maps follow_remove', async () => {
      await executeAction(makeFullAction({
        type: 'follow_remove',
        payload: { followedId: 'u2' },
      }));
      expect(unfollowUser).toHaveBeenCalledWith('u1', 'u2');
    });

    it('maps recommendation_create', async () => {
      await executeAction(makeFullAction({
        type: 'recommendation_create',
        payload: { recipientId: 'u2', businessName: 'Café', senderName: 'Ana', message: 'Probalo!' },
      }));
      expect(createRecommendation).toHaveBeenCalledWith('u1', 'Ana', 'u2', 'b1', 'Café', 'Probalo!');
    });

    it('maps recommendation_read using referenceId', async () => {
      await executeAction(makeFullAction({
        type: 'recommendation_read',
        referenceId: 'rec1',
        payload: {},
      }));
      expect(markRecommendationAsRead).toHaveBeenCalledWith('rec1');
    });

    it('maps recommendation_read falls back to businessId', async () => {
      await executeAction(makeFullAction({
        type: 'recommendation_read',
        businessId: 'rec-legacy',
        payload: {},
      }));
      expect(markRecommendationAsRead).toHaveBeenCalledWith('rec-legacy');
    });

    // List domain action types (#304)
    it('maps list_create with optional listId', async () => {
      await executeAction(makeFullAction({
        type: 'list_create',
        listId: 'list-client-id',
        payload: { name: 'Mi lista', description: 'desc', icon: 'heart' },
      }));
      expect(createList).toHaveBeenCalledWith('u1', 'Mi lista', 'desc', 'heart', 'list-client-id');
    });

    it('maps list_create without listId', async () => {
      await executeAction(makeFullAction({
        type: 'list_create',
        payload: { name: 'Sin id', description: '' },
      }));
      expect(createList).toHaveBeenCalledWith('u1', 'Sin id', '', undefined, undefined);
    });

    it('maps list_update', async () => {
      await executeAction(makeFullAction({
        type: 'list_update',
        listId: 'list1',
        payload: { name: 'Nuevo', description: 'Desc', color: '#fff', icon: 'star' },
      }));
      expect(updateList).toHaveBeenCalledWith('list1', 'Nuevo', 'Desc', '#fff', 'star');
    });

    it('maps list_toggle_public', async () => {
      await executeAction(makeFullAction({
        type: 'list_toggle_public',
        listId: 'list1',
        payload: { isPublic: true },
      }));
      expect(toggleListPublic).toHaveBeenCalledWith('list1', true);
    });

    it('maps list_delete', async () => {
      await executeAction(makeFullAction({
        type: 'list_delete',
        listId: 'list1',
        payload: { ownerId: 'u1' },
      }));
      expect(deleteList).toHaveBeenCalledWith('list1', 'u1');
    });

    it('maps list_item_add', async () => {
      await executeAction(makeFullAction({
        type: 'list_item_add',
        listId: 'list1',
        businessId: 'biz1',
        payload: { addedBy: 'u2' },
      }));
      expect(addBusinessToList).toHaveBeenCalledWith('list1', 'biz1', 'u2');
    });

    it('maps list_item_remove', async () => {
      await executeAction(makeFullAction({
        type: 'list_item_remove',
        listId: 'list1',
        businessId: 'biz1',
        payload: {},
      }));
      expect(removeBusinessFromList).toHaveBeenCalledWith('list1', 'biz1');
    });

    // Error paths for list actions that require listId — omit listId to test the guard
    it('throws descriptive error for list_update without listId', async () => {
      await expect(
        executeAction(makeFullAction({
          type: 'list_update',
          payload: { name: 'X', description: '' },
        })),
      ).rejects.toThrow('list_update requires listId');
    });

    it('throws descriptive error for list_toggle_public without listId', async () => {
      await expect(
        executeAction(makeFullAction({
          type: 'list_toggle_public',
          payload: { isPublic: false },
        })),
      ).rejects.toThrow('list_toggle_public requires listId');
    });

    it('throws descriptive error for list_delete without listId', async () => {
      await expect(
        executeAction(makeFullAction({
          type: 'list_delete',
          payload: { ownerId: 'u1' },
        })),
      ).rejects.toThrow('list_delete requires listId');
    });

    it('throws descriptive error for list_item_add without listId', async () => {
      await expect(
        executeAction(makeFullAction({
          type: 'list_item_add',
          payload: {},
        })),
      ).rejects.toThrow('list_item_add requires listId');
    });

    it('throws descriptive error for list_item_remove without listId', async () => {
      await expect(
        executeAction(makeFullAction({
          type: 'list_item_remove',
          payload: {},
        })),
      ).rejects.toThrow('list_item_remove requires listId');
    });
  });

  describe('processQueue', () => {
    it('processes pending actions and calls onComplete', async () => {
      const action = makeFullAction();
      vi.spyOn(offlineQueue, 'cleanup').mockResolvedValue(0);
      vi.spyOn(offlineQueue, 'getPending').mockResolvedValue([action]);
      vi.spyOn(offlineQueue, 'updateStatus').mockResolvedValue(undefined);
      vi.spyOn(offlineQueue, 'remove').mockResolvedValue(undefined);

      const onSynced = vi.fn();
      const onFailed = vi.fn();
      const onComplete = vi.fn();

      await processQueue(onSynced, onFailed, onComplete);

      expect(offlineQueue.cleanup).toHaveBeenCalled();
      expect(offlineQueue.updateStatus).toHaveBeenCalledWith(action.id, 'syncing');
      expect(offlineQueue.remove).toHaveBeenCalledWith(action.id);
      expect(onSynced).toHaveBeenCalledWith(action);
      expect(onComplete).toHaveBeenCalledWith(1, 0);
    });

    it('marks action failed after max retries', async () => {
      const action = makeFullAction({ retryCount: 2 });
      vi.spyOn(offlineQueue, 'cleanup').mockResolvedValue(0);
      vi.spyOn(offlineQueue, 'getPending').mockResolvedValue([action]);
      vi.spyOn(offlineQueue, 'updateStatus').mockResolvedValue(undefined);
      vi.mocked(upsertRating).mockRejectedValueOnce(new Error('Network error'));

      const onSynced = vi.fn();
      const onFailed = vi.fn();
      const onComplete = vi.fn();

      await processQueue(onSynced, onFailed, onComplete);

      expect(offlineQueue.updateStatus).toHaveBeenCalledWith(action.id, 'failed', 3);
      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(0, 1);
    });

    it('defers failed actions instead of blocking with backoff', async () => {
      const action = makeFullAction({ retryCount: 0 });
      vi.spyOn(offlineQueue, 'cleanup').mockResolvedValue(0);
      vi.spyOn(offlineQueue, 'getPending').mockResolvedValue([action]);
      vi.spyOn(offlineQueue, 'updateStatus').mockResolvedValue(undefined);
      vi.mocked(upsertRating).mockRejectedValueOnce(new Error('Temporary'));

      const onComplete = vi.fn();

      await processQueue(vi.fn(), vi.fn(), onComplete);

      expect(offlineQueue.updateStatus).toHaveBeenCalledWith(action.id, 'pending', 1);
      expect(onComplete).toHaveBeenCalledWith(0, 0);
    });

    it('prevents concurrent processing via syncing lock', async () => {
      vi.spyOn(offlineQueue, 'cleanup').mockResolvedValue(0);
      vi.spyOn(offlineQueue, 'getPending').mockResolvedValue([]);

      const onComplete1 = vi.fn();
      const onComplete2 = vi.fn();

      // Start two concurrent processQueue calls
      const p1 = processQueue(vi.fn(), vi.fn(), onComplete1);
      const p2 = processQueue(vi.fn(), vi.fn(), onComplete2);

      await Promise.all([p1, p2]);

      // Only one should have actually run (the other returns early)
      expect(onComplete1).toHaveBeenCalledTimes(1);
      expect(onComplete2).not.toHaveBeenCalled();
    });
  });
});
