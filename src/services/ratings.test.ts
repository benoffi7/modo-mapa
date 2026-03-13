import { describe, it, expect, vi } from 'vitest';

// Mock Firebase before importing the service
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { RATINGS: 'ratings' } }));
vi.mock('../config/converters', () => ({ ratingConverter: {} }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn().mockReturnValue({}),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

import { upsertRating, upsertCriteriaRating } from './ratings';

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
