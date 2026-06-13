import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({ COLLECTIONS: { FAVORITES: 'favorites' } }));
vi.mock('../config/converters', () => ({ favoriteConverter: {} }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('./offlineInterceptor', () => ({
  gateServiceWrite: vi.fn((_op, _meta, _opts, fn) => fn()),
}));

const mockGetCountOfflineSafe = vi.fn();
vi.mock('./getCountOfflineSafe', () => ({
  getCountOfflineSafe: (...args: unknown[]) => mockGetCountOfflineSafe(...args),
}));

const mockMeasureAsync = vi.fn((_name: string, fn: () => Promise<unknown>) => fn());
vi.mock('../utils/perfMetrics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/perfMetrics')>();
  return {
    ...actual,
    measureAsync: (...args: Parameters<typeof mockMeasureAsync>) => mockMeasureAsync(...args),
  };
});

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({}),
  doc: vi.fn().mockReturnValue({}),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

import { addFavorite, removeFavorite, fetchUserFavoritesCount } from './favorites';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';
import { QUERY_LABELS } from '../components/admin/perf/perfHelpers';

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

describe('fetchUserFavoritesCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the count from getCountOfflineSafe', async () => {
    mockGetCountOfflineSafe.mockResolvedValueOnce(12);
    const result = await fetchUserFavoritesCount('u1');
    expect(result).toBe(12);
  });

  it('invokes measureAsync with key favorites_count', async () => {
    mockGetCountOfflineSafe.mockResolvedValueOnce(5);
    await fetchUserFavoritesCount('u1');
    expect(mockMeasureAsync).toHaveBeenCalledWith('favorites_count', expect.any(Function));
  });

  it('returns 0 when offline (getCountOfflineSafe returns 0)', async () => {
    mockGetCountOfflineSafe.mockResolvedValueOnce(0);
    const result = await fetchUserFavoritesCount('u1');
    expect(result).toBe(0);
  });
});

describe('QUERY_LABELS smoke — favorites_count', () => {
  it('favorites_count has a non-empty label', () => {
    expect(QUERY_LABELS['favorites_count']).toBeTruthy();
  });
});
