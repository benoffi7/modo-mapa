import { describe, it, expect, vi } from 'vitest';

// Mock Firebase before importing the service
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { RATINGS: 'ratings' } }));
vi.mock('../config/converters', () => ({ ratingConverter: {} }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) }),
  doc: vi.fn().mockReturnValue({}),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

import { upsertRating, upsertCriteriaRating, fetchUserRatings, fetchRatingsByBusinessIds } from './ratings';

describe('upsertRating — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDoc.mockResolvedValue({ exists: () => false });
  });

  it('throws on score 0', async () => {
    await expect(upsertRating('u1', 'b1', 0)).rejects.toThrow('Score must be an integer between 1 and 5');
  });

  it('throws on score 6', async () => {
    await expect(upsertRating('u1', 'b1', 6)).rejects.toThrow('Score must be an integer between 1 and 5');
  });

  it('throws on fractional score', async () => {
    await expect(upsertRating('u1', 'b1', 3.5)).rejects.toThrow('Score must be an integer between 1 and 5');
  });

  it('throws on negative score', async () => {
    await expect(upsertRating('u1', 'b1', -1)).rejects.toThrow('Score must be an integer between 1 and 5');
  });

  it('accepts valid score 1', async () => {
    await expect(upsertRating('u1', 'b1', 1)).resolves.not.toThrow();
    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('accepts valid score 5', async () => {
    await expect(upsertRating('u1', 'b1', 5)).resolves.not.toThrow();
  });

  it('creates new rating when none exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await upsertRating('u1', 'b1', 4);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'u1', businessId: 'b1', score: 4 }),
    );
  });

  it('updates existing rating', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true });
    await upsertRating('u1', 'b1', 3);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ score: 3 }),
    );
  });
});

describe('upsertCriteriaRating — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws on criterion score of 0', async () => {
    await expect(upsertCriteriaRating('u1', 'b1', { food: 0 })).rejects.toThrow('Criteria scores must be integers between 1 and 5');
  });

  it('throws on criterion score of 6', async () => {
    await expect(upsertCriteriaRating('u1', 'b1', { service: 6 })).rejects.toThrow('Criteria scores must be integers between 1 and 5');
  });

  it('throws on fractional criterion score', async () => {
    await expect(upsertCriteriaRating('u1', 'b1', { price: 2.5 })).rejects.toThrow('Criteria scores must be integers between 1 and 5');
  });

  it('throws when no global rating exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await expect(upsertCriteriaRating('u1', 'b1', { food: 4 })).rejects.toThrow(
      'Calificá con estrellas antes de agregar detalle por criterio',
    );
  });

  it('merges criteria with existing criteria', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ criteria: { food: 3, service: 4 } }),
    });
    await upsertCriteriaRating('u1', 'b1', { food: 5, ambiance: 4 });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        criteria: { food: 5, service: 4, ambiance: 4 },
      }),
    );
  });

  it('works when no previous criteria exist', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({}),
    });
    await upsertCriteriaRating('u1', 'b1', { speed: 3 });
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        criteria: { speed: 3 },
      }),
    );
  });
});

describe('fetchUserRatings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ratings for the user', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ userId: 'u1', businessId: 'b1', score: 4, createdAt: new Date(), updatedAt: new Date() }) },
      ],
    });
    const result = await fetchUserRatings('u1');
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(4);
  });

  it('returns empty array when no ratings', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const result = await fetchUserRatings('u1');
    expect(result).toEqual([]);
  });

  it('propagates errors', async () => {
    mockGetDocs.mockRejectedValue(new Error('network'));
    await expect(fetchUserRatings('u1')).rejects.toThrow('network');
  });
});

describe('fetchRatingsByBusinessIds', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ratings for given business IDs', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ userId: 'u1', businessId: 'b1', score: 3, createdAt: new Date(), updatedAt: new Date() }) },
        { data: () => ({ userId: 'u2', businessId: 'b1', score: 5, createdAt: new Date(), updatedAt: new Date() }) },
      ],
    });
    const result = await fetchRatingsByBusinessIds(['b1']);
    expect(result).toHaveLength(2);
  });

  it('returns empty for empty input', async () => {
    const result = await fetchRatingsByBusinessIds([]);
    expect(result).toEqual([]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('batches queries for >10 IDs', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    const ids = Array.from({ length: 15 }, (_, i) => `b${i}`);
    await fetchRatingsByBusinessIds(ids);
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });

  it('consolidates results from multiple batches', async () => {
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [{ data: () => ({ userId: 'u1', businessId: 'b0', score: 3, createdAt: new Date(), updatedAt: new Date() }) }],
      })
      .mockResolvedValueOnce({
        docs: [{ data: () => ({ userId: 'u1', businessId: 'b11', score: 4, createdAt: new Date(), updatedAt: new Date() }) }],
      });
    const ids = Array.from({ length: 12 }, (_, i) => `b${i}`);
    const result = await fetchRatingsByBusinessIds(ids);
    expect(result).toHaveLength(2);
  });
});
