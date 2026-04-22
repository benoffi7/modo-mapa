import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  handlers,
  mockGetFirestore,
  mockCheckRateLimit,
  mockIncrementCounter,
  mockTrackWrite,
  mockLogAbuse,
  mockTrackFunctionTiming,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: any) => Promise<void>>,
  mockGetFirestore: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue(false),
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
  onDocumentUpdated: (path: string, handler: (event: any) => Promise<void>) => {
    handlers[`updated:${path}`] = handler;
    return handler;
  },
}));

vi.mock('../../utils/rateLimiter', () => ({
  checkRateLimit: (...args: any[]) => mockCheckRateLimit(...args),
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

import '../../triggers/priceLevels';

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
    params: { docId: 'pl1' },
    _snapRef: snapRef,
  };
}

describe('onPriceLevelCreated', () => {
  const getHandler = () => handlers['created:priceLevels/{docId}'];

  beforeEach(() => {
    vi.clearAllMocks();
    makeDb();
    mockCheckRateLimit.mockResolvedValue(false);
  });

  it('skips all logic when event.data is undefined', async () => {
    await getHandler()({ data: undefined, params: { docId: 'pl1' } });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('skips rate limit check when userId is undefined and goes directly to counters', async () => {
    const event = makeCreatedEvent({ businessId: 'biz1' }); // no userId
    await getHandler()(event);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'priceLevels', 1);
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('onPriceLevelCreated', expect.any(Number));
  });

  it('deletes doc and logs abuse when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(true);
    const event = makeCreatedEvent({ userId: 'user1', businessId: 'biz1' });
    await getHandler()(event);
    expect(event._snapRef.delete).toHaveBeenCalledOnce();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'rate_limit', userId: 'user1' }),
    );
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('happy path: increments counter, tracks write, and tracks timing when userId present', async () => {
    const event = makeCreatedEvent({ userId: 'user1', businessId: 'biz1' });
    await getHandler()(event);
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'priceLevels', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'priceLevels');
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('onPriceLevelCreated', expect.any(Number));
    expect(event._snapRef.delete).not.toHaveBeenCalled();
  });
});

describe('onPriceLevelUpdated', () => {
  const getHandler = () => handlers['updated:priceLevels/{docId}'];

  beforeEach(() => {
    vi.clearAllMocks();
    makeDb();
  });

  it('tracks write and timing on update', async () => {
    await getHandler()({ data: undefined, params: { docId: 'pl1' } });
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'priceLevels');
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('onPriceLevelUpdated', expect.any(Number));
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });
});
