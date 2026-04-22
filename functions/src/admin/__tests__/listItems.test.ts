import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  handlerRef,
  mockGetDb,
  mockAssertAdmin,
  mockCheckCallableRateLimit,
  mockLogAbuse,
  mockCaptureException,
  mockTrackFunctionTiming,
} = vi.hoisted(() => ({
  handlerRef: { fn: null as ((request: any) => Promise<any>) | null },
  mockGetDb: vi.fn(),
  mockAssertAdmin: vi.fn().mockReturnValue({ uid: 'admin1', token: { admin: true } }),
  mockCheckCallableRateLimit: vi.fn().mockResolvedValue(undefined),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
  mockCaptureException: vi.fn(),
  mockTrackFunctionTiming: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase-functions/v2/https', () => ({
  onCall: (_opts: any, fn: (request: any) => Promise<any>) => {
    handlerRef.fn = fn;
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

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: vi.fn((n: number) => ({ __increment: n })),
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
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

function createMockDb(options: {
  itemExists?: boolean;
  itemData?: Record<string, unknown>;
}) {
  const itemRefDelete = vi.fn().mockResolvedValue(undefined);
  const itemRef = {
    get: vi.fn().mockResolvedValue({
      exists: options.itemExists ?? true,
      data: () => options.itemData ?? { listId: 'list1', businessId: 'biz1', addedBy: 'u1' },
    }),
    delete: itemRefDelete,
  };

  const sharedListRef = { id: 'list1' };

  const collectionMock = vi.fn((name: string) => ({
    doc: vi.fn((id: string) => {
      if (name === 'listItems') return itemRef;
      if (name === 'sharedLists') return sharedListRef;
      return { id };
    }),
  }));

  const batchDelete = vi.fn();
  const batchUpdate = vi.fn();
  const batchCommit = vi.fn().mockResolvedValue(undefined);
  const batch = vi.fn().mockReturnValue({
    delete: batchDelete,
    update: batchUpdate,
    commit: batchCommit,
  });

  const db = { collection: collectionMock, batch };
  mockGetDb.mockReturnValue(db);

  return { db, itemRef, itemRefDelete, collectionMock, batch, batchDelete, batchUpdate, batchCommit, sharedListRef };
}

import '../listItems';

describe('adminDeleteListItem', () => {
  const handler = () => handlerRef.fn!;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertAdmin.mockReturnValue({ uid: 'admin1', token: { admin: true } });
  });

  it('rejects non-admin users', async () => {
    createMockDb({});
    mockAssertAdmin.mockImplementationOnce(() => {
      throw new Error('Admin only');
    });
    await expect(
      handler()({ auth: { uid: 'user1' }, data: { itemId: 'item1' } }),
    ).rejects.toThrow('Admin only');
  });

  it('rejects missing itemId', async () => {
    createMockDb({});
    await expect(handler()({ auth: { uid: 'admin1' }, data: {} })).rejects.toThrow(
      'itemId is required',
    );
  });

  it('rejects invalid itemId chars', async () => {
    createMockDb({});
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { itemId: 'bad id!!!' } }),
    ).rejects.toThrow('itemId contains invalid characters');
  });

  it('throws not-found when doc does not exist', async () => {
    createMockDb({ itemExists: false });
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { itemId: 'item1' } }),
    ).rejects.toThrow('List item not found');
  });

  it('throws failed-precondition when item has no listId', async () => {
    createMockDb({ itemExists: true, itemData: { businessId: 'biz1' } });
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { itemId: 'item1' } }),
    ).rejects.toThrow('List item has no listId');
  });

  it('checks callable rate limit', async () => {
    createMockDb({});
    mockCheckCallableRateLimit.mockRejectedValueOnce(new Error('Rate limit exceeded'));
    await expect(
      handler()({ auth: { uid: 'admin1' }, data: { itemId: 'item1' } }),
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('batch-deletes item, decrements itemCount, writes abuseLog', async () => {
    const { batch, batchDelete, batchUpdate, batchCommit, itemRef } = createMockDb({
      itemExists: true,
      itemData: { listId: 'list42', businessId: 'bizX', addedBy: 'userX' },
    });
    const result = await handler()({
      auth: { uid: 'admin1' },
      data: { itemId: 'item1' },
    });
    expect(result).toEqual({ success: true });
    expect(batch).toHaveBeenCalled();
    expect(batchDelete).toHaveBeenCalledWith(itemRef);
    expect(batchUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        itemCount: { __increment: -1 },
      }),
    );
    expect(batchCommit).toHaveBeenCalled();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'admin1',
        type: 'config_edit',
        collection: 'listItems',
      }),
    );
    const logCall = mockLogAbuse.mock.calls[0][1] as { detail: string };
    const detail = JSON.parse(logCall.detail);
    expect(detail).toMatchObject({
      action: 'delete_list_item',
      itemId: 'item1',
      listId: 'list42',
      businessId: 'bizX',
      addedBy: 'userX',
    });
  });

  it('calls trackFunctionTiming on success', async () => {
    createMockDb({});
    await handler()({ auth: { uid: 'admin1' }, data: { itemId: 'item1' } });
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith(
      'adminDeleteListItem',
      expect.any(Number),
    );
  });
});
