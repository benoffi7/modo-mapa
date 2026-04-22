import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('../../config/collections', () => ({
  COLLECTIONS: { CONFIG: '_config', DAILY_METRICS: 'dailyMetrics' },
}));
vi.mock('../../config/adminConverters', () => ({
  countersConverter: {},
  dailyMetricsConverter: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  doc: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn(() => 'query-ref'),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

import { fetchCounters, fetchDailyMetrics } from './counters';

describe('fetchCounters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns data when doc exists', async () => {
    const counters = { comments: 10, ratings: 5 };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => counters });
    const result = await fetchCounters();
    expect(result).toEqual(counters);
  });

  it('returns null when doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    const result = await fetchCounters();
    expect(result).toBeNull();
  });
});

describe('fetchDailyMetrics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped docs array', async () => {
    const metrics = [{ id: '2024-01-01', date: '2024-01-01' }];
    mockGetDocs.mockResolvedValue({ docs: metrics.map((m) => ({ data: () => m })) });
    const result = await fetchDailyMetrics('desc');
    expect(result).toEqual(metrics);
  });

  it('applies maxDocs limit when provided', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await fetchDailyMetrics('asc', 10);
    // limit() was called (branch: maxDocs provided)
    const { limit } = await import('firebase/firestore');
    expect(limit).toHaveBeenCalledWith(10);
  });

  it('does not apply limit when maxDocs is omitted', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    vi.clearAllMocks();
    await fetchDailyMetrics('desc');
    const { limit } = await import('firebase/firestore');
    expect(limit).not.toHaveBeenCalled();
  });
});
