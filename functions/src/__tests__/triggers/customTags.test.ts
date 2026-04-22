import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  handlers,
  mockGetFirestore,
  mockCheckRateLimit,
  mockCheckModeration,
  mockIncrementCounter,
  mockTrackWrite,
  mockTrackDelete,
  mockLogAbuse,
  mockTrackFunctionTiming,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: any) => Promise<void>>,
  mockGetFirestore: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue(false),
  mockCheckModeration: vi.fn().mockResolvedValue(false),
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
vi.mock('../../utils/moderator', () => ({
  checkModeration: (...args: any[]) => mockCheckModeration(...args),
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

import '../../triggers/customTags';

function makeDb() {
  const db = {};
  mockGetFirestore.mockReturnValue(db);
  return db;
}

function makeEvent(data: Record<string, unknown> = {}) {
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

function makeBaseData(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    userId: 'user1',
    businessId: 'biz1',
    label: 'Buena onda',
    ...overrides,
  };
}

describe('onCustomTagCreated', () => {
  const getHandler = () => handlers['created:customTags/{tagId}'];

  beforeEach(() => {
    vi.clearAllMocks();
    makeDb();
    mockCheckRateLimit.mockResolvedValue(false);
    mockCheckModeration.mockResolvedValue(false);
  });

  it('skips all logic when event.data is undefined', async () => {
    await getHandler()({ data: undefined, params: { tagId: 'tag1' } });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('deletes doc and logs abuse when per-entity rate limit is exceeded', async () => {
    // First call (per_entity) returns exceeded
    mockCheckRateLimit.mockResolvedValueOnce(true);
    const event = makeEvent(makeBaseData());
    await getHandler()(event);
    expect(event._snapRef.delete).toHaveBeenCalledOnce();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'rate_limit', userId: 'user1' }),
    );
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('deletes doc and logs abuse when daily rate limit is exceeded', async () => {
    // First call (per_entity) passes, second call (daily) exceeds
    mockCheckRateLimit.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const event = makeEvent(makeBaseData());
    await getHandler()(event);
    expect(event._snapRef.delete).toHaveBeenCalledOnce();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'rate_limit', detail: expect.stringContaining('50') }),
    );
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('deletes doc and logs abuse when label is flagged by moderation', async () => {
    mockCheckModeration.mockResolvedValue(true);
    const event = makeEvent(makeBaseData());
    await getHandler()(event);
    expect(event._snapRef.delete).toHaveBeenCalledOnce();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'flagged' }),
    );
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('happy path: increments counter, tracks write, and tracks timing', async () => {
    const event = makeEvent(makeBaseData());
    await getHandler()(event);
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'customTags', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'customTags');
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('onCustomTagCreated', expect.any(Number));
    expect(event._snapRef.delete).not.toHaveBeenCalled();
  });
});

describe('onCustomTagDeleted', () => {
  const getHandler = () => handlers['deleted:customTags/{tagId}'];

  beforeEach(() => {
    vi.clearAllMocks();
    makeDb();
  });

  it('decrements counter, tracks delete, and tracks timing', async () => {
    await getHandler()({ data: undefined, params: { tagId: 'tag1' } });
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'customTags', -1);
    expect(mockTrackDelete).toHaveBeenCalledWith(expect.anything(), 'customTags');
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('onCustomTagDeleted', expect.any(Number));
  });
});
