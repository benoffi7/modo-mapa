import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { FAVORITES: 'favorites' } }));
vi.mock('../config/converters', () => ({ favoriteConverter: {} }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn().mockReturnValue({}),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

import { addFavorite, removeFavorite, addFavoritesBatch } from './favorites';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';

describe('addFavorite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when userId is empty', async () => {
    await expect(addFavorite('', 'b1')).rejects.toThrow('userId and businessId are required');
  });

  it('throws when businessId is empty', async () => {
    await expect(addFavorite('u1', '')).rejects.toThrow('userId and businessId are required');
  });

  it('writes to Firestore with correct data', async () => {
    await addFavorite('u1', 'b1');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: 'u1', businessId: 'b1', createdAt: 'SERVER_TIMESTAMP' }),
    );
  });

  it('invalidates cache after write', async () => {
    await addFavorite('u1', 'b1');
    expect(invalidateQueryCache).toHaveBeenCalledWith('favorites', 'u1');
  });

  it('tracks analytics event', async () => {
    await addFavorite('u1', 'b1');
    expect(trackEvent).toHaveBeenCalledWith('favorite_toggle', { business_id: 'b1', action: 'add' });
  });
});

describe('removeFavorite', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the document', async () => {
    await removeFavorite('u1', 'b1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('invalidates cache and tracks event', async () => {
    await removeFavorite('u1', 'b1');
    expect(invalidateQueryCache).toHaveBeenCalledWith('favorites', 'u1');
    expect(trackEvent).toHaveBeenCalledWith('favorite_toggle', { business_id: 'b1', action: 'remove' });
  });
});

describe('addFavoritesBatch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 0 for empty businessIds', async () => {
    const result = await addFavoritesBatch('u1', []);
    expect(result).toBe(0);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('returns 0 for empty userId', async () => {
    const result = await addFavoritesBatch('', ['b1']);
    expect(result).toBe(0);
  });

  it('skips existing favorites and adds only new ones', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ businessId: 'b1' }) },
        { data: () => ({ businessId: 'b2' }) },
      ],
    });

    const result = await addFavoritesBatch('u1', ['b1', 'b2', 'b3', 'b4']);
    expect(result).toBe(2); // b3 and b4 are new
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });

  it('returns 0 when all are already favorites', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { data: () => ({ businessId: 'b1' }) },
        { data: () => ({ businessId: 'b2' }) },
      ],
    });

    const result = await addFavoritesBatch('u1', ['b1', 'b2']);
    expect(result).toBe(0);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('invalidates cache once when items are added', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    await addFavoritesBatch('u1', ['b1', 'b2']);
    expect(invalidateQueryCache).toHaveBeenCalledTimes(1);
    expect(invalidateQueryCache).toHaveBeenCalledWith('favorites', 'u1');
  });

  it('does not invalidate cache when nothing is added', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ data: () => ({ businessId: 'b1' }) }],
    });

    await addFavoritesBatch('u1', ['b1']);
    expect(invalidateQueryCache).not.toHaveBeenCalled();
  });

  it('tracks batch event with count', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });

    await addFavoritesBatch('u1', ['b1', 'b2', 'b3']);
    expect(trackEvent).toHaveBeenCalledWith('favorites_batch_add', { count: 3 });
  });
});
