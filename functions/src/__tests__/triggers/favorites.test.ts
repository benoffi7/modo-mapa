import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockGetFirestore,
  mockIncrementCounter,
  mockTrackWrite,
  mockTrackDelete,
  mockIncrementBusinessCount,
  mockFanOutToFollowers,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: unknown) => Promise<void>>,
  mockGetFirestore: vi.fn(),
  mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
  mockTrackWrite: vi.fn().mockResolvedValue(undefined),
  mockTrackDelete: vi.fn().mockResolvedValue(undefined),
  mockIncrementBusinessCount: vi.fn().mockResolvedValue(undefined),
  mockFanOutToFollowers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`created:${path}`] = handler;
    return handler;
  },
  onDocumentDeleted: (path: string, handler: (event: unknown) => Promise<void>) => {
    handlers[`deleted:${path}`] = handler;
    return handler;
  },
}));

vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: unknown[]) => mockIncrementCounter(...args),
  trackWrite: (...args: unknown[]) => mockTrackWrite(...args),
  trackDelete: (...args: unknown[]) => mockTrackDelete(...args),
}));

vi.mock('../../utils/aggregates', () => ({
  incrementBusinessCount: (...args: unknown[]) => mockIncrementBusinessCount(...args),
}));

vi.mock('../../utils/fanOut', () => ({
  fanOutToFollowers: (...args: unknown[]) => mockFanOutToFollowers(...args),
}));

function createMockDb(overrides?: {
  userName?: string;
  businessName?: string;
}) {
  const mockDocGet = vi.fn().mockImplementation((path: string) => {
    if (path.startsWith('users/')) {
      return Promise.resolve({
        exists: true,
        data: () => ({ displayName: overrides?.userName ?? 'TestUser' }),
      });
    }
    if (path.startsWith('businesses/')) {
      return Promise.resolve({
        exists: true,
        data: () => ({ name: overrides?.businessName ?? 'TestBiz' }),
      });
    }
    return Promise.resolve({ exists: false, data: () => null });
  });

  const db = {
    doc: vi.fn().mockImplementation((path: string) => ({
      get: () => mockDocGet(path),
    })),
  };
  mockGetFirestore.mockReturnValue(db);
  return { db };
}

import '../../triggers/favorites';

describe('onFavoriteCreated', () => {
  const onCreated = () => handlers['created:favorites/{favoriteId}'];

  beforeEach(() => vi.clearAllMocks());

  it('increments counter and tracks write', async () => {
    createMockDb();
    await onCreated()({
      params: { favoriteId: 'fav1' },
      data: { data: () => ({ businessId: 'biz1', userId: 'u1' }) },
    });

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'favorites', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'favorites');
  });

  it('increments business count when businessId present', async () => {
    createMockDb();
    await onCreated()({
      params: { favoriteId: 'fav1' },
      data: { data: () => ({ businessId: 'biz1', userId: 'u1' }) },
    });

    expect(mockIncrementBusinessCount).toHaveBeenCalledWith(
      expect.anything(),
      'businessFavorites',
      'biz1',
      1,
    );
  });

  it('does NOT increment business count when businessId is missing', async () => {
    createMockDb();
    await onCreated()({
      params: { favoriteId: 'fav1' },
      data: { data: () => ({ userId: 'u1' }) },
    });

    expect(mockIncrementBusinessCount).not.toHaveBeenCalled();
  });

  it('fans out to followers when userId and businessId present', async () => {
    createMockDb({ userName: 'Gonzalo', businessName: 'Cafe Mapa' });
    await onCreated()({
      params: { favoriteId: 'fav1' },
      data: { data: () => ({ businessId: 'biz1', userId: 'u1' }) },
    });

    expect(mockFanOutToFollowers).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'u1',
        actorName: 'Gonzalo',
        type: 'favorite',
        businessId: 'biz1',
        businessName: 'Cafe Mapa',
        referenceId: 'fav1',
      }),
    );
  });

  it('does NOT fan out when userId is missing', async () => {
    createMockDb();
    await onCreated()({
      params: { favoriteId: 'fav1' },
      data: { data: () => ({ businessId: 'biz1' }) },
    });

    expect(mockFanOutToFollowers).not.toHaveBeenCalled();
  });

  it('uses "Alguien" when user doc does not exist', async () => {
    const mockDocGet = vi.fn().mockResolvedValue({ exists: false, data: () => null });
    const db = {
      doc: vi.fn().mockReturnValue({ get: mockDocGet }),
    };
    mockGetFirestore.mockReturnValue(db);

    await onCreated()({
      params: { favoriteId: 'fav1' },
      data: { data: () => ({ businessId: 'biz1', userId: 'u1' }) },
    });

    expect(mockFanOutToFollowers).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ actorName: 'Alguien' }),
    );
  });

  it('handles missing snapshot data gracefully', async () => {
    createMockDb();
    await onCreated()({
      params: { favoriteId: 'fav1' },
      data: { data: () => undefined },
    });

    // Should still call incrementCounter (businessId will be undefined)
    expect(mockIncrementCounter).toHaveBeenCalled();
  });
});

describe('onFavoriteDeleted', () => {
  const onDeleted = () => handlers['deleted:favorites/{favoriteId}'];

  beforeEach(() => vi.clearAllMocks());

  it('decrements counter and tracks delete', async () => {
    createMockDb();
    await onDeleted()({
      data: { data: () => ({ businessId: 'biz1' }) },
    });

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'favorites', -1);
    expect(mockTrackDelete).toHaveBeenCalledWith(expect.anything(), 'favorites');
  });

  it('decrements business count when businessId present', async () => {
    createMockDb();
    await onDeleted()({
      data: { data: () => ({ businessId: 'biz1' }) },
    });

    expect(mockIncrementBusinessCount).toHaveBeenCalledWith(
      expect.anything(),
      'businessFavorites',
      'biz1',
      -1,
    );
  });

  it('does NOT decrement business count when businessId is missing', async () => {
    createMockDb();
    await onDeleted()({
      data: { data: () => ({}) },
    });

    expect(mockIncrementBusinessCount).not.toHaveBeenCalled();
  });
});
