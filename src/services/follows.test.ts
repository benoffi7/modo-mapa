import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { FOLLOWS: 'follows' },
}));
vi.mock('../config/converters', () => ({ followConverter: {} }));
vi.mock('./queryCache', () => ({ invalidateQueryCache: vi.fn() }));
vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));

const mockGetCountOfflineSafe = vi.fn();
vi.mock('./getCountOfflineSafe', () => ({
  getCountOfflineSafe: (...args: unknown[]) => mockGetCountOfflineSafe(...args),
}));
vi.mock('../constants/analyticsEvents', () => ({
  EVT_FOLLOW: 'follow',
  EVT_UNFOLLOW: 'unfollow',
}));

const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnValue({}) }),
  doc: vi.fn().mockReturnValue({}),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  serverTimestamp: vi.fn().mockReturnValue('SERVER_TIMESTAMP'),
}));

import {
  followUser, unfollowUser, isFollowing,
  fetchFollowing,
} from './follows';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';

describe('followUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when followerId is empty', async () => {
    await expect(followUser('', 'u2')).rejects.toThrow('followerId and followedId are required');
  });

  it('throws when followedId is empty', async () => {
    await expect(followUser('u1', '')).rejects.toThrow('followerId and followedId are required');
  });

  it('throws when trying to follow yourself', async () => {
    await expect(followUser('u1', 'u1')).rejects.toThrow('Cannot follow yourself');
  });

  it('throws when max follows limit is reached', async () => {
    mockGetCountOfflineSafe.mockResolvedValueOnce(200);
    await expect(followUser('u1', 'u2')).rejects.toThrow('Has alcanzado el limite de 200 usuarios seguidos');
  });

  it('writes follow document and invalidates cache', async () => {
    mockGetCountOfflineSafe.mockResolvedValueOnce(5);
    await followUser('u1', 'u2');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ followerId: 'u1', followedId: 'u2', createdAt: 'SERVER_TIMESTAMP' }),
    );
    expect(invalidateQueryCache).toHaveBeenCalledWith('follows', 'u1');
    expect(trackEvent).toHaveBeenCalledWith('follow', { followed_id: 'u2' });
  });
});

describe('unfollowUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when followerId is empty', async () => {
    await expect(unfollowUser('', 'u2')).rejects.toThrow('followerId and followedId are required');
  });

  it('throws when followedId is empty', async () => {
    await expect(unfollowUser('u1', '')).rejects.toThrow('followerId and followedId are required');
  });

  it('deletes document, invalidates cache, and tracks event', async () => {
    await unfollowUser('u1', 'u2');
    expect(mockDeleteDoc).toHaveBeenCalled();
    expect(invalidateQueryCache).toHaveBeenCalledWith('follows', 'u1');
    expect(trackEvent).toHaveBeenCalledWith('unfollow', { followed_id: 'u2' });
  });
});

describe('isFollowing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns false when followerId is empty', async () => {
    expect(await isFollowing('', 'u2')).toBe(false);
  });

  it('returns false when followedId is empty', async () => {
    expect(await isFollowing('u1', '')).toBe(false);
  });

  it('returns true when document exists', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true });
    expect(await isFollowing('u1', 'u2')).toBe(true);
  });

  it('returns false when document does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await isFollowing('u1', 'u2')).toBe(false);
  });
});

describe('fetchFollowing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns docs and hasMore=false when fewer results than pageSize', async () => {
    const fakeDocs = [{ id: '1' }, { id: '2' }];
    mockGetDocs.mockResolvedValueOnce({ docs: fakeDocs });

    const result = await fetchFollowing('u1', 5);
    expect(result.docs).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it('returns hasMore=true and trims when results exceed pageSize', async () => {
    const fakeDocs = [{ id: '1' }, { id: '2' }, { id: '3' }];
    mockGetDocs.mockResolvedValueOnce({ docs: fakeDocs });

    const result = await fetchFollowing('u1', 2);
    expect(result.docs).toHaveLength(2);
    expect(result.hasMore).toBe(true);
  });
});
