import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: {
    USER_RANKINGS: 'userRankings',
    COMMENTS: 'comments',
    RATINGS: 'ratings',
    COMMENT_LIKES: 'commentLikes',
    CUSTOM_TAGS: 'customTags',
    FAVORITES: 'favorites',
    MENU_PHOTOS: 'menuPhotos',
  },
}));
vi.mock('../config/converters', () => ({ userRankingConverter: {} }));
vi.mock('../constants/rankings', () => ({
  SCORING: { comments: 3, ratings: 2, likes: 1, tags: 1, favorites: 1, photos: 5 },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  doc: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getCountFromServer: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: { fromDate: vi.fn() },
}));

import { getDoc, getDocs, getCountFromServer } from 'firebase/firestore';
import {
  getCurrentPeriodKey,
  getPreviousPeriodKey,
  fetchRanking,
  fetchLatestRanking,
  fetchUserScoreHistory,
  fetchUserLiveScore,
} from './rankings';

describe('getCurrentPeriodKey', () => {
  afterEach(() => vi.useRealTimers());

  it('returns "alltime" for alltime', () => {
    expect(getCurrentPeriodKey('alltime')).toBe('alltime');
  });

  it('returns yearly key', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));
    expect(getCurrentPeriodKey('yearly')).toBe('yearly_2025');
  });

  it('returns monthly key with zero-padded month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-15'));
    expect(getCurrentPeriodKey('monthly')).toBe('monthly_2025-03');
  });

  it('returns monthly key for January', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-10'));
    expect(getCurrentPeriodKey('monthly')).toBe('monthly_2025-01');
  });

  it('returns monthly key for December', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-10'));
    expect(getCurrentPeriodKey('monthly')).toBe('monthly_2025-12');
  });

  it('returns weekly key with ISO week format', () => {
    vi.useFakeTimers();
    // 2025-01-06 is a Monday, ISO week 2
    vi.setSystemTime(new Date('2025-01-06'));
    const key = getCurrentPeriodKey('weekly');
    expect(key).toMatch(/^weekly_\d{4}-W\d{2}$/);
  });
});

describe('getPreviousPeriodKey', () => {
  afterEach(() => vi.useRealTimers());

  it('returns null for alltime', () => {
    expect(getPreviousPeriodKey('alltime')).toBeNull();
  });

  it('returns previous year for yearly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));
    expect(getPreviousPeriodKey('yearly')).toBe('yearly_2024');
  });

  it('returns previous month', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-15'));
    expect(getPreviousPeriodKey('monthly')).toBe('monthly_2025-02');
  });

  it('handles January → December year boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15'));
    expect(getPreviousPeriodKey('monthly')).toBe('monthly_2024-12');
  });

  it('returns previous ISO week for weekly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-13'));
    const key = getPreviousPeriodKey('weekly');
    expect(key).toMatch(/^weekly_\d{4}-W\d{2}$/);
    // Should be one week before current
    expect(key).not.toBe(getCurrentPeriodKey('weekly'));
  });
});

describe('getCurrentPeriodKey — weekly specifics', () => {
  afterEach(() => vi.useRealTimers());

  it('returns correct ISO week for a mid-year Wednesday', () => {
    vi.useFakeTimers();
    // 2025-06-18 is a Wednesday in ISO week 25
    vi.setSystemTime(new Date('2025-06-18'));
    expect(getCurrentPeriodKey('weekly')).toBe('weekly_2025-W25');
  });

  it('handles week 1 at start of year', () => {
    vi.useFakeTimers();
    // 2025-01-01 is a Wednesday, ISO week 1
    vi.setSystemTime(new Date('2025-01-01'));
    expect(getCurrentPeriodKey('weekly')).toBe('weekly_2025-W01');
  });
});

describe('getPreviousPeriodKey — weekly specifics', () => {
  afterEach(() => vi.useRealTimers());

  it('returns previous week key for a known date', () => {
    vi.useFakeTimers();
    // 2025-06-18 is W25, so previous should be W24
    vi.setSystemTime(new Date('2025-06-18'));
    expect(getPreviousPeriodKey('weekly')).toBe('weekly_2025-W24');
  });
});

describe('fetchRanking', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns ranking data when document exists', async () => {
    const mockRanking = {
      period: 'monthly_2025-03',
      startDate: new Date(),
      endDate: new Date(),
      rankings: [{ userId: 'u1', displayName: 'Test', score: 10, breakdown: { comments: 1, ratings: 1, likes: 0, tags: 0, favorites: 0, photos: 0 } }],
      totalParticipants: 1,
    };
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => mockRanking } as never);

    const result = await fetchRanking('monthly_2025-03');
    expect(result).toEqual(mockRanking);
  });

  it('returns null when document does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false, data: () => undefined } as never);

    const result = await fetchRanking('monthly_2099-01');
    expect(result).toBeNull();
  });
});

