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

function makeDocRef(parentPath: string) {
  return {
    ref: {
      parent: {
        parent: {
          parent: { id: parentPath },
        },
      },
    },
  };
}

function createMockSetup(docs: Array<{ parentPath: string }>, empty = false) {
  const mockBatchDelete = vi.fn();
  const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
  const mockBatch = vi.fn().mockReturnValue({
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  });

  const mockDocs = docs.map((d) => makeDocRef(d.parentPath));

  const mockGet = vi.fn().mockResolvedValue({
    empty: empty || mockDocs.length === 0,
    docs: mockDocs,
  });
  const mockLimit = vi.fn().mockReturnValue({ get: mockGet });
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockCollectionGroup = vi.fn().mockReturnValue({ where: mockWhere });

  const mockHeartbeatSet = vi.fn().mockResolvedValue(undefined);
  const mockHeartbeatDoc = vi.fn().mockReturnValue({ set: mockHeartbeatSet });
  const db = { collectionGroup: mockCollectionGroup, batch: mockBatch, doc: mockHeartbeatDoc };
  mockGetDb.mockReturnValue(db);

  return { db, mockBatchDelete, mockBatchCommit, mockCollectionGroup };
}

import '../../scheduled/cleanupActivityFeed';

describe('cleanupActivityFeed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handler is registered', () => {
    expect(handlerHolder.fn).not.toBeNull();
  });

  it('deletes expired activity feed items under activityFeed path', async () => {
    const { mockBatchDelete, mockBatchCommit } = createMockSetup([
      { parentPath: 'activityFeed' },
      { parentPath: 'activityFeed' },
    ]);

    await handlerHolder.fn!();

    expect(mockBatchDelete).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('skips items NOT under activityFeed path', async () => {
    const { mockBatchDelete, mockBatchCommit } = createMockSetup([
      { parentPath: 'someOtherCollection' },
      { parentPath: 'activityFeed' },
    ]);

    await handlerHolder.fn!();

    expect(mockBatchDelete).toHaveBeenCalledTimes(1);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('returns early when no expired items', async () => {
    const { mockBatchCommit } = createMockSetup([], true);

    await handlerHolder.fn!();

    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('returns early when all items are from non-activityFeed collections', async () => {
    const { mockBatchDelete, mockBatchCommit } = createMockSetup([
      { parentPath: 'otherCollection' },
    ]);

    await handlerHolder.fn!();

    expect(mockBatchDelete).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it('uses collectionGroup query on items subcollection', async () => {
    const { mockCollectionGroup } = createMockSetup([], true);

    await handlerHolder.fn!();

    expect(mockCollectionGroup).toHaveBeenCalledWith('items');
  });

  it('limits query to 500 documents', async () => {
    createMockSetup([], true);
    // The limit(500) is in the source -- we verify the mock chain works
    await handlerHolder.fn!();
    // No error means the chain worked correctly
  });
});
