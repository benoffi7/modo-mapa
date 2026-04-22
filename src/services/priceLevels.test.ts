import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { PRICE_LEVELS: 'priceLevels' } }));
vi.mock('../config/converters', () => ({ priceLevelConverter: {} }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) }),
  doc: vi.fn().mockReturnValue({}),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
  query: vi.fn(),
  limit: vi.fn(),
}));

import { upsertPriceLevel, deletePriceLevel, fetchPriceLevelMap } from './priceLevels';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';

describe('upsertPriceLevel — validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws on level 0', async () => {
    await expect(upsertPriceLevel('u1', 'b1', 0)).rejects.toThrow('Level must be 1, 2, or 3');
  });

  it('throws on level 4', async () => {
    await expect(upsertPriceLevel('u1', 'b1', 4)).rejects.toThrow('Level must be 1, 2, or 3');
  });

  it('throws on fractional level', async () => {
    await expect(upsertPriceLevel('u1', 'b1', 1.5)).rejects.toThrow('Level must be 1, 2, or 3');
  });

  it('throws on negative level', async () => {
    await expect(upsertPriceLevel('u1', 'b1', -1)).rejects.toThrow('Level must be 1, 2, or 3');
  });
});

describe('upsertPriceLevel — create vs update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates new doc when none exists', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await upsertPriceLevel('u1', 'b1', 2);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'u1', businessId: 'b1', level: 2 }),
    );
  });

  it('updates existing doc', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true });
    await upsertPriceLevel('u1', 'b1', 3);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ level: 3 }),
    );
  });

  it('invalidates cache and tracks event', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    await upsertPriceLevel('u1', 'b1', 1);
    expect(invalidateQueryCache).toHaveBeenCalledWith('priceLevels', 'u1');
    expect(trackEvent).toHaveBeenCalledWith('price_level_vote', { business_id: 'b1', level: 1 });
  });
});

describe('deletePriceLevel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the document and invalidates cache', async () => {
    await deletePriceLevel('u1', 'b1');
    expect(mockDeleteDoc).toHaveBeenCalled();
    expect(invalidateQueryCache).toHaveBeenCalledWith('priceLevels', 'u1');
  });
});

describe('fetchPriceLevelMap', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty map when no docs', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const result = await fetchPriceLevelMap();
    expect(result.size).toBe(0);
  });

  it('averages multiple price levels per business', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ businessId: 'biz1', level: 1 }) },
        { data: () => ({ businessId: 'biz1', level: 3 }) },
        { data: () => ({ businessId: 'biz2', level: 2 }) },
      ],
    });
    const result = await fetchPriceLevelMap();
    expect(result.get('biz1')).toBe(2); // (1+3)/2 = 2
    expect(result.get('biz2')).toBe(2);
  });

  it('rounds average to nearest integer', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ businessId: 'biz1', level: 1 }) },
        { data: () => ({ businessId: 'biz1', level: 2 }) },
        { data: () => ({ businessId: 'biz1', level: 2 }) },
      ],
    });
    const result = await fetchPriceLevelMap();
    expect(result.get('biz1')).toBe(2); // (1+2+2)/3 = 1.67 → rounds to 2
  });

  it('handles single doc per business correctly', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ data: () => ({ businessId: 'biz1', level: 3 }) }],
    });
    const result = await fetchPriceLevelMap();
    expect(result.get('biz1')).toBe(3);
  });

  it('uses ?? [] for missing businessId entry (new business)', async () => {
    // Two different businesses, each with one entry
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ businessId: 'bizA', level: 1 }) },
        { data: () => ({ businessId: 'bizB', level: 2 }) },
      ],
    });
    const result = await fetchPriceLevelMap();
    expect(result.get('bizA')).toBe(1);
    expect(result.get('bizB')).toBe(2);
  });
});
