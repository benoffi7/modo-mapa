import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  handlers,
  mockGetFirestore,
  mockIncrement,
  mockCheckRateLimit,
  mockIncrementCounter,
  mockTrackWrite,
  mockTrackDelete,
  mockCreateNotification,
  mockLogAbuse,
} = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: unknown) => Promise<void>>,
  mockGetFirestore: vi.fn(),
  mockIncrement: vi.fn().mockReturnValue({ __increment: true }),
  mockCheckRateLimit: vi.fn().mockResolvedValue(false),
  mockIncrementCounter: vi.fn().mockResolvedValue(undefined),
  mockTrackWrite: vi.fn().mockResolvedValue(undefined),
  mockTrackDelete: vi.fn().mockResolvedValue(undefined),
  mockCreateNotification: vi.fn().mockResolvedValue(undefined),
  mockLogAbuse: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: mockGetFirestore,
  FieldValue: {
    increment: (n: number) => mockIncrement(n),
    serverTimestamp: vi.fn(),
  },
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

vi.mock('../../utils/rateLimiter', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));
vi.mock('../../utils/counters', () => ({
  incrementCounter: (...args: unknown[]) => mockIncrementCounter(...args),
  trackWrite: (...args: unknown[]) => mockTrackWrite(...args),
  trackDelete: (...args: unknown[]) => mockTrackDelete(...args),
}));
vi.mock('../../utils/notifications', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));
vi.mock('../../utils/abuseLogger', () => ({
  logAbuse: (...args: unknown[]) => mockLogAbuse(...args),
}));

function createMockDb(overrides?: {
  followingCount?: number;
  followersCount?: number;
  followCount?: number;
  profilePublic?: boolean | undefined;
  settingsExists?: boolean;
  followerName?: string;
}) {
  const followCount = overrides?.followCount ?? 5;
  const profilePublic = overrides?.profilePublic;
  const settingsExists = overrides?.settingsExists ?? false;
  const followerName = overrides?.followerName ?? 'TestFollower';
  const followingCount = overrides?.followingCount ?? 3;
  const followersCount = overrides?.followersCount ?? 2;

  const mockUpdate = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockResolvedValue(undefined);

  const mockCountGet = vi.fn().mockResolvedValue({
    data: () => ({ count: followCount }),
  });
  const mockCount = vi.fn().mockReturnValue({ get: mockCountGet });
  const mockLimitGet = vi.fn().mockResolvedValue({ empty: true });
  const mockLimit = vi.fn().mockReturnValue({ get: mockLimitGet });
  const mockWhereObj: Record<string, unknown> = { count: mockCount, limit: mockLimit };
  const mockWhere = vi.fn().mockReturnValue(mockWhereObj);
  mockWhereObj.where = mockWhere; // self-referencing for chained .where() calls
  const mockCollection = vi.fn().mockReturnValue({ where: mockWhere });

  const mockDocFn = vi.fn().mockImplementation((path: string) => {
    if (path.startsWith('userSettings/')) {
      return {
        get: vi.fn().mockResolvedValue({
          exists: settingsExists,
          data: () => (settingsExists ? { profilePublic } : undefined),
        }),
      };
    }
    if (path.startsWith('users/') && path.includes('follower')) {
      return {
        update: mockUpdate,
        set: mockSet,
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ displayName: followerName, followingCount }),
        }),
      };
    }
    // Default user (followed)
    return {
      update: mockUpdate,
      set: mockSet,
      get: vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({ displayName: 'FollowedUser', followersCount }),
      }),
    };
  });

  const db = {
    doc: mockDocFn,
    collection: mockCollection,
  };
  mockGetFirestore.mockReturnValue(db);
  return { db, mockUpdate, mockSet, mockDocFn };
}

import '../../triggers/follows';

