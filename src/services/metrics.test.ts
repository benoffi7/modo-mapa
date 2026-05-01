import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PublicMetrics } from '../types/metrics';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { DAILY_METRICS: 'dailyMetrics' },
}));

vi.mock('../config/metricsConverter', () => ({
  publicMetricsConverter: {
    fromFirestore: vi.fn(),
    toFirestore: vi.fn(),
  },
}));

const { mockGetDoc, mockWithConverter, mockDoc, mockMeasuredGetDoc } = vi.hoisted(() => {
  const getDoc = vi.fn();
  const withConverter = vi.fn();
  return {
    mockGetDoc: getDoc,
    mockWithConverter: withConverter,
    mockDoc: vi.fn().mockReturnValue({ withConverter }),
    mockMeasuredGetDoc: vi.fn((_name: string, ref: unknown) => getDoc(ref)),
  };
});

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

vi.mock('../utils/perfMetrics', () => ({
  measuredGetDoc: (name: string, ref: unknown) => mockMeasuredGetDoc(name, ref),
  measuredGetDocs: (_name: string, q: unknown) => mockGetDoc(q),
  measureAsync: (_name: string, fn: () => Promise<unknown>) => fn(),
}));

import { fetchDailyMetrics } from './metrics';

const mockMetrics: PublicMetrics = {
  date: '2026-03-31',
  ratingDistribution: { '5': 10 },
  topFavorited: [],
  topCommented: [],
  topRated: [],
  topTags: [],
};

describe('fetchDailyMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithConverter.mockReturnValue({});
  });

  it('returns PublicMetrics when doc exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockMetrics,
    });

    const result = await fetchDailyMetrics('2026-03-31');
    expect(result).toEqual(mockMetrics);
  });

  it('returns null when doc does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await fetchDailyMetrics('2026-03-31');
    expect(result).toBeNull();
  });

  it('propagates network errors', async () => {
    mockGetDoc.mockRejectedValue(new Error('network error'));

    await expect(fetchDailyMetrics('2026-03-31')).rejects.toThrow('network error');
  });

  it('instruments fetch with metrics_dailyByDate label', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await fetchDailyMetrics('2026-03-31');
    const labels = mockMeasuredGetDoc.mock.calls.map((c) => c[0]);
    expect(labels).toContain('metrics_dailyByDate');
  });
});
