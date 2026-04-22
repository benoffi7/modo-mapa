import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('../../config/collections', () => ({
  COLLECTIONS: {
    USERS: 'users',
    COMMENTS: 'comments',
    RATINGS: 'ratings',
    FAVORITES: 'favorites',
    CUSTOM_TAGS: 'customTags',
    MENU_PHOTOS: 'menuPhotos',
  },
}));
vi.mock('../../config/converters', () => ({
  userProfileConverter: {},
  commentConverter: {},
  ratingConverter: {},
  favoriteConverter: {},
  customTagConverter: {},
  menuPhotoConverter: {},
}));

const mockGetDoc = vi.fn();
const mockMeasuredGetDoc = vi.fn((_name: string, ref: unknown) => mockGetDoc(ref));
const mockMeasuredGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDoc = vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) });

vi.mock('../../utils/perfMetrics', () => ({
  measuredGetDoc: (name: string, ref: unknown) => mockMeasuredGetDoc(name, ref),
  measuredGetDocs: (name: string, q: unknown) => mockMeasuredGetDocs(name, q),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) }),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: vi.fn(),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

// Mock dependencies used by fetchUserProfile (not under test here, but imported at module level)
vi.mock('../../utils/businessHelpers', () => ({ getBusinessName: vi.fn() }));

const mockFetchLatestRanking = vi.fn();
vi.mock('../rankings', () => ({ fetchLatestRanking: (...args: unknown[]) => mockFetchLatestRanking(...args) }));
vi.mock('../../utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() } }));

describe('fetchUserProfileDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns UserProfile when doc exists', async () => {
    const profileData = { displayName: 'Test', avatarId: 'av1', createdAt: new Date() };
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => profileData });

    const { fetchUserProfileDoc } = await import('../userProfile');
    const result = await fetchUserProfileDoc('uid-123');

    expect(result).toEqual(profileData);
    expect(mockDoc).toHaveBeenCalledWith({}, 'users', 'uid-123');
  });

  it('returns null when doc does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    const { fetchUserProfileDoc } = await import('../userProfile');
    const result = await fetchUserProfileDoc('uid-missing');

    expect(result).toBeNull();
  });

  it('propagates errors', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('Firestore error'));

    const { fetchUserProfileDoc } = await import('../userProfile');
    await expect(fetchUserProfileDoc('uid-err')).rejects.toThrow('Firestore error');
  });
});

describe('updateUserDisplayName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue({});
  });

  it('calls updateDoc when doc exists', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true });
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    const { updateUserDisplayName } = await import('../userProfile');
    await updateUserDisplayName('uid-1', 'NewName');

    expect(mockUpdateDoc).toHaveBeenCalledWith({}, {
      displayName: 'NewName',
      displayNameLower: 'newname',
    });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('calls setDoc when doc does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    mockSetDoc.mockResolvedValueOnce(undefined);

    const { updateUserDisplayName } = await import('../userProfile');
    await updateUserDisplayName('uid-2', 'NewUser');

    expect(mockSetDoc).toHaveBeenCalledWith({}, {
      displayName: 'NewUser',
      displayNameLower: 'newuser',
      createdAt: 'SERVER_TIMESTAMP',
    });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('propagates errors', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('read failed'));

    const { updateUserDisplayName } = await import('../userProfile');
    await expect(updateUserDisplayName('uid-err', 'Name')).rejects.toThrow('read failed');
  });
});

describe('updateUserAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue({});
  });

  it('calls updateDoc with avatarId', async () => {
    mockUpdateDoc.mockResolvedValueOnce(undefined);

    const { updateUserAvatar } = await import('../userProfile');
    await updateUserAvatar('uid-1', 'avatar-fox');

    expect(mockUpdateDoc).toHaveBeenCalledWith({}, { avatarId: 'avatar-fox' });
  });

  it('propagates errors', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('update failed'));

    const { updateUserAvatar } = await import('../userProfile');
    await expect(updateUserAvatar('uid-err', 'av1')).rejects.toThrow('update failed');
  });
});

