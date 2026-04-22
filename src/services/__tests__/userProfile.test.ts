import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('../../config/collections', () => ({ COLLECTIONS: { USERS: 'users' } }));
vi.mock('../../config/converters', () => ({ userProfileConverter: {} }));

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
  collection: vi.fn(),
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
vi.mock('../rankings', () => ({ fetchLatestRanking: vi.fn() }));
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
