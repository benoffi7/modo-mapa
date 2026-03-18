import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { FAVORITES: 'favorites' } }));
vi.mock('../config/converters', () => ({ favoriteConverter: {} }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn().mockReturnValue({}),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

import { addFavorite, removeFavorite } from './favorites';
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
