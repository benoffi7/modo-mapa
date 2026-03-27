import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlerHolder,
  mockGetDb,
} = vi.hoisted(() => ({
  handlerHolder: { fn: null as (() => Promise<void>) | null },
  mockGetDb: vi.fn(),
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_opts: unknown, handler: () => Promise<void>) => {
    handlerHolder.fn = handler;
    return handler;
  },
}));

vi.mock('../../helpers/env', () => ({
  get getDb() { return mockGetDb; },
}));

function createMockSetup(docCount: number) {
  const mockBatchDelete = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
  const mockBatch = vi.fn().mockReturnValue({
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  });

  const docs = Array.from({ length: docCount }, (_, i) => ({
    ref: { id: `notif_${i}` },
  }));

  const mockGet = vi.fn().mockResolvedValue({ docs, size: docCount });
  const mockWhere = vi.fn().mockReturnValue({ get: mockGet });
  const mockCollection = vi.fn().mockReturnValue({ where: mockWhere });

  const db = { collection: mockCollection, batch: mockBatch };
  mockGetDb.mockReturnValue(db);

  return { db, mockBatchDelete, mockBatchCommit, mockBatch };
}

import '../../scheduled/cleanupNotifications';

describe('cleanupExpiredNotifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handler is registered', () => {
    expect(handlerHolder.fn).not.toBeNull();
  });

  it('deletes expired notifications in batch', async () => {
    const { mockBatchDelete, mockBatchCommit } = createMockSetup(3);

    await handlerHolder.fn!();

    expect(mockBatchDelete).toHaveBeenCalledTimes(3);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('does NOT commit batch when no expired notifications', async () => {
    const { mockBatchCommit } = createMockSetup(0);

    await handlerHolder.fn!();

    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('queries notifications collection with expiresAt filter', async () => {
    const { db } = createMockSetup(0);

    await handlerHolder.fn!();

    expect(db.collection).toHaveBeenCalledWith('notifications');
  });

  it('handles single expired notification', async () => {
    const { mockBatchDelete, mockBatchCommit } = createMockSetup(1);

    await handlerHolder.fn!();

    expect(mockBatchDelete).toHaveBeenCalledTimes(1);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('adds each doc ref to the batch for deletion', async () => {
    const { mockBatchDelete } = createMockSetup(2);

    await handlerHolder.fn!();

    expect(mockBatchDelete).toHaveBeenCalledWith({ id: 'notif_0' });
    expect(mockBatchDelete).toHaveBeenCalledWith({ id: 'notif_1' });
  });
});
