import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

const {
  handlers,
  mockGetFirestore,
  mockCheckRateLimit,
  mockCheckModeration,
  mockIncrementCounter,
  mockTrackWrite,
  mockLogAbuse,
  mockCreateNotification,
  mockTrackFunctionTiming,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: any) => Promise<void>>,
  mockGetFirestore: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue(false),
  mockCheckModeration: vi.fn().mockResolvedValue(false),
  mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
  mockTrackWrite: vi.fn().mockResolvedValue(undefined),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
  mockCreateNotification: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../utils/rateLimiter', () => ({
  checkRateLimit: (...args: any[]) => mockCheckRateLimit(...args),
}));
vi.mock('../../utils/moderator', () => ({
  checkModeration: (...args: any[]) => mockCheckModeration(...args),
}));
vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: any[]) => mockIncrementCounter(...args),
  trackWrite: (...args: any[]) => mockTrackWrite(...args),
}));
vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: any[]) => mockLogAbuse(...args),
}));
vi.mock('../../utils/notifications', () => ({
  createNotification: (...args: any[]) => mockCreateNotification(...args),
}));
vi.mock('../../utils/perfTracker', () => ({
  trackFunctionTiming: (...args: any[]) => mockTrackFunctionTiming(...args),
}));

import '../../triggers/recommendations';

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
    params: { docId: 'rec1' },
    _snapRef: snapRef,
  };
}

function makeBaseData(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    senderId: 'sender1',
    recipientId: 'recipient1',
    businessId: 'biz1',
    businessName: 'Pizzeria Roma',
    senderName: 'Alice',
    message: 'Great place!',
    ...overrides,
  };
}

describe('onRecommendationCreated', () => {
  const getHandler = () => handlers['created:recommendations/{docId}'];

  beforeEach(() => {
    vi.clearAllMocks();
    makeDb();
    mockCheckRateLimit.mockResolvedValue(false);
    mockCheckModeration.mockResolvedValue(false);
  });

  it('skips all logic when event.data is undefined', async () => {
    await getHandler()({ data: undefined, params: { docId: 'rec1' } });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('deletes doc and returns when senderId equals recipientId (self-recommend)', async () => {
    const event = makeEvent(makeBaseData({ senderId: 'same', recipientId: 'same' }));
    await getHandler()(event);
    expect(event._snapRef.delete).toHaveBeenCalledOnce();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('deletes doc and logs abuse when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(true);
    const event = makeEvent(makeBaseData());
    await getHandler()(event);
    expect(event._snapRef.delete).toHaveBeenCalledOnce();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'rate_limit', userId: 'sender1' }),
    );
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('deletes doc and logs abuse when message is flagged', async () => {
    mockCheckModeration.mockResolvedValue(true);
    const event = makeEvent(makeBaseData({ message: 'bad content' }));
    await getHandler()(event);
    expect(event._snapRef.delete).toHaveBeenCalledOnce();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'flagged', userId: 'sender1' }),
    );
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('skips moderation when message is empty string', async () => {
    const event = makeEvent(makeBaseData({ message: '' }));
    await getHandler()(event);
    expect(mockCheckModeration).not.toHaveBeenCalled();
    expect(mockCreateNotification).toHaveBeenCalledOnce();
  });

  it('happy path: creates notification and increments counters', async () => {
    const event = makeEvent(makeBaseData());
    await getHandler()(event);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'recipient1', type: 'recommendation' }),
    );
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'recommendations', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'recommendations');
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('onRecommendationCreated', expect.any(Number));
    expect(event._snapRef.delete).not.toHaveBeenCalled();
  });
});
