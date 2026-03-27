import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlerHolder,
  mockGetDb,
  mockCalculatePercentile,
} = vi.hoisted(() => ({
  handlerHolder: { fn: null as (() => Promise<void>) | null },
  mockGetDb: vi.fn(),
  mockCalculatePercentile: vi.fn().mockReturnValue(42),
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_opts: unknown, handler: () => Promise<void>) => {
    handlerHolder.fn = handler;
    return handler;
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
  },
  Timestamp: {
    fromDate: (d: Date) => d,
  },
}));

vi.mock('../../helpers/env', () => ({
  get getDb() { return mockGetDb; },
}));

vi.mock('../../utils/perfTracker', () => ({
  calculatePercentile: (...args: unknown[]) => mockCalculatePercentile(...args),
}));

function createMockSetup(overrides?: {
  aggregates?: Record<string, unknown>;
  counters?: Record<string, unknown>;
  perfCounters?: Record<string, unknown>;
  tagDocs?: Array<{ tagId: string }>;
  activityDocs?: Array<{ userId: string }>;
  newAccountsDocs?: number;
  perfMetricDocs?: Array<Record<string, unknown>>;
}) {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockResolvedValue(undefined);

  const mockDocFn = vi.fn().mockImplementation((path: string) => {
    if (path === 'config/aggregates') {
      return {
        get: vi.fn().mockResolvedValue({
          data: () => overrides?.aggregates ?? {},
        }),
      };
    }
    if (path === 'config/counters') {
      return {
        get: vi.fn().mockResolvedValue({
          data: () => overrides?.counters ?? {},
        }),
        set: mockSet,
      };
    }
    if (path === 'config/perfCounters') {
      return {
        get: vi.fn().mockResolvedValue({
          data: () => overrides?.perfCounters ?? {},
        }),
        delete: mockDelete,
      };
    }
    if (path.startsWith('dailyMetrics/')) {
      return { set: mockSet };
    }
    return { get: vi.fn().mockResolvedValue({ data: () => ({}) }), set: mockSet };
  });

  const tagDocs = (overrides?.tagDocs ?? []).map((d) => ({
    data: () => d,
  }));

  const activityDocs = (overrides?.activityDocs ?? []).map((d) => ({
    data: () => d,
  }));

  const perfMetricDocs = (overrides?.perfMetricDocs ?? []).map((d) => ({
    data: () => d,
  }));

  const mockCollectionFn = vi.fn().mockImplementation((name: string) => {
    if (name === 'userTags') {
      // getTopTags uses .select().limit().get()
      // countActiveUsers uses .where().select().get()
      const selectGet = vi.fn().mockResolvedValue({ docs: activityDocs });
      const selectFn = vi.fn().mockReturnValue({ get: selectGet });
      return {
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ docs: tagDocs }),
          }),
        }),
        where: vi.fn().mockReturnValue({ select: selectFn }),
      };
    }
    if (name === 'users') {
      return {
        where: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ size: overrides?.newAccountsDocs ?? 0 }),
          }),
        }),
      };
    }
    if (name === 'perfMetrics') {
      return {
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            docs: perfMetricDocs,
            size: perfMetricDocs.length,
          }),
        }),
      };
    }
    if (name === 'abuseLogs') {
      return { add: vi.fn().mockResolvedValue(undefined) };
    }
    // For activity collection queries (comments, ratings, favorites, feedback, userTags, customTags)
    // Used by countActiveUsers and top writers
    const selectGet = vi.fn().mockResolvedValue({ docs: activityDocs });
    const selectFn = vi.fn().mockReturnValue({ get: selectGet });
    const whereFn = vi.fn().mockReturnValue({ select: selectFn });
    return { where: whereFn };
  });

  const db = {
    doc: mockDocFn,
    collection: mockCollectionFn,
  };
  mockGetDb.mockReturnValue(db);

  return { db, mockSet, mockDelete, mockDocFn };
}

import '../../scheduled/dailyMetrics';

describe('dailyMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalculatePercentile.mockReturnValue(42);
  });

  it('handler is registered', () => {
    expect(handlerHolder.fn).not.toBeNull();
  });

  it('writes daily metrics document', async () => {
    const { mockSet } = createMockSetup({
      counters: { dailyReads: 100, dailyWrites: 50, dailyDeletes: 10 },
    });

    await handlerHolder.fn!();

    // Should write to dailyMetrics/{today}
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyReads: 100,
        dailyWrites: 50,
        dailyDeletes: 10,
      }),
      { merge: true },
    );
  });

  it('resets daily counters after writing metrics', async () => {
    const { mockSet, mockDelete } = createMockSetup();

    await handlerHolder.fn!();

    // Should reset counters
    expect(mockSet).toHaveBeenCalledWith(
      { dailyReads: 0, dailyWrites: 0, dailyDeletes: 0 },
      { merge: true },
    );
    // Should delete perfCounters
    expect(mockDelete).toHaveBeenCalled();
  });

  it('computes top tags from userTags collection', async () => {
    const { mockSet } = createMockSetup({
      tagDocs: [
        { tagId: 'wifi' },
        { tagId: 'wifi' },
        { tagId: 'pet-friendly' },
      ],
    });

    await handlerHolder.fn!();

    const call = mockSet.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).topTags !== undefined,
    );
    expect(call).toBeDefined();
    const topTags = (call![0] as { topTags: Array<{ tagId: string; count: number }> }).topTags;
    expect(topTags[0]).toEqual({ tagId: 'wifi', count: 2 });
    expect(topTags[1]).toEqual({ tagId: 'pet-friendly', count: 1 });
  });

  it('extracts rating distribution from aggregates', async () => {
    const { mockSet } = createMockSetup({
      aggregates: {
        ratingDistribution: { '1': 5, '2': 10, '3': 20, '4': 30, '5': 35 },
      },
    });

    await handlerHolder.fn!();

    const call = mockSet.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).ratingDistribution !== undefined,
    );
    expect(call).toBeDefined();
    expect((call![0] as { ratingDistribution: Record<string, number> }).ratingDistribution).toEqual({
      '1': 5, '2': 10, '3': 20, '4': 30, '5': 35,
    });
  });

  it('defaults missing counters to 0', async () => {
    const { mockSet } = createMockSetup({
      counters: {},
    });

    await handlerHolder.fn!();

    const call = mockSet.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).dailyReads !== undefined,
    );
    expect(call).toBeDefined();
    expect((call![0] as { dailyReads: number }).dailyReads).toBe(0);
  });

  it('includes performance data when perfMetrics exist', async () => {
    const { mockSet } = createMockSetup({
      perfMetricDocs: [
        {
          vitals: { lcp: 1200, inp: 100, cls: 0.1, ttfb: 300 },
          queries: { getBusinesses: { p50: 50, p95: 200 } },
        },
      ],
      perfCounters: { onRatingWritten: [10, 20, 30] },
    });

    await handlerHolder.fn!();

    const call = mockSet.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).performance !== undefined,
    );
    expect(call).toBeDefined();
    const perf = (call![0] as { performance: { sampleCount: number } }).performance;
    expect(perf.sampleCount).toBe(1);
  });
});
