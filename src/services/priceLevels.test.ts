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

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn().mockReturnValue({}),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

import { upsertPriceLevel, deletePriceLevel } from './priceLevels';
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
