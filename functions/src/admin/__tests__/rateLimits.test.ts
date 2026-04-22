import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  handlers,
  mockGetDb,
  mockAssertAdmin,
  mockCheckCallableRateLimit,
  mockLogAbuse,
  mockCaptureException,
  mockTrackFunctionTiming,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, ((request: any) => Promise<any>) | null>,
  mockGetDb: vi.fn(),
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockCheckCallableRateLimit: vi.fn().mockResolvedValue(undefined),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
  mockCaptureException: vi.fn(),
  mockTrackFunctionTiming: vi.fn().mockResolvedValue(undefined),
}));

const callIndex = vi.hoisted(() => ({ value: 0 }));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: any, fn: (request: any) => Promise<any>) => {
    const names = ['adminListRateLimits', 'adminResetRateLimit'];
    handlers[names[callIndex.value++]] = fn;
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

vi.mock('firebase-functions/v2', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../helpers/env', () => ({
  ENFORCE_APP_CHECK_ADMIN: false,
  getDb: () => mockGetDb(),
}));

vi.mock('../../helpers/assertAdmin', () => ({
  assertAdmin: (...args: any[]) => mockAssertAdmin(...args),
}));

vi.mock('../../utils/callableRateLimit', () => ({
  checkCallableRateLimit: (...args: any[]) => mockCheckCallableRateLimit(...args),
}));

vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: any[]) => mockLogAbuse(...args),
}));

vi.mock('../../utils/sentry', () => ({
  captureException: (...args: any[]) => mockCaptureException(...args),
}));

vi.mock('../../utils/perfTracker', () => ({
  trackFunctionTiming: (...args: any[]) => mockTrackFunctionTiming(...args),
}));

function createQueryMockDb(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const snapDocs = docs.map((d) => ({ id: d.id, data: () => d.data }));
  const snap = { docs: snapDocs };

  const limitMock = vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(snap),
  });
  const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const collectionMock = vi.fn().mockReturnValue({
    orderBy: orderByMock,
    where: whereMock,
    doc: vi.fn(),
  });
  const db = { collection: collectionMock };
  mockGetDb.mockReturnValue(db);
  return { db, collectionMock, orderByMock, whereMock, limitMock };
}

function createDocMockDb(options: { exists: boolean; data?: Record<string, unknown> }) {
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  const mockDocRef = {
    get: vi.fn().mockResolvedValue({
      exists: options.exists,
      data: () => options.data ?? {},
      id: 'some-doc-id',
    }),
    delete: mockDelete,
  };
  const collectionMock = vi.fn().mockReturnValue({
    doc: vi.fn().mockReturnValue(mockDocRef),
  });
  const db = { collection: collectionMock };
  mockGetDb.mockReturnValue(db);
  return { db, mockDelete, mockDocRef, collectionMock };
}

import { categorizeRateLimit } from '../rateLimits';
import '../rateLimits';

describe('categorizeRateLimit', () => {
  it('parses single-prefix docId', () => {
    expect(categorizeRateLimit('comments_abc123')).toEqual({
      category: 'comments',
      userId: 'abc123',
    });
  });

  it('parses compound-prefix docId (editors_invite)', () => {
    expect(categorizeRateLimit('editors_invite_xyzUid')).toEqual({
      category: 'editors_invite',
      userId: 'xyzUid',
    });
  });

  it('parses commentLikes_50d compound prefix', () => {
    expect(categorizeRateLimit('commentLikes_50d_user1')).toEqual({
      category: 'commentLikes_50d',
      userId: 'user1',
    });
  });

  it('falls back to last-underscore split for unknown prefix', () => {
    expect(categorizeRateLimit('someunknown_userId')).toEqual({
      category: 'someunknown',
      userId: 'userId',
    });
  });

  it('falls back to unknown category when no underscore', () => {
    expect(categorizeRateLimit('nounderscore')).toEqual({
      category: 'unknown',
      userId: 'nounderscore',
    });
  });
});

