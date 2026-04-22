import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockGetFirestore,
  mockIncrementCounter,
  mockTrackWrite,
  mockLogAbuse,
  mockCountGet,
} = vi.hoisted(() => {
  const mockCountGet = vi.fn().mockResolvedValue({ data: () => ({ count: 5 }) });
  const mockCount = vi.fn().mockReturnValue({ get: mockCountGet });
  const mockWhere2 = vi.fn().mockReturnValue({ count: mockCount });
  const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });
  const mockCollection = vi.fn().mockReturnValue({ where: mockWhere1 });
  const mockDoc = vi.fn().mockReturnValue({
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({ exists: false }),
  });
  const mockDb = { collection: mockCollection, doc: mockDoc };
  const mockGetFirestore = vi.fn().mockReturnValue(mockDb);

  return {
    handlers: {} as Record<string, (event: unknown) => Promise<void>>,
    mockGetFirestore,
    mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
    mockTrackWrite: vi.fn().mockResolvedValue(undefined),
    mockLogAbuse: vi.fn().mockResolvedValue(undefined),
    mockCountGet,
    mockCollection,
    mockWhere1,
    mockWhere2,
    mockCount,
    mockDb,
  };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
  FieldValue: { serverTimestamp: () => '__ts__' },
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`created:${path}`] = handler;
    return handler;
  },
}));

vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: unknown[]) => mockIncrementCounter(...args),
  trackWrite: (...args: unknown[]) => mockTrackWrite(...args),
}));

vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: unknown[]) => mockLogAbuse(...args),
}));

vi.mock('../../utils/perfTracker', () => ({
  trackFunctionTiming: vi.fn().mockResolvedValue(undefined),
}));

import '../../triggers/listItems';

describe('onListItemCreated', () => {
  const onCreated = () => handlers['created:listItems/{itemId}'];

  beforeEach(() => vi.clearAllMocks());

  it('skips if no snapshot data', async () => {
    await onCreated()({ data: null, params: { itemId: 'i1' } });
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('increments counters without rate limit check when addedBy is missing', async () => {
    await onCreated()({
      params: { itemId: 'i1' },
      data: {
        data: () => ({ listId: 'list1', businessId: 'biz1' }),
      },
    });

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'listItems', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'listItems');
    expect(mockCountGet).not.toHaveBeenCalled();
    expect(mockLogAbuse).not.toHaveBeenCalled();
  });

  it('increments counters and does not log abuse when rate limit not exceeded', async () => {
    mockCountGet.mockResolvedValueOnce({ data: () => ({ count: 50 }) });

    await onCreated()({
      params: { itemId: 'i1' },
      data: {
        data: () => ({ listId: 'list1', businessId: 'biz1', addedBy: 'user1' }),
      },
    });

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'listItems', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'listItems');
    expect(mockLogAbuse).not.toHaveBeenCalled();
  });

  // #300 M-5: rate limit now runs BEFORE counter increment.
  it('deletes document and logs abuse WITHOUT incrementing when rate limit exceeded', async () => {
    mockCountGet.mockResolvedValueOnce({ data: () => ({ count: 101 }) });
    const mockDelete = vi.fn().mockResolvedValue(undefined);

    await onCreated()({
      params: { itemId: 'i1' },
      data: {
        data: () => ({ listId: 'list1', businessId: 'biz1', addedBy: 'user1' }),
        ref: { delete: mockDelete },
      },
    });

    // counter must NOT be incremented when limit exceeded (#300 M-5)
    expect(mockIncrementCounter).not.toHaveBeenCalled();
    expect(mockTrackWrite).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
    expect(mockLogAbuse).toHaveBeenCalledWith(expect.anything(), {
      userId: 'user1',
      type: 'rate_limit',
      collection: 'listItems',
      detail: 'Exceeded 100 listItems/day — document deleted',
    });
  });

  it('does not delete document when rate limit not exceeded', async () => {
    mockCountGet.mockResolvedValueOnce({ data: () => ({ count: 50 }) });
    const mockDelete = vi.fn().mockResolvedValue(undefined);

    await onCreated()({
      params: { itemId: 'i1' },
      data: {
        data: () => ({ listId: 'list1', businessId: 'biz1', addedBy: 'user1' }),
        ref: { delete: mockDelete },
      },
    });

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockLogAbuse).not.toHaveBeenCalled();
  });

  it('logs correct detail message mentioning document deleted', async () => {
    mockCountGet.mockResolvedValueOnce({ data: () => ({ count: 200 }) });
    const mockDelete = vi.fn().mockResolvedValue(undefined);

    await onCreated()({
      params: { itemId: 'i1' },
      data: {
        data: () => ({ listId: 'list1', businessId: 'biz1', addedBy: 'user2' }),
        ref: { delete: mockDelete },
      },
    });

    expect(mockLogAbuse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      detail: expect.stringContaining('document deleted'),
    }));
  });
});
