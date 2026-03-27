import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({
    withConverter: vi.fn(() => 'converted-collection'),
  })),
  query: vi.fn(() => 'query-ref'),
  where: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: vi.fn(),
  getFirestore: vi.fn(),
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  db: {},
}));

vi.mock('../config/collections', () => ({
  COLLECTIONS: {
    FAVORITES: 'favorites',
    RATINGS: 'ratings',
    USER_TAGS: 'userTags',
  },
}));

vi.mock('../config/converters', () => ({
  favoriteConverter: {},
  ratingConverter: {},
  userTagConverter: {},
}));

import { fetchUserSuggestionData } from './suggestions';

describe('fetchUserSuggestionData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches favorites, ratings, and userTags in parallel', async () => {
    const favs = [{ id: 'f1', businessId: 'biz1' }];
    const ratings = [{ id: 'r1', score: 5 }];
    const tags = [{ id: 't1', tag: 'pizza' }];

    mockGetDocs
      .mockResolvedValueOnce({ docs: favs.map((f) => ({ data: () => f })) })
      .mockResolvedValueOnce({ docs: ratings.map((r) => ({ data: () => r })) })
      .mockResolvedValueOnce({ docs: tags.map((t) => ({ data: () => t })) });

    const result = await fetchUserSuggestionData('user1');

    expect(result.favorites).toEqual(favs);
    expect(result.ratings).toEqual(ratings);
    expect(result.userTags).toEqual(tags);
    expect(mockGetDocs).toHaveBeenCalledTimes(3);
  });

  it('returns empty arrays when no data', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const result = await fetchUserSuggestionData('user1');

    expect(result.favorites).toEqual([]);
    expect(result.ratings).toEqual([]);
    expect(result.userTags).toEqual([]);
  });

  it('handles large result sets', async () => {
    const manyFavs = Array.from({ length: 200 }, (_, i) => ({ id: `f${i}` }));
    mockGetDocs
      .mockResolvedValueOnce({ docs: manyFavs.map((f) => ({ data: () => f })) })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [] });

    const result = await fetchUserSuggestionData('user1');

    expect(result.favorites).toHaveLength(200);
  });

  it('propagates errors from getDocs', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firestore unavailable'));

    await expect(fetchUserSuggestionData('user1')).rejects.toThrow('Firestore unavailable');
  });

  it('handles partial failures (first query fails)', async () => {
    mockGetDocs.mockRejectedValue(new Error('Query failed'));

    await expect(fetchUserSuggestionData('user1')).rejects.toThrow('Query failed');
  });
});
