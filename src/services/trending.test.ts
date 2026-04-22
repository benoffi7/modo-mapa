import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDoc = vi.fn();

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { TRENDING_BUSINESSES: 'trendingBusinesses' },
}));
vi.mock('../config/converters', () => ({
  trendingDataConverter: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

import { fetchTrending } from './trending';

describe('fetchTrending', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns data when document exists', async () => {
    const fakeData = { businesses: ['b1', 'b2'] };
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => fakeData,
    });

    const result = await fetchTrending();
    expect(result).toEqual(fakeData);
  });

  it('returns null when document does not exist', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
      data: () => undefined,
    });

    const result = await fetchTrending();
    expect(result).toBeNull();
  });
});