describe('adminListRateLimits', () => {
  const handler = () => handlers.adminListRateLimits!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertAdmin.mockReturnValue({ uid: 'admin1', token: { admin: true } });
  });

  it('rejects non-admin users', async () => {
    createQueryMockDb([]);
    mockAssertAdmin.mockImplementationOnce(() => {
      throw new Error('Admin only');
    });
    await expect(handler()({ auth: { uid: 'user1' }, data: {} })).rejects.toThrow('Admin only');
  });

  it('rejects invalid userId', async () => {
    createQueryMockDb([]);
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { userId: 'bad user!!' } }),
    ).rejects.toThrow('userId must be a valid uid');
  });

  it('rejects non-numeric limit', async () => {
    createQueryMockDb([]);
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { limit: 'not-a-number' } }),
    ).rejects.toThrow('limit must be a number');
  });

  it('clamps limit into [1, 100] range', async () => {
    const { limitMock } = createQueryMockDb([]);
    await handler()({ auth: { uid: 'admin1' }, data: { limit: 500 } });
    expect(limitMock).toHaveBeenCalledWith(100);

    vi.clearAllMocks();
    mockAssertAdmin.mockReturnValue({ uid: 'admin1', token: { admin: true } });
    const { limitMock: limitMock2 } = createQueryMockDb([]);
    await handler()({ auth: { uid: 'admin1' }, data: { limit: 0 } });
    expect(limitMock2).toHaveBeenCalledWith(1);
  });

  it('checks callable rate limit', async () => {
    createQueryMockDb([]);
    mockCheckCallableRateLimit.mockRejectedValueOnce(new Error('Rate limit exceeded'));
    await expect(handler()({ auth: { uid: 'admin1' }, data: {} })).rejects.toThrow(
      'Rate limit exceeded',
    );
  });

  it('returns parsed items with category, count, resetAt, windowActive', async () => {
    const future = Date.now() + 1000 * 60 * 60;
    const past = Date.now() - 1000;
    createQueryMockDb([
      { id: 'comments_userA', data: { count: 5, resetAt: future, userId: 'userA' } },
      { id: 'editors_invite_userB', data: { count: 3, resetAt: past, userId: 'userB' } },
    ]);

    const result = await handler()({ auth: { uid: 'admin1' }, data: {} });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      docId: 'comments_userA',
      category: 'comments',
      userId: 'userA',
      count: 5,
      windowActive: true,
    });
    expect(result.items[1]).toMatchObject({
      docId: 'editors_invite_userB',
      category: 'editors_invite',
      userId: 'userB',
      count: 3,
      windowActive: false,
    });
  });

  it('uses `where` filter when userId provided', async () => {
    const { whereMock, orderByMock } = createQueryMockDb([]);
    await handler()({ auth: { uid: 'admin1' }, data: { userId: 'abc123xyz' } });
    expect(whereMock).toHaveBeenCalledWith('userId', '==', 'abc123xyz');
    // When filtering by userId, we do NOT use orderBy (avoids needing composite index)
    expect(orderByMock).not.toHaveBeenCalled();
  });

  it('calls trackFunctionTiming', async () => {
    createQueryMockDb([]);
    await handler()({ auth: { uid: 'admin1' }, data: {} });
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('adminListRateLimits', expect.any(Number));
  });
});

describe('adminResetRateLimit', () => {
  const handler = () => handlers.adminResetRateLimit!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertAdmin.mockReturnValue({ uid: 'admin1', token: { admin: true } });
  });

  it('rejects non-admin users', async () => {
    createDocMockDb({ exists: true, data: {} });
    mockAssertAdmin.mockImplementationOnce(() => {
      throw new Error('Admin only');
    });
    await expect(
      handler()({ auth: { uid: 'user1' }, data: { docId: 'comments_user1' } }),
    ).rejects.toThrow('Admin only');
  });

  it('rejects missing docId', async () => {
    createDocMockDb({ exists: true });
    await expect(handler()({ auth: { uid: 'admin1' }, data: {} })).rejects.toThrow(
      'docId is required',
    );
  });

  it('rejects invalid docId chars', async () => {
    createDocMockDb({ exists: true });
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { docId: 'bad id!!!' } }),
    ).rejects.toThrow('docId contains invalid characters');
  });

  it('throws not-found when doc does not exist', async () => {
    createDocMockDb({ exists: false });
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { docId: 'comments_user1' } }),
    ).rejects.toThrow('Rate limit doc not found');
  });

  it('checks callable rate limit', async () => {
    createDocMockDb({ exists: true });
    mockCheckCallableRateLimit.mockRejectedValueOnce(new Error('Rate limit exceeded'));
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { docId: 'comments_user1' } }),
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('deletes doc and writes abuseLog with type config_edit', async () => {
    const { mockDelete } = createDocMockDb({
      exists: true,
      data: { count: 5, resetAt: Date.now() },
    });
    const result = await handler()({
      auth: { uid: 'admin1' },
      data: { docId: 'comments_userA' },
    });
    expect(result).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalled();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'admin1',
        type: 'config_edit',
        collection: '_rateLimits',
      }),
    );
    const logCall = mockLogAbuse.mock.calls[0][1] as { detail: string };
    const detail = JSON.parse(logCall.detail);
    expect(detail).toMatchObject({
      action: 'reset_rate_limit',
      docId: 'comments_userA',
      category: 'comments',
      targetUserId: 'userA',
    });
  });

  it('calls trackFunctionTiming', async () => {
    createDocMockDb({ exists: true, data: {} });
    await handler()({ auth: { uid: 'admin1' }, data: { docId: 'comments_userA' } });
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith(
      'adminResetRateLimit',
      expect.any(Number),
    );
  });
});
