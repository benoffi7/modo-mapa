import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock setup ---

const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockBatch = { delete: mockBatchDelete, commit: mockBatchCommit };

const mockDocGet = vi.fn();
const mockDocDelete = vi.fn().mockResolvedValue(undefined);
const mockDocUpdate = vi.fn().mockResolvedValue(undefined);
const mockDocRef = { get: mockDocGet, delete: mockDocDelete, update: mockDocUpdate };

const mockCollectionGet = vi.fn();
const mockSubCollectionGet = vi.fn();
const mockWhere = vi.fn();

const mockDb = {
  doc: vi.fn(() => mockDocRef),
  collection: vi.fn(() => ({
    where: mockWhere,
    get: mockCollectionGet,
  })),
  batch: () => mockBatch,
};

mockWhere.mockReturnValue({ get: mockCollectionGet });

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
    increment: vi.fn((n: number) => `INCREMENT(${n})`),
  },
}));

const mockDeleteFiles = vi.fn().mockResolvedValue(undefined);
const mockFileDelete = vi.fn().mockResolvedValue(undefined);
vi.mock('firebase-admin/storage', () => ({
  getStorage: () => ({
    bucket: () => ({
      deleteFiles: mockDeleteFiles,
      file: () => ({ delete: mockFileDelete }),
    }),
  }),
}));

import { deleteAllUserData } from '../../utils/deleteUserData';
import type { DeletionResult } from '../../utils/deleteUserData';

// --- Helpers ---

function mockEmptyCollections() {
  mockDocGet.mockResolvedValue({ exists: false });
  mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });
  mockSubCollectionGet.mockResolvedValue({ empty: true, docs: [] });
}

// --- Tests ---

describe('deleteAllUserData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmptyCollections();
  });

  it('returns DeletionResult with zero failures on success', async () => {
    const result: DeletionResult = await deleteAllUserData(mockDb as never, 'uid1');

    expect(result.collectionsFailed).toEqual([]);
    expect(result.collectionsProcessed).toBeGreaterThan(0);
    expect(result.aggregatesCorrected).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.storageFilesFailed).toBe(0);
  });

  it('reports partial failure when a collection throws', async () => {
    // Make the first call to collection().where().get() fail for one specific collection
    let callCount = 0;
    mockCollectionGet.mockImplementation(() => {
      callCount++;
      // Fail on the 7th call (after 6 aggregate queries), which is the first real collection
      if (callCount === 7) {
        return Promise.reject(new Error('Simulated failure'));
      }
      return Promise.resolve({ empty: true, docs: [] });
    });

    const result = await deleteAllUserData(mockDb as never, 'uid1');

    expect(result.collectionsFailed.length).toBeGreaterThan(0);
    expect(result.collectionsProcessed).toBeGreaterThan(0);
  });

  it('reports storageFilesFailed when storage cleanup fails', async () => {
    mockDeleteFiles.mockRejectedValueOnce(new Error('Storage error'));

    const result = await deleteAllUserData(mockDb as never, 'uid1');

    expect(result.storageFilesFailed).toBeGreaterThan(0);
    // Storage failure does not affect collection counts
    expect(result.collectionsFailed).toEqual([]);
  });

  it('reports aggregatesCorrected=false when correctAggregates throws', async () => {
    // Make the first aggregate query (ratings) fail
    mockCollectionGet.mockRejectedValueOnce(new Error('Aggregate fail'));

    const result = await deleteAllUserData(mockDb as never, 'uid1');

    expect(result.aggregatesCorrected).toBe(false);
  });

  it('measures duration in milliseconds', async () => {
    const result = await deleteAllUserData(mockDb as never, 'uid1');

    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('counts individual storage paths as deleted', async () => {
    // Setup: one collection returns docs with storagePath
    const docWithStorage = {
      ref: { id: 'doc1', collection: vi.fn(() => ({ get: mockSubCollectionGet })) },
      data: () => ({ storagePath: 'menus/uid1/biz_1/photo.jpg', thumbnailPath: 'menus/uid1/biz_1/thumb.jpg' }),
    };

    let callCount = 0;
    mockCollectionGet.mockImplementation(() => {
      callCount++;
      // feedback collection (the one with hasStorage) — pick a call that corresponds
      if (callCount === 13) {
        return Promise.resolve({ empty: false, docs: [docWithStorage] });
      }
      return Promise.resolve({ empty: true, docs: [] });
    });

    const result = await deleteAllUserData(mockDb as never, 'uid1');

    // Storage files: feedback-media folder (1) + 2 individual paths
    expect(result.storageFilesDeleted).toBeGreaterThan(0);
  });
});