describe('fetchLatestRanking', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns latest ranking document for given type', async () => {
    const mockRanking = {
      period: 'weekly_2025-W25',
      startDate: new Date(),
      endDate: new Date(),
      rankings: [],
      totalParticipants: 0,
    };
    vi.mocked(getDocs).mockResolvedValue({ empty: false, docs: [{ data: () => mockRanking }] } as never);

    const result = await fetchLatestRanking('weekly');
    expect(result).toEqual(mockRanking);
  });

  it('returns null when no ranking documents exist', async () => {
    vi.mocked(getDocs).mockResolvedValue({ empty: true, docs: [] } as never);

    const result = await fetchLatestRanking('monthly');
    expect(result).toBeNull();
  });
});

describe('fetchUserScoreHistory', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns empty array for alltime period type', async () => {
    const result = await fetchUserScoreHistory('u1', 'alltime');
    expect(result).toEqual([]);
  });

  it('fetches monthly score history for the requested count', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));

    // Mock fetchRanking via getDoc — each call returns a ranking with user score
    const mockEntry = (score: number) => ({
      exists: () => true,
      data: () => ({
        period: 'x',
        startDate: new Date(),
        endDate: new Date(),
        rankings: [{ userId: 'u1', displayName: 'Test', score, breakdown: { comments: 0, ratings: 0, likes: 0, tags: 0, favorites: 0, photos: 0 } }],
        totalParticipants: 1,
      }),
    });

    vi.mocked(getDoc)
      .mockResolvedValueOnce(mockEntry(10) as never)
      .mockResolvedValueOnce(mockEntry(20) as never)
      .mockResolvedValueOnce(mockEntry(30) as never);

    const result = await fetchUserScoreHistory('u1', 'monthly', 3);
    expect(result).toEqual([10, 20, 30]);
  });

  it('returns 0 for periods where the user has no entry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));

    // Ranking exists but user not in it
    const mockNoUser = {
      exists: () => true,
      data: () => ({
        period: 'x',
        startDate: new Date(),
        endDate: new Date(),
        rankings: [{ userId: 'other', displayName: 'Other', score: 99, breakdown: { comments: 0, ratings: 0, likes: 0, tags: 0, favorites: 0, photos: 0 } }],
        totalParticipants: 1,
      }),
    };

    vi.mocked(getDoc).mockResolvedValue(mockNoUser as never);

    const result = await fetchUserScoreHistory('u1', 'monthly', 2);
    expect(result).toEqual([0, 0]);
  });

  it('returns 0 for periods where no ranking document exists', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));

    vi.mocked(getDoc).mockResolvedValue({ exists: () => false, data: () => undefined } as never);

    const result = await fetchUserScoreHistory('u1', 'yearly', 2);
    expect(result).toEqual([0, 0]);
  });

  it('caps count at 12', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));

    vi.mocked(getDoc).mockResolvedValue({ exists: () => false, data: () => undefined } as never);

    const result = await fetchUserScoreHistory('u1', 'monthly', 20);
    // Should only fetch 12 periods max
    expect(result).toHaveLength(12);
  });

  it('handles weekly period type', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-18'));

    vi.mocked(getDoc).mockResolvedValue({ exists: () => false, data: () => undefined } as never);

    const result = await fetchUserScoreHistory('u1', 'weekly', 3);
    expect(result).toHaveLength(3);
    expect(result).toEqual([0, 0, 0]);
  });
});

describe('fetchUserLiveScore', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('computes live score using the scoring formula', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));

    // countUserDocs is called 5 times, then getCountFromServer once more for photos
    // The Promise.all has 6 elements: 5 countUserDocs + 1 direct getCountFromServer
    // countUserDocs itself calls getCountFromServer internally
    // So total getCountFromServer calls: 5 (from countUserDocs) + 1 (photos) = 6
    vi.mocked(getCountFromServer)
      .mockResolvedValueOnce({ data: () => ({ count: 2 }) } as never)   // comments
      .mockResolvedValueOnce({ data: () => ({ count: 3 }) } as never)   // ratings
      .mockResolvedValueOnce({ data: () => ({ count: 1 }) } as never)   // likes
      .mockResolvedValueOnce({ data: () => ({ count: 4 }) } as never)   // tags
      .mockResolvedValueOnce({ data: () => ({ count: 0 }) } as never)   // favorites
      .mockResolvedValueOnce({ data: () => ({ count: 1 }) } as never);  // photos

    const result = await fetchUserLiveScore('u1', 'Gonzalo', 'monthly');

    // score = 2*3 + 3*2 + 1*1 + 4*1 + 0*1 + 1*5 = 6 + 6 + 1 + 4 + 0 + 5 = 22
    expect(result).toEqual({
      userId: 'u1',
      displayName: 'Gonzalo',
      score: 22,
      breakdown: { comments: 2, ratings: 3, likes: 1, tags: 4, favorites: 0, photos: 1 },
    });
  });

  it('returns zero score when user has no activity', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15'));

    vi.mocked(getCountFromServer).mockResolvedValue({ data: () => ({ count: 0 }) } as never);

    const result = await fetchUserLiveScore('u2', 'Empty', 'weekly');

    expect(result.score).toBe(0);
    expect(result.breakdown).toEqual({ comments: 0, ratings: 0, likes: 0, tags: 0, favorites: 0, photos: 0 });
  });
});
