import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock setup ---

const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);
const mockBatch = { delete: mockBatchDelete, commit: mockBatchCommit };

const mockDocGet = vi.fn();
const mockDocDelete = vi.fn().mockResolvedValue(undefined);
const mockDocSet = vi.fn().mockResolvedValue(undefined);
const mockDocUpdate = vi.fn().mockResolvedValue(undefined);
const mockDocRef = { get: mockDocGet, delete: mockDocDelete, set: mockDocSet, update: mockDocUpdate };

const mockCollectionGet = vi.fn();
const mockSubCollectionGet = vi.fn();
const mockWhere = vi.fn();

const mockCollectionAdd = vi.fn().mockResolvedValue({ id: 'audit1' });
const mockDb = {
  doc: vi.fn(() => mockDocRef),
  collection: vi.fn(() => ({
    where: mockWhere,
    get: mockCollectionGet,
    add: mockCollectionAdd,
  })),
  batch: () => mockBatch,
};

// where() returns something with .get()
mockWhere.mockReturnValue({ get: mockCollectionGet });

vi.mock('../../helpers/env', () => ({
  IS_EMULATOR: true,
  ENFORCE_APP_CHECK: false,
  getDb: () => mockDb,
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: unknown, handler: (...args: unknown[]) => unknown) => handler,
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
    increment: vi.fn((n: number) => `INCREMENT(${n})`),
  },
}));

const mockDeleteUser = vi.fn();
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ deleteUser: mockDeleteUser }),
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

vi.mock('firebase-functions', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: vi.fn().mockResolvedValue(undefined),
}));

import { deleteUserAccount } from '../../callable/deleteUserAccount';

const handler = deleteUserAccount as unknown as (req: unknown) => Promise<unknown>;

// --- Helpers ---

function makeAuthRequest(uid: string, email: string | null = 'user@test.com', data: unknown = {}) {
  return {
    auth: { uid, token: { email } },
    data,
  };
}

function mockEmptyCollections() {
  mockDocGet.mockResolvedValue({ exists: false });
  mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });
  mockSubCollectionGet.mockResolvedValue({ empty: true, docs: [] });
  mockDeleteUser.mockResolvedValue(undefined);
}

// --- Tests ---

