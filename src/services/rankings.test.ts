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
  collection: vi.fn(),
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

import { getCurrentPeriodKey, getPreviousPeriodKey } from './rankings';

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
