import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIncrementCounter = vi.fn().mockResolvedValue(undefined);
const mockTrackWrite = vi.fn().mockResolvedValue(undefined);
const mockTrackDelete = vi.fn().mockResolvedValue(undefined);
const mockUpdateRatingAggregates = vi.fn().mockResolvedValue(undefined);
const mockTrackFunctionTiming = vi.fn().mockResolvedValue(undefined);
const mockDocGet = vi.fn().mockResolvedValue({ exists: false, data: () => null });
const mockDoc = vi.fn().mockReturnValue({ get: mockDocGet });
const mockGetFirestore = vi.fn().mockReturnValue({ doc: mockDoc });

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => mockGetFirestore(),
}));

vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: unknown[]) => mockIncrementCounter(...args),
  trackWrite: (...args: unknown[]) => mockTrackWrite(...args),
  trackDelete: (...args: unknown[]) => mockTrackDelete(...args),
}));

vi.mock('../../utils/aggregates', () => ({
  updateRatingAggregates: (...args: unknown[]) => mockUpdateRatingAggregates(...args),
}));

vi.mock('../../utils/perfTracker', () => ({
  trackFunctionTiming: (...args: unknown[]) => mockTrackFunctionTiming(...args),
}));

vi.mock('../../utils/fanOut', () => ({
  fanOutToFollowers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/rateLimiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: vi.fn().mockResolvedValue(undefined),
}));

// Import the raw handler — we'll call it directly instead of going through onDocumentWritten
vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: (_path: string, handler: (...args: unknown[]) => unknown) => handler,
}));

import { onRatingWritten } from '../../triggers/ratings';

const handler = onRatingWritten as unknown as (event: unknown) => Promise<void>;

function makeEvent(
  beforeData: Record<string, unknown> | null,
  afterData: Record<string, unknown> | null,
) {
  return {
    params: { ratingId: 'rating_123' },
    data: {
      before: beforeData
        ? { exists: true, data: () => beforeData }
        : { exists: false, data: () => null },
      after: afterData
        ? { exists: true, data: () => afterData, ref: { delete: vi.fn() } }
        : { exists: false, data: () => null },
    },
  };
}

describe('onRatingWritten', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handles create — increments counter and adds aggregates', async () => {
    const event = makeEvent(null, { businessId: 'biz1', score: 4 });
    await handler(event);

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'ratings', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'ratings');
    expect(mockUpdateRatingAggregates).toHaveBeenCalledWith(expect.anything(), 'biz1', 'add', 4);
    expect(mockTrackFunctionTiming).toHaveBeenCalled();
  });

  it('handles update with score change — updates aggregates', async () => {
    const event = makeEvent(
      { businessId: 'biz1', score: 3 },
      { businessId: 'biz1', score: 5 },
    );
    await handler(event);

    expect(mockIncrementCounter).not.toHaveBeenCalled();
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'ratings');
    expect(mockUpdateRatingAggregates).toHaveBeenCalledWith(expect.anything(), 'biz1', 'add', 5, 3);
  });

  it('handles update with same score — skips aggregates', async () => {
    const event = makeEvent(
      { businessId: 'biz1', score: 4 },
      { businessId: 'biz1', score: 4 },
    );
    await handler(event);

    expect(mockTrackWrite).toHaveBeenCalled();
    expect(mockUpdateRatingAggregates).not.toHaveBeenCalled();
  });

  it('handles delete — decrements counter and removes aggregates', async () => {
    const event = makeEvent({ businessId: 'biz1', score: 4 }, null);
    await handler(event);

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'ratings', -1);
    expect(mockTrackDelete).toHaveBeenCalledWith(expect.anything(), 'ratings');
    expect(mockUpdateRatingAggregates).toHaveBeenCalledWith(expect.anything(), 'biz1', 'remove', 4);
  });

  it('always tracks function timing', async () => {
    const event = makeEvent(null, { businessId: 'biz1', score: 1 });
    await handler(event);
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('onRatingWritten', expect.any(Number));
  });
});