describe('onFollowCreated', () => {
  const onCreated = () => handlers['created:follows/{docId}'];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(false);
  });

  it('skips if no snapshot data', async () => {
    await onCreated()({ data: null });
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it('deletes and logs abuse when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValue(true);
    createMockDb();
    const snapRef = { delete: vi.fn().mockResolvedValue(undefined) };

    await onCreated()({
      data: {
        data: () => ({ followerId: 'u1', followedId: 'u2' }),
        ref: snapRef,
      },
    });

    expect(snapRef.delete).toHaveBeenCalled();
    expect(mockLogAbuse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'u1',
        type: 'rate_limit',
        collection: 'follows',
      }),
    );
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('deletes follow when max follows exceeded (200)', async () => {
    createMockDb({ followCount: 201 });
    const snapRef = { delete: vi.fn().mockResolvedValue(undefined) };

    await onCreated()({
      data: {
        data: () => ({ followerId: 'u1', followedId: 'u2' }),
        ref: snapRef,
      },
    });

    expect(snapRef.delete).toHaveBeenCalled();
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('deletes follow when followed user profile is private', async () => {
    createMockDb({ settingsExists: true, profilePublic: false, followCount: 5 });
    const snapRef = { delete: vi.fn().mockResolvedValue(undefined) };

    await onCreated()({
      data: {
        data: () => ({ followerId: 'u1', followedId: 'u2' }),
        ref: snapRef,
      },
    });

    expect(snapRef.delete).toHaveBeenCalled();
  });

  it('allows follow when profile is public', async () => {
    createMockDb({ settingsExists: true, profilePublic: true, followCount: 5 });
    const snapRef = { delete: vi.fn() };

    await onCreated()({
      data: {
        data: () => ({ followerId: 'u1', followedId: 'u2' }),
        ref: snapRef,
      },
    });

    expect(snapRef.delete).not.toHaveBeenCalled();
    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'follows', 1);
  });

  it('allows follow when no settings doc exists (default public)', async () => {
    createMockDb({ settingsExists: false, followCount: 5 });
    const snapRef = { delete: vi.fn() };

    await onCreated()({
      data: {
        data: () => ({ followerId: 'u1', followedId: 'u2' }),
        ref: snapRef,
      },
    });

    expect(snapRef.delete).not.toHaveBeenCalled();
    expect(mockIncrementCounter).toHaveBeenCalled();
  });

  it('increments counters and creates notification on success', async () => {
    createMockDb({ followCount: 5, followerName: 'Maria' });
    const snapRef = { delete: vi.fn() };

    await onCreated()({
      data: {
        data: () => ({ followerId: 'follower1', followedId: 'followed1' }),
        ref: snapRef,
      },
    });

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'follows', 1);
    expect(mockTrackWrite).toHaveBeenCalledWith(expect.anything(), 'follows');
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: 'followed1',
        type: 'new_follower',
        actorId: 'follower1',
      }),
    );
  });

  it('passes correct rate limit config', async () => {
    createMockDb({ followCount: 5 });
    const snapRef = { delete: vi.fn() };

    await onCreated()({
      data: {
        data: () => ({ followerId: 'u1', followedId: 'u2' }),
        ref: snapRef,
      },
    });

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      { collection: 'follows', limit: 50, windowType: 'daily' },
      'u1',
    );
  });
});

describe('onFollowDeleted', () => {
  const onDeleted = () => handlers['deleted:follows/{docId}'];

  beforeEach(() => vi.clearAllMocks());

  it('skips if no snapshot data', async () => {
    await onDeleted()({ data: null });
    expect(mockIncrementCounter).not.toHaveBeenCalled();
  });

  it('decrements counters on delete', async () => {
    createMockDb({ followingCount: 5, followersCount: 3 });

    await onDeleted()({
      data: { data: () => ({ followerId: 'u1', followedId: 'u2' }) },
    });

    expect(mockIncrementCounter).toHaveBeenCalledWith(expect.anything(), 'follows', -1);
    expect(mockTrackDelete).toHaveBeenCalledWith(expect.anything(), 'follows');
  });

  it('does NOT decrement followingCount when already at 0', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const db = {
      doc: vi.fn().mockImplementation((path: string) => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () =>
            path.includes('u1')
              ? { followingCount: 0 }
              : { followersCount: 5 },
        }),
        update: mockUpdate,
      })),
    };
    mockGetFirestore.mockReturnValue(db);

    await onDeleted()({
      data: { data: () => ({ followerId: 'u1', followedId: 'u2' }) },
    });

    // The first call (for u1) should NOT happen since followingCount is 0
    // The second call (for u2) should happen
    // We check that update was called exactly once (for followersCount decrement)
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
