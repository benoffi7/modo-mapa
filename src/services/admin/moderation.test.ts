import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallable = vi.fn().mockResolvedValue({ data: { success: true } });

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  query: vi.fn().mockReturnValue({}),
  orderBy: vi.fn().mockReturnValue({}),
  limit: vi.fn().mockReturnValue({}),
  getDocs: vi.fn().mockResolvedValue({
    docs: [
      {
        data: () => ({
          id: 'log1',
          adminId: 'admin1',
          action: 'delete',
          targetCollection: 'comments',
          targetDocId: 'c1',
          targetUserId: 'u1',
          reason: 'spam',
          snapshot: { text: 'bad' },
          timestamp: new Date('2026-03-30'),
        }),
      },
    ],
  }),
}));

vi.mock('../../config/firebase', () => ({
  functions: {},
  db: {},
}));

vi.mock('../../config/collections', () => ({
  COLLECTIONS: { MODERATION_LOGS: 'moderationLogs' },
}));

vi.mock('../../config/adminConverters', () => ({
  moderationLogConverter: {},
}));

import { httpsCallable } from 'firebase/functions';
import {
  moderateComment,
  moderateRating,
  moderateCustomTag,
  fetchModerationLogs,
} from './moderation';

describe('admin/moderation service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moderateComment calls httpsCallable with correct args', async () => {
    await moderateComment('c1', 'delete', 'spam');
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'moderateComment');
    expect(mockCallable).toHaveBeenCalledWith({
      commentId: 'c1',
      action: 'delete',
      reason: 'spam',
    });
  });

  it('moderateComment supports hide action', async () => {
    await moderateComment('c2', 'hide');
    expect(mockCallable).toHaveBeenCalledWith({
      commentId: 'c2',
      action: 'hide',
      reason: undefined,
    });
  });

  it('moderateRating calls httpsCallable', async () => {
    await moderateRating('r1', 'offensive');
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'moderateRating');
    expect(mockCallable).toHaveBeenCalledWith({
      ratingId: 'r1',
      reason: 'offensive',
    });
  });

  it('moderateCustomTag calls httpsCallable', async () => {
    await moderateCustomTag('t1');
    expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'moderateCustomTag');
    expect(mockCallable).toHaveBeenCalledWith({
      tagId: 't1',
      reason: undefined,
    });
  });

  it('fetchModerationLogs returns logs', async () => {
    const logs = await fetchModerationLogs(10);
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('delete');
    expect(logs[0].targetCollection).toBe('comments');
  });

  it('moderateComment propagates errors', async () => {
    mockCallable.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(moderateComment('c1', 'delete')).rejects.toThrow('Permission denied');
  });
});
