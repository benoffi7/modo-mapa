import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchRatingsByBusinessIds = vi.fn();

vi.mock('../services/ratings', () => ({
  fetchRatingsByBusinessIds: (...args: unknown[]) => mockFetchRatingsByBusinessIds(...args),
}));

vi.mock('../utils/logger', () => ({
  logger: { warn: vi.fn() },
}));

import { calcTrustedReviewer } from './useTrustedReviewerBadge';
import type { Rating } from '../types';

function makeRating(businessId: string, score: number, userId = 'u1'): Rating {
  return { userId, businessId, score, createdAt: new Date(), updatedAt: new Date() };
}

describe('calcTrustedReviewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 current with no ratings', async () => {
    const result = await calcTrustedReviewer([]);
    expect(result.current).toBe(0);
    expect(result.target).toBe(80);
    expect(mockFetchRatingsByBusinessIds).not.toHaveBeenCalled();
  });

  it('returns 100% when all ratings are consistent', async () => {
    const userRatings = [
      makeRating('biz_001', 4),
      makeRating('biz_002', 3),
    ];
    // Community averages are the same as user ratings
    mockFetchRatingsByBusinessIds.mockResolvedValue([
      makeRating('biz_001', 4, 'other1'),
      makeRating('biz_001', 4, 'other2'),
      makeRating('biz_002', 3, 'other1'),
      makeRating('biz_002', 3, 'other2'),
    ]);

    const result = await calcTrustedReviewer(userRatings);
    expect(result.current).toBe(100);
  });

  it('returns 0% when no ratings are consistent', async () => {
    const userRatings = [
      makeRating('biz_001', 1),
      makeRating('biz_002', 1),
    ];
    // Community averages are far from user ratings
    mockFetchRatingsByBusinessIds.mockResolvedValue([
      makeRating('biz_001', 5, 'other1'),
      makeRating('biz_001', 5, 'other2'),
      makeRating('biz_002', 5, 'other1'),
      makeRating('biz_002', 5, 'other2'),
    ]);

    const result = await calcTrustedReviewer(userRatings);
    expect(result.current).toBe(0);
  });

  it('calculates mix of consistent and inconsistent', async () => {
    const userRatings = [
      makeRating('biz_001', 4),  // consistent (avg = 4)
      makeRating('biz_002', 1),  // inconsistent (avg = 5)
    ];
    mockFetchRatingsByBusinessIds.mockResolvedValue([
      makeRating('biz_001', 4, 'other1'),
      makeRating('biz_002', 5, 'other1'),
    ]);

    const result = await calcTrustedReviewer(userRatings);
    expect(result.current).toBe(50); // 1 out of 2
  });

  it('considers +-0.5 as consistent', async () => {
    const userRatings = [makeRating('biz_001', 4)];
    // avg = 3.5, user = 4, diff = 0.5 -> consistent
    mockFetchRatingsByBusinessIds.mockResolvedValue([
      makeRating('biz_001', 3, 'other1'),
      makeRating('biz_001', 4, 'other2'),
    ]);

    const result = await calcTrustedReviewer(userRatings);
    expect(result.current).toBe(100);
  });

  it('handles fetch error gracefully', async () => {
    const userRatings = [makeRating('biz_001', 4)];
    mockFetchRatingsByBusinessIds.mockRejectedValue(new Error('network'));

    const result = await calcTrustedReviewer(userRatings);
    expect(result.current).toBe(0);
  });

  it('deduplicates business IDs before fetching', async () => {
    const userRatings = [
      makeRating('biz_001', 4),
      makeRating('biz_001', 3),
    ];
    mockFetchRatingsByBusinessIds.mockResolvedValue([
      makeRating('biz_001', 3.5, 'other1'),
    ]);

    await calcTrustedReviewer(userRatings);
    expect(mockFetchRatingsByBusinessIds).toHaveBeenCalledWith(['biz_001']);
  });
});
