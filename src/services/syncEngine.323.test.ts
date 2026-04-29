import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { processQueue, executeAction, _resetSyncingForTest } from './syncEngine';
import * as offlineQueue from './offlineQueue';
import { OFFLINE_MAX_RETRIES } from '../constants/offline';
import type { OfflineAction } from '../types/offline';

// Mocks para los services que invoca syncEngine.executeAction (#323).
vi.mock('./comments', () => ({
  addComment: vi.fn().mockResolvedValue(undefined),
  createQuestion: vi.fn().mockResolvedValue('q1'),
  likeComment: vi.fn().mockResolvedValue(undefined),
  unlikeComment: vi.fn().mockResolvedValue(undefined),
  editComment: vi.fn().mockResolvedValue(undefined),
  deleteComment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./ratings', () => ({
  upsertRating: vi.fn().mockResolvedValue(undefined),
  deleteRating: vi.fn().mockResolvedValue(undefined),
  upsertCriteriaRating: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./sharedLists', () => ({
  createList: vi.fn().mockResolvedValue('list1'),
  updateList: vi.fn().mockResolvedValue(undefined),
  toggleListPublic: vi.fn().mockResolvedValue(undefined),
  deleteList: vi.fn().mockResolvedValue(undefined),
  addBusinessToList: vi.fn().mockResolvedValue(undefined),
  removeBusinessFromList: vi.fn().mockResolvedValue(undefined),
}));

import { editComment, deleteComment } from './comments';
import { upsertCriteriaRating } from './ratings';
import { deleteList } from './sharedLists';

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

describe('syncEngine — branches #323', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSyncingForTest();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('comment_edit branch', () => {
    it('replays editComment(commentId, userId, text)', async () => {
      await executeAction(makeFullAction({
        type: 'comment_edit',
        payload: { commentId: 'c1', text: 'Texto editado' },
      }));
      expect(editComment).toHaveBeenCalledWith('c1', 'u1', 'Texto editado');
    });

    it('marks failed after OFFLINE_MAX_RETRIES if commentId not found (B1 known limitation)', async () => {
      vi.mocked(editComment).mockRejectedValue(new Error('not-found: comment does not exist'));
      const action = makeFullAction({
        type: 'comment_edit',
        payload: { commentId: 'missing', text: 'x' },
        retryCount: OFFLINE_MAX_RETRIES - 1,
      });

      vi.spyOn(offlineQueue, 'cleanup').mockResolvedValue(0);
      vi.spyOn(offlineQueue, 'getPending').mockResolvedValue([action]);
      vi.spyOn(offlineQueue, 'updateStatus').mockResolvedValue(undefined);

      const onFailed = vi.fn();
      await processQueue(vi.fn(), onFailed, vi.fn());

      expect(onFailed).toHaveBeenCalledTimes(1);
      expect(offlineQueue.updateStatus).toHaveBeenCalledWith(
        action.id,
        'failed',
        OFFLINE_MAX_RETRIES,
      );
    });
  });

  describe('comment_delete branch', () => {
    it('replays deleteComment(commentId, userId)', async () => {
      await executeAction(makeFullAction({
        type: 'comment_delete',
        payload: { commentId: 'c1' },
      }));
      expect(deleteComment).toHaveBeenCalledWith('c1', 'u1');
    });

    it('marks failed after retries when comment doc missing (B1 known limitation)', async () => {
      vi.mocked(deleteComment).mockRejectedValue(new Error('not-found'));
      const action = makeFullAction({
        type: 'comment_delete',
        payload: { commentId: 'missing' },
        retryCount: OFFLINE_MAX_RETRIES - 1,
      });

      vi.spyOn(offlineQueue, 'cleanup').mockResolvedValue(0);
      vi.spyOn(offlineQueue, 'getPending').mockResolvedValue([action]);
      vi.spyOn(offlineQueue, 'updateStatus').mockResolvedValue(undefined);

      const onFailed = vi.fn();
      await processQueue(vi.fn(), onFailed, vi.fn());

      expect(onFailed).toHaveBeenCalledTimes(1);
    });
  });

  describe('rating_criteria_upsert branch', () => {
    it('replays upsertCriteriaRating with single criterion partial', async () => {
      await executeAction(makeFullAction({
        type: 'rating_criteria_upsert',
        payload: { criterionId: 'food', value: 4 },
      }));
      expect(upsertCriteriaRating).toHaveBeenCalledWith('u1', 'b1', { food: 4 });
    });

    it('handles different criterion ids', async () => {
      await executeAction(makeFullAction({
        type: 'rating_criteria_upsert',
        payload: { criterionId: 'service', value: 5 },
      }));
      expect(upsertCriteriaRating).toHaveBeenCalledWith('u1', 'b1', { service: 5 });
    });
  });

  describe('list_delete defensive branch (S2.1 PRD)', () => {
    it('still replays correctly for queues persisted before #323 (defensive)', async () => {
      await executeAction(makeFullAction({
        type: 'list_delete',
        listId: 'list-legacy',
        payload: { ownerId: 'u1' },
      }));
      expect(deleteList).toHaveBeenCalledWith('list-legacy', 'u1');
    });
  });
});
