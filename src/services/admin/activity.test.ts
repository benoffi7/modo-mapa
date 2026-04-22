import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocs = vi.fn();

vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('../../config/collections', () => ({
  COLLECTIONS: {
    COMMENTS: 'comments', RATINGS: 'ratings', FAVORITES: 'favorites',
    USER_TAGS: 'userTags', CUSTOM_TAGS: 'customTags', COMMENT_LIKES: 'commentLikes',
    PRICE_LEVELS: 'priceLevels', CHECKINS: 'checkins',
  },
}));
vi.mock('../../config/converters', () => ({
  commentConverter: {}, ratingConverter: {}, favoriteConverter: {},
  userTagConverter: {}, customTagConverter: {}, checkinConverter: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn(() => 'query-ref'),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

import {
  fetchRecentComments,
  fetchRecentRatings,
  fetchRecentFavorites,
  fetchRecentUserTags,
  fetchRecentCustomTags,
  fetchAllCustomTags,
  fetchRecentCommentLikes,
  fetchRecentPriceLevels,
  fetchRecentCheckins,
} from './activity';

function emptySnap() {
  return { docs: [] };
}

function snapOf<T>(items: T[]) {
  return { docs: items.map((d) => ({ data: () => d })) };
}

describe('activity admin services', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetchRecentComments returns mapped data', async () => {
    mockGetDocs.mockResolvedValue(snapOf([{ id: 'c1', text: 'hello' }]));
    const result = await fetchRecentComments(5);
    expect(result).toEqual([{ id: 'c1', text: 'hello' }]);
  });

  it('fetchRecentRatings returns empty array', async () => {
    mockGetDocs.mockResolvedValue(emptySnap());
    expect(await fetchRecentRatings(5)).toEqual([]);
  });

  it('fetchRecentFavorites returns data', async () => {
    mockGetDocs.mockResolvedValue(snapOf([{ userId: 'u1' }]));
    const result = await fetchRecentFavorites(5);
    expect(result).toHaveLength(1);
  });

  it('fetchRecentUserTags returns data', async () => {
    mockGetDocs.mockResolvedValue(emptySnap());
    expect(await fetchRecentUserTags(5)).toEqual([]);
  });

  it('fetchRecentCustomTags returns data', async () => {
    mockGetDocs.mockResolvedValue(emptySnap());
    expect(await fetchRecentCustomTags(5)).toEqual([]);
  });

  it('fetchAllCustomTags returns all docs', async () => {
    mockGetDocs.mockResolvedValue(snapOf([{ label: 'wifi' }, { label: 'fast' }]));
    const result = await fetchAllCustomTags();
    expect(result).toHaveLength(2);
  });

  it('fetchRecentCommentLikes maps fields with toDate() fallback', async () => {
    const ts = { toDate: () => new Date('2024-01-01') };
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ userId: 'u1', commentId: 'c1', createdAt: ts }) },
        { data: () => ({ userId: undefined, commentId: undefined, createdAt: '2024-02-01' }) },
      ],
    });
    const result = await fetchRecentCommentLikes(5);
    expect(result[0].userId).toBe('u1');
    expect(result[0].commentId).toBe('c1');
    expect(result[0].createdAt).toBeInstanceOf(Date);
    expect(result[1].userId).toBe('');
    expect(result[1].commentId).toBe('');
  });

  it('fetchRecentPriceLevels maps fields with fallback', async () => {
    const ts = { toDate: () => new Date('2024-01-01') };
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ userId: 'u1', businessId: 'b1', level: 2, createdAt: ts, updatedAt: ts }) },
        { data: () => ({ userId: undefined, businessId: undefined, level: undefined, createdAt: '2024-01-01', updatedAt: '2024-01-01' }) },
      ],
    });
    const result = await fetchRecentPriceLevels(5);
    expect(result[0].level).toBe(2);
    expect(result[0].userId).toBe('u1');
    expect(result[1].level).toBe(0);
    expect(result[1].userId).toBe('');
  });

  it('fetchRecentCheckins returns data', async () => {
    mockGetDocs.mockResolvedValue(snapOf([{ id: 'ck1' }]));
    const result = await fetchRecentCheckins(5);
    expect(result).toEqual([{ id: 'ck1' }]);
  });
});