describe('fetchUserProfile', () => {
  function emptySnap(size = 0) {
    return { docs: [], size, empty: size === 0 };
  }

  function makeCommentDoc(overrides: Record<string, unknown> = {}) {
    return {
      data: () => ({
        id: 'c1',
        businessId: 'biz1',
        text: 'hello',
        likeCount: 0,
        createdAt: new Date(),
        flagged: false,
        ...overrides,
      }),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockMeasuredGetDocs.mockResolvedValue(emptySnap());
    mockMeasuredGetDoc.mockImplementation(() =>
      Promise.resolve({ exists: () => false, data: () => null }),
    );
    mockFetchLatestRanking.mockResolvedValue(null);
  });

  it('returns Anónimo as displayName when no user doc and no fallbackName', async () => {
    const { fetchUserProfile } = await import('../userProfile');
    const result = await fetchUserProfile('uid-1');
    expect(result.displayName).toBe('Anónimo');
  });

  it('uses fallbackName when user doc does not exist', async () => {
    const { fetchUserProfile } = await import('../userProfile');
    const result = await fetchUserProfile('uid-1', 'Guest');
    expect(result.displayName).toBe('Guest');
  });

  it('uses displayName from user doc when it exists', async () => {
    mockMeasuredGetDoc.mockImplementation(() =>
      Promise.resolve({ exists: () => true, data: () => ({ displayName: 'Alice', createdAt: new Date() }) }),
    );
    const { fetchUserProfile } = await import('../userProfile');
    const result = await fetchUserProfile('uid-1');
    expect(result.displayName).toBe('Alice');
  });

  it('returns rankingPosition null when monthlyRanking is null', async () => {
    const { fetchUserProfile } = await import('../userProfile');
    const result = await fetchUserProfile('uid-1');
    expect(result.rankingPosition).toBeNull();
  });

  it('returns rankingPosition null when userId not in ranking', async () => {
    mockFetchLatestRanking.mockResolvedValue({ rankings: [{ userId: 'other', score: 10 }] });
    const { fetchUserProfile } = await import('../userProfile');
    const result = await fetchUserProfile('uid-1');
    expect(result.rankingPosition).toBeNull();
  });

  it('returns correct rankingPosition when userId is found in ranking', async () => {
    mockFetchLatestRanking.mockResolvedValue({
      rankings: [{ userId: 'other', score: 20 }, { userId: 'uid-1', score: 10 }],
    });
    const { fetchUserProfile } = await import('../userProfile');
    const result = await fetchUserProfile('uid-1');
    expect(result.rankingPosition).toBe(2);
  });

  it('sums likeCount across comments', async () => {
    mockMeasuredGetDocs.mockImplementation((name: string) => {
      if (name === 'userProfile_comments') {
        return Promise.resolve({
          docs: [makeCommentDoc({ likeCount: 3 }), makeCommentDoc({ likeCount: 7 })],
          size: 2,
        });
      }
      return Promise.resolve(emptySnap());
    });
    const { fetchUserProfile } = await import('../userProfile');
    const result = await fetchUserProfile('uid-1');
    expect(result.stats.likesReceived).toBe(10);
  });

  it('gracefully handles measuredGetDoc rejection (catches error, returns null user)', async () => {
    mockMeasuredGetDoc.mockImplementation(() =>
      Promise.reject(new Error('permission denied')),
    );
    const { fetchUserProfile } = await import('../userProfile');
    const result = await fetchUserProfile('uid-err', 'Fallback');
    expect(result.displayName).toBe('Fallback');
  });

  it('gracefully handles fetchLatestRanking rejection', async () => {
    mockFetchLatestRanking.mockRejectedValue(new Error('rank error'));
    const { fetchUserProfile } = await import('../userProfile');
    const result = await fetchUserProfile('uid-1');
    expect(result.rankingPosition).toBeNull();
  });
});

describe('measureAsync instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) });
  });

  it('fetchUserProfileDoc uses measuredGetDoc with userProfile_doc', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    const { fetchUserProfileDoc } = await import('../userProfile');
    await fetchUserProfileDoc('uid-1');
    expect(mockMeasuredGetDoc.mock.calls.map((c) => c[0])).toContain('userProfile_doc');
  });

  it('updateUserDisplayName uses measuredGetDoc with userProfile_existsCheck', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true });
    mockUpdateDoc.mockResolvedValueOnce(undefined);
    const { updateUserDisplayName } = await import('../userProfile');
    await updateUserDisplayName('uid-1', 'NewName');
    expect(mockMeasuredGetDoc.mock.calls.map((c) => c[0])).toContain('userProfile_existsCheck');
  });
});
