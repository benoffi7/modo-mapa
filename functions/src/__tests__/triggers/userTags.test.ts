import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  handlers,
  mockGetFirestore,
  mockCheckRateLimit,
  mockIncrementCounter,
  mockTrackWrite,
  mockTrackDelete,
  mockLogAbuse,
  mockTrackFunctionTiming,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: any) => Promise<void>>,
  mockGetFirestore: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue(false),
  mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
  mockTrackWrite: vi.fn().mockResolvedValue(undefined),
  mockTrackDelete: vi.fn().mockResolvedValue(undefined),
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
  onDocumentDeleted: (path: string, handler: (event: any) => Promise<void>) => {
    handlers[`deleted:${path}`] = handler;
    return handler;
  },
}));

vi.mock('../../utils/rateLimiter', () => ({
  checkRateLimit: (...args: any[]) => mockCheckRateLimit(...args),
}));
vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: any[]) => mockIncrementCounter(...args),
  trackWrite: (...args: any[]) => mockTrackWrite(...args),
  trackDelete: (...args: any[]) => mockTrackDelete(...args),
}));
vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: any[]) => mockLogAbuse(...args),
}));
vi.mock('../../utils/perfTracker', () => ({
  trackFunctionTiming: (...args: any[]) => mockTrackFunctionTiming(...args),
}));

import '../../triggers/userTags';

function makeDb() {
  const db = {};
  mockGetFirestore.mockReturnValue(db);
  return db;
}

function makeCreatedEvent(data: Record<string, unknown> = {}) {
  const snapRef = { delete: vi.fn().mockResolvedValue(undefined) };
  return {
    data: {
      data: () => data,
      ref: snapRef,
    },
    params: { tagId: 'tag1' },
    _snapRef: snapRef,
  };
}

describe('onUserTagCreated', () => {
  const getHandler = () => handlers['created:userTags/{tagId}'];

  beforeEach(() => {
    vi.clearAllMocks();
    makeDb();
    mockCheckRateLimit.mockResolvedValue(false);
  });

  it('returns early when event.data is undefined', async () => {
    await getHandler()({ data: undefined, params: { tagId: 'tag1' } });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('deletes doc and logs abuse when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(true);
    const event = makeCreatedEvent({ userId: 'user1', businessId: 'biz1', tagId: 'great' });
    await getHandler()(event);
    expect(event._snapRef.delete).toHaveBeenCalledOnce();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'rate_limit', userId: 'user1' }),
    );
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('happy path: increments counter, tracks write, and tracks timing', async () => {
    const event = makeCreatedEvent({ userId: 'user1', businessId: 'biz1', tagId: 'friendly' });
    await getHandler()(event);
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'userTags', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'userTags');
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('onUserTagCreated', expect.any(Number));
    expect(event._snapRef.delete).not.toHaveBeenCalled();
  });
});

describe('onUserTagDeleted', () => {
  const getHandler = () => handlers['deleted:userTags/{tagId}'];

  beforeEach(() => {
    vi.clearAllMocks();
    makeDb();
  });

  it('decrements counter, tracks delete, and tracks timing', async () => {
    await getHandler()({ data: undefined, params: { tagId: 'tag1' } });
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'userTags', -1);
    expect(mockTrackDelete).toHaveBeenCalledWith(expect.anything(), 'userTags');
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('onUserTagDeleted', expect.any(Number));
  });
});
