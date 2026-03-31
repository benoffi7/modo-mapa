import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const { handler, mockAssertAdmin, mockGetFirestore } = vi.hoisted(() => ({
  handler: { fn: null as ((request: any) => Promise<any>) | null },
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockGetFirestore: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: any, fn: (request: any) => Promise<any>) => {
    handler.fn = fn;
    return fn;
  },
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('../../helpers/env', () => ({
  ENFORCE_APP_CHECK_ADMIN: false,
  getDb: (...args: any[]) => mockGetFirestore(...args),
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: any[]) => mockAssertAdmin(...args),
}));

function createMockDb(docs: any[] = []) {
  const mockLimit = vi.fn();
  const mockStartAfter = vi.fn();
  const mockOrderBy = vi.fn();
  const mockWhere = vi.fn();

  const queryChain = {
    where: mockWhere,
    orderBy: mockOrderBy,
    startAfter: mockStartAfter,
    limit: mockLimit,
  };

  // Chain returns self
  mockWhere.mockReturnValue(queryChain);
  mockOrderBy.mockReturnValue(queryChain);
  mockStartAfter.mockReturnValue(queryChain);
  mockLimit.mockReturnValue({
    get: vi.fn().mockResolvedValue({
      docs: docs.map((d, i) => ({
        id: d.id ?? `doc${i}`,
        data: () => d,
      })),
    }),
  });

  const db = {
    collection: vi.fn().mockReturnValue(queryChain),
  };

  mockGetFirestore.mockReturnValue(db);

  return { db, mockWhere, mockOrderBy, mockLimit, mockStartAfter };
}

// Import ONLY AFTER mocks
import '../../admin/deletionAuditLogs';

describe('fetchDeletionAuditLogs', () => {
  const getHandler = () => handler.fn!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertAdmin.mockReturnValue({ uid: 'admin1', token: { admin: true } });
  });

  it('rejects non-admin callers', async () => {
    mockAssertAdmin.mockImplementation(() => {
      throw new Error('Admin only');
    });
    createMockDb();

    await expect(getHandler()({ auth: null, data: {} })).rejects.toThrow('Admin only');
  });

  it('returns logs ordered by timestamp desc', async () => {
    const ts = { toDate: () => new Date('2026-03-30T12:00:00Z') };
    createMockDb([
      { uidHash: 'abc123', type: 'account_delete', status: 'success', timestamp: ts, collectionsProcessed: 5, collectionsFailed: [], storageFilesDeleted: 1, storageFilesFailed: 0, aggregatesCorrected: true, durationMs: 500, triggeredBy: 'user' },
    ]);

    const result = await getHandler()({ auth: { uid: 'admin1', token: { admin: true } }, data: {} });

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].uidHash).toBe('abc123');
    expect(result.logs[0].type).toBe('account_delete');
    expect(result.hasMore).toBe(false);
  });

  it('respects pageSize and reports hasMore', async () => {
    const ts = { toDate: () => new Date('2026-03-30T12:00:00Z') };
    const docs = Array.from({ length: 3 }, (_, i) => ({
      id: `doc${i}`,
      uidHash: `hash${i}`,
      type: 'account_delete',
      status: 'success',
      timestamp: ts,
      collectionsProcessed: 5,
      collectionsFailed: [],
      storageFilesDeleted: 0,
      storageFilesFailed: 0,
      aggregatesCorrected: true,
      durationMs: 100,
      triggeredBy: 'user',
    }));
    const { mockLimit } = createMockDb(docs);

    const result = await getHandler()({
      auth: { uid: 'admin1', token: { admin: true } },
      data: { pageSize: 2 },
    });

    // limit should be called with pageSize+1 = 3
    expect(mockLimit).toHaveBeenCalledWith(3);
    expect(result.logs).toHaveLength(2);
    expect(result.hasMore).toBe(true);
  });

  it('filters by type', async () => {
    const { mockWhere } = createMockDb([]);

    await getHandler()({
      auth: { uid: 'admin1', token: { admin: true } },
      data: { type: 'anonymous_clean' },
    });

    expect(mockWhere).toHaveBeenCalledWith('type', '==', 'anonymous_clean');
  });

  it('filters by status', async () => {
    const { mockWhere } = createMockDb([]);

    await getHandler()({
      auth: { uid: 'admin1', token: { admin: true } },
      data: { status: 'failure' },
    });

    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'failure');
  });

  it('supports startAfter for pagination', async () => {
    const { mockStartAfter } = createMockDb([]);

    await getHandler()({
      auth: { uid: 'admin1', token: { admin: true } },
      data: { startAfter: '2026-03-30T12:00:00Z' },
    });

    expect(mockStartAfter).toHaveBeenCalledWith(new Date('2026-03-30T12:00:00Z'));
  });

  it('rejects invalid startAfter timestamp', async () => {
    createMockDb([]);

    await expect(getHandler()({
      auth: { uid: 'admin1', token: { admin: true } },
      data: { startAfter: 'not-a-date' },
    })).rejects.toThrow('Invalid startAfter timestamp');
  });
});
