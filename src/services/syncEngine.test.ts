import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { processQueue, executeAction } from './syncEngine';
import * as offlineQueue from './offlineQueue';
import type { OfflineAction } from '../types/offline';

// Mock all Firestore services
vi.mock('./ratings', () => ({
  upsertRating: vi.fn().mockResolvedValue(undefined),
  deleteRating: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./comments', () => ({
  addComment: vi.fn().mockResolvedValue(undefined),
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

import { upsertRating, deleteRating } from './ratings';
import { addComment } from './comments';
import { addFavorite, removeFavorite } from './favorites';
import { upsertPriceLevel, deletePriceLevel } from './priceLevels';
import { addUserTag, removeUserTag } from './tags';

function makeFullAction(overrides: Partial<OfflineAction> = {}): OfflineAction {
  return {
    id: crypto.randomUUID(),
    type: 'rating_upsert',
    payload: { userId: 'u1', businessId: 'b1', score: 4 },
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
    // Use fake timers only for delay but don't break indexeddb
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('executeAction', () => {
    it('maps rating_upsert correctly', async () => {
      const action = makeFullAction({
        type: 'rating_upsert',
        payload: { userId: 'u1', businessId: 'b1', score: 5 },
      });
      await executeAction(action);
      expect(upsertRating).toHaveBeenCalledWith('u1', 'b1', 5, undefined);
    });

    it('maps rating_delete correctly', async () => {
      const action = makeFullAction({
        type: 'rating_delete',
        payload: { userId: 'u1', businessId: 'b1' },
      });
      await executeAction(action);
      expect(deleteRating).toHaveBeenCalledWith('u1', 'b1');
    });

    it('maps comment_create correctly', async () => {
      const action = makeFullAction({
        type: 'comment_create',
        payload: { userId: 'u1', userName: 'Test', businessId: 'b1', text: 'Hello', parentId: 'p1' },
      });
      await executeAction(action);
      expect(addComment).toHaveBeenCalledWith('u1', 'Test', 'b1', 'Hello', 'p1');
    });

    it('maps favorite_add correctly', async () => {
      const action = makeFullAction({
        type: 'favorite_add',
        payload: { userId: 'u1', businessId: 'b1', action: 'add' },
      });
      await executeAction(action);
      expect(addFavorite).toHaveBeenCalledWith('u1', 'b1');
    });

    it('maps favorite_remove correctly', async () => {
      const action = makeFullAction({
        type: 'favorite_remove',
        payload: { userId: 'u1', businessId: 'b1', action: 'remove' },
      });
      await executeAction(action);
      expect(removeFavorite).toHaveBeenCalledWith('u1', 'b1');
    });

    it('maps price_level_upsert correctly', async () => {
      const action = makeFullAction({
        type: 'price_level_upsert',
        payload: { userId: 'u1', businessId: 'b1', level: 2 },
      });
      await executeAction(action);
      expect(upsertPriceLevel).toHaveBeenCalledWith('u1', 'b1', 2);
    });

    it('maps price_level_delete correctly', async () => {
      const action = makeFullAction({
        type: 'price_level_delete',
        payload: { userId: 'u1', businessId: 'b1' },
      });
      await executeAction(action);
      expect(deletePriceLevel).toHaveBeenCalledWith('u1', 'b1');
    });

    it('maps tag_add correctly', async () => {
      const action = makeFullAction({
        type: 'tag_add',
        payload: { userId: 'u1', businessId: 'b1', tagId: 't1' },
      });
      await executeAction(action);
      expect(addUserTag).toHaveBeenCalledWith('u1', 'b1', 't1');
    });

    it('maps tag_remove correctly', async () => {
      const action = makeFullAction({
        type: 'tag_remove',
        payload: { userId: 'u1', businessId: 'b1', tagId: 't1' },
      });
      await executeAction(action);
      expect(removeUserTag).toHaveBeenCalledWith('u1', 'b1', 't1');
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
      const action = makeFullAction({ retryCount: 2 }); // will be 3 after increment = max
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

    it('retries with backoff on non-max failure', async () => {
      const action = makeFullAction({ retryCount: 0 });
      vi.spyOn(offlineQueue, 'cleanup').mockResolvedValue(0);
      vi.spyOn(offlineQueue, 'getPending').mockResolvedValue([action]);
      vi.spyOn(offlineQueue, 'updateStatus').mockResolvedValue(undefined);
      vi.mocked(upsertRating).mockRejectedValueOnce(new Error('Temporary'));

      const onSynced = vi.fn();
      const onFailed = vi.fn();
      const onComplete = vi.fn();

      await processQueue(onSynced, onFailed, onComplete);

      // Should set back to pending with retryCount 1
      expect(offlineQueue.updateStatus).toHaveBeenCalledWith(action.id, 'pending', 1);
      expect(onFailed).not.toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledWith(0, 0);
    });
  });
});
