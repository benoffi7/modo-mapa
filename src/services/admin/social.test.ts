import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocs = vi.fn();

vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('../../config/collections', () => ({
  COLLECTIONS: { FOLLOWS: 'follows', RECOMMENDATIONS: 'recommendations' },
}));
vi.mock('../../config/converters', () => ({
  followConverter: {},
  recommendationConverter: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn(() => 'query-ref'),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

import {
  fetchRecentFollows,
  fetchRecentRecommendations,
  fetchFollowStats,
  fetchRecommendationStats,
} from './social';

describe('fetchRecentFollows', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped follows', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ data: () => ({ followedId: 'u1' }) }] });
    const result = await fetchRecentFollows(5);
    expect(result).toEqual([{ followedId: 'u1' }]);
  });
});

describe('fetchRecentRecommendations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped recommendations', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ data: () => ({ businessId: 'b1', read: false }) }] });
    const result = await fetchRecentRecommendations(5);
    expect(result).toHaveLength(1);
  });
});

describe('fetchFollowStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts follows per followedId and sorts by count desc', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ followedId: 'alice' }) },
        { data: () => ({ followedId: 'bob' }) },
        { data: () => ({ followedId: 'alice' }) },
      ],
      size: 3,
    });
    const result = await fetchFollowStats();
    expect(result.totalFollows).toBe(3);
    expect(result.topFollowed[0]).toEqual({ userId: 'alice', count: 2 });
    expect(result.topFollowed[1]).toEqual({ userId: 'bob', count: 1 });
  });

  it('returns empty topFollowed when no follows', async () => {
    mockGetDocs.mockResolvedValue({ docs: [], size: 0 });
    const result = await fetchFollowStats();
    expect(result.totalFollows).toBe(0);
    expect(result.topFollowed).toEqual([]);
  });
});

describe('fetchRecommendationStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calculates read rate correctly', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ read: true }) },
        { data: () => ({ read: false }) },
        { data: () => ({ read: true }) },
      ],
      size: 3,
    });
    const result = await fetchRecommendationStats();
    expect(result.total).toBe(3);
    expect(result.read).toBe(2);
    expect(result.unread).toBe(1);
    expect(result.readRate).toBe(67); // Math.round(2/3 * 100) = 67
  });

  it('returns readRate 0 when total is 0', async () => {
    mockGetDocs.mockResolvedValue({ docs: [], size: 0 });
    const result = await fetchRecommendationStats();
    expect(result.total).toBe(0);
    expect(result.readRate).toBe(0);
  });
});
