import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  handlers,
  mockGetFirestore,
  mockIncrementCounter,
  mockTrackWrite,
  mockLogAbuse,
  mockTrackFunctionTiming,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: any) => Promise<void>>,
  mockGetFirestore: vi.fn(),
  mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
  mockTrackWrite: vi.fn().mockResolvedValue(undefined),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
  mockTrackFunctionTiming: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
  FieldValue: { increment: vi.fn((n: number) => n), serverTimestamp: vi.fn() },
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (path: string, handler: (event: any) => Promise<void>) => {
    handlers[`created:${path}`] = handler;
    return handler;
  },
}));

vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: any[]) => mockIncrementCounter(...args),
  trackWrite: (...args: any[]) => mockTrackWrite(...args),
}));
vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: any[]) => mockLogAbuse(...args),
}));
vi.mock('../../utils/perfTracker', () => ({
  trackFunctionTiming: (...args: any[]) => mockTrackFunctionTiming(...args),
}));

import '../../triggers/sharedLists';

function createMockDb(count: number) {
  const mockGet = vi.fn().mockResolvedValue({ data: () => ({ count }) });
  const mockCount = vi.fn().mockReturnValue({ get: mockGet });
  const mockWhere2 = vi.fn().mockReturnValue({ count: mockCount });
  const mockWhere1 = vi.fn().mockReturnValue({ where: mockWhere2 });
  const mockCollection = vi.fn().mockReturnValue({ where: mockWhere1 });
  const db = { collection: mockCollection };
  mockGetFirestore.mockReturnValue(db);
  return { db };
}

function makeEvent(data: Record<string, unknown> | undefined) {
  if (data === undefined) {
    return { data: undefined, params: { listId: 'list1' } };
  }
  const snapRef = { delete: vi.fn().mockResolvedValue(undefined) };
  return {
    data: { data: () => data, ref: snapRef },
    params: { listId: 'list1' },
    _snapRef: snapRef,
  };
}

describe('onSharedListCreated', () => {
  const getHandler = () => handlers['created:sharedLists/{listId}'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when event.data is undefined', async () => {
    createMockDb(0);
    await getHandler()(makeEvent(undefined));
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('increments counter but skips rate limit when ownerId is missing', async () => {
    createMockDb(0);
    const event = makeEvent({ title: 'My List' }); // no ownerId
    await getHandler()(event);
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'sharedLists', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'sharedLists');
    expect(mockLogAbuse).not.toHaveBeenCalled();
    expect((event as any)._snapRef?.delete).not.toHaveBeenCalled?.();
  });

  it('does not delete when count is exactly 10 (boundary — > 10 check)', async () => {
    createMockDb(10);
    const event = makeEvent({ ownerId: 'user1', title: 'My List' }) as any;
    await getHandler()(event);
    expect(event._snapRef.delete).not.toHaveBeenCalled();
    expect(mockLogAbuse).not.toHaveBeenCalled();
  });

  it('deletes doc and logs abuse when count exceeds 10', async () => {
    createMockDb(11);
    const event = makeEvent({ ownerId: 'user1', title: 'My List' }) as any;
    await getHandler()(event);
    expect(event._snapRef.delete).toHaveBeenCalledOnce();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'user1',
        type: 'rate_limit',
        collection: 'sharedLists',
      }),
    );
  });

  it('tracks timing in happy path', async () => {
    createMockDb(3);
    const event = makeEvent({ ownerId: 'user1', title: 'Good List' });
    await getHandler()(event);
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('onSharedListCreated', expect.any(Number));
  });
});