describe('deleteUserAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmptyCollections();
  });

  it('rejects unauthenticated requests', async () => {
    await expect(handler({ data: {} })).rejects.toThrow('Must be signed in');
  });

  it('rejects requests without auth', async () => {
    await expect(handler({ auth: null, data: {} })).rejects.toThrow('Must be signed in');
  });

  it('rejects anonymous users (no email in token)', async () => {
    await expect(handler(makeAuthRequest('uid1', null))).rejects.toThrow(
      'Anonymous accounts cannot be deleted via this endpoint',
    );
  });

  it('blocks rapid requests with rate limit', async () => {
    // First call: rate limit doc exists with recent timestamp
    const recentDate = new Date(Date.now() - 10_000); // 10 seconds ago
    mockDocGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ lastAttempt: { toDate: () => recentDate } }) });

    await expect(handler(makeAuthRequest('uid1'))).rejects.toThrow('Please wait before retrying');
  });

  it('allows requests after rate limit expires', async () => {
    // Rate limit doc with old timestamp
    const oldDate = new Date(Date.now() - 120_000); // 2 minutes ago
    mockDocGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ lastAttempt: { toDate: () => oldDate } }) })
      // Subsequent doc gets for doc-by-uid entries
      .mockResolvedValue({ exists: false });

    const result = await handler(makeAuthRequest('uid1'));
    expect(result).toEqual({ success: true });
  });

  it('deletes doc-by-uid collections', async () => {
    // Rate limit: no existing
    mockDocGet
      .mockResolvedValueOnce({ exists: false }) // rate limit doc
      .mockResolvedValueOnce({ exists: true })  // userSettings doc exists
      .mockResolvedValueOnce({ exists: true })  // users doc exists
      .mockResolvedValue({ exists: false });    // rest don't exist

    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });

    await handler(makeAuthRequest('uid1'));

    // Should have called db.doc for rate limit + doc-by-uid entries
    expect(mockDocDelete).toHaveBeenCalled();
  });

  it('deletes query-based collections', async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    const mockDocRef1 = { ref: { id: 'r1', collection: vi.fn(() => ({ get: mockSubCollectionGet })) }, data: () => ({}) };
    const mockDocRef2 = { ref: { id: 'r2', collection: vi.fn(() => ({ get: mockSubCollectionGet })) }, data: () => ({}) };

    // Aggregate queries (6 parallel) return empty, then first real collection query returns docs
    let callCount = 0;
    mockCollectionGet.mockImplementation(() => {
      callCount++;
      // The 7th call is the first real collection query (after 6 aggregate queries)
      if (callCount === 7) {
        return Promise.resolve({ empty: false, docs: [mockDocRef1, mockDocRef2] });
      }
      return Promise.resolve({ empty: true, docs: [] });
    });

    await handler(makeAuthRequest('uid1'));

    // batchDeleteDocs should have been called
    expect(mockBatchDelete).toHaveBeenCalled();
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('handles biField by running two queries', async () => {
    mockDocGet.mockResolvedValue({ exists: false });
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });

    await handler(makeAuthRequest('uid1'));

    // The follows collection has biField: 'followedId'
    // Verify where was called with both followerId and followedId
    const whereCalls = mockWhere.mock.calls.map((c) => c[0] as string);
    expect(whereCalls).toContain('followerId');
    expect(whereCalls).toContain('followedId');
  });

  it('calls admin.auth().deleteUser(uid)', async () => {
    mockDocGet.mockResolvedValue({ exists: false });
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });
    mockDeleteUser.mockResolvedValue(undefined);

    await handler(makeAuthRequest('uid1'));

    expect(mockDeleteUser).toHaveBeenCalledWith('uid1');
  });

  it('handles auth/user-not-found gracefully', async () => {
    mockDocGet.mockResolvedValue({ exists: false });
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });
    mockDeleteUser.mockRejectedValue(Object.assign(new Error('not found'), { code: 'auth/user-not-found' }));

    const result = await handler(makeAuthRequest('uid1'));
    expect(result).toEqual({ success: true });
  });

  it('rethrows non-user-not-found auth errors', async () => {
    mockDocGet.mockResolvedValue({ exists: false });
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });
    mockDeleteUser.mockRejectedValue(Object.assign(new Error('internal'), { code: 'auth/internal-error' }));

    await expect(handler(makeAuthRequest('uid1'))).rejects.toThrow('internal');
  });

  it('is idempotent (succeeds with empty collections)', async () => {
    mockDocGet.mockResolvedValue({ exists: false });
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });

    const result = await handler(makeAuthRequest('uid1'));
    expect(result).toEqual({ success: true });
  });

  it('returns { success: true } on completion', async () => {
    const result = await handler(makeAuthRequest('uid1'));
    expect(result).toEqual({ success: true });
  });

  it('persists audit log in deletionAuditLogs collection', async () => {
    mockDocGet.mockResolvedValue({ exists: false });
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });

    await handler(makeAuthRequest('uid1'));

    // Should have called db.collection('deletionAuditLogs').add(...)
    const collCalls = mockDb.collection.mock.calls.map((c: unknown[]) => c[0]);
    expect(collCalls).toContain('deletionAuditLogs');
    expect(mockCollectionAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'account_delete',
        status: 'success',
        triggeredBy: 'user',
      }),
    );
  });

  it('logs abuse when deletion has partial failure', async () => {
    // Make one collection fail
    let callCount = 0;
    mockDocGet.mockResolvedValue({ exists: false });
    mockCollectionGet.mockImplementation(() => {
      callCount++;
      if (callCount === 7) return Promise.reject(new Error('fail'));
      return Promise.resolve({ empty: true, docs: [] });
    });

    const { logAbuse } = await import('../../utils/abuseLogger');
    await handler(makeAuthRequest('uid1'));

    expect(logAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'deletion_failure' }),
    );
  });
});
