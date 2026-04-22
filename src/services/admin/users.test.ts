import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDocs = vi.fn();
const mockHttpsCallable = vi.fn();

vi.mock('../../config/firebase', () => ({ db: {}, functions: {} }));
vi.mock('../../config/collections', () => ({
  COLLECTIONS: {
    USERS: 'users', COMMENTS: 'comments', RATINGS: 'ratings', FAVORITES: 'favorites',
    USER_TAGS: 'userTags', CUSTOM_TAGS: 'customTags', FEEDBACK: 'feedback',
    COMMENT_LIKES: 'commentLikes', USER_SETTINGS: 'userSettings',
  },
}));
vi.mock('../../config/converters', () => ({
  commentConverter: {}, ratingConverter: {}, favoriteConverter: {},
  userTagConverter: {}, customTagConverter: {}, feedbackConverter: {},
  userProfileConverter: {}, userSettingsConverter: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn().mockReturnValue({ withConverter: vi.fn().mockReturnThis() }),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: vi.fn(() => 'query-ref'),
  limit: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

import { fetchUsersPanelData, fetchCommentStats, fetchAuthStats, fetchSettingsAggregates } from './users';

function emptySnap(size = 0) {
  return { docs: [], size };
}

describe('fetchUsersPanelData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all collections mapped with commentLikes having toDate() fallback', async () => {
    const ts = { toDate: () => new Date('2024-01-01') };
    const userDoc = { id: 'u1', data: () => ({ displayName: 'Alice' }) };
    const commentLikeDoc = { data: () => ({ userId: 'u1', commentId: 'c1', createdAt: ts }) };
    const commentLikeFallback = { data: () => ({ userId: undefined, commentId: undefined, createdAt: '2024-01-01' }) };

    mockGetDocs
      .mockResolvedValueOnce({ docs: [userDoc] }) // users
      .mockResolvedValueOnce(emptySnap()) // comments
      .mockResolvedValueOnce(emptySnap()) // ratings
      .mockResolvedValueOnce(emptySnap()) // favorites
      .mockResolvedValueOnce(emptySnap()) // userTags
      .mockResolvedValueOnce(emptySnap()) // customTags
      .mockResolvedValueOnce(emptySnap()) // feedback
      .mockResolvedValueOnce({ docs: [commentLikeDoc, commentLikeFallback] }); // commentLikes

    const result = await fetchUsersPanelData();
    expect(result.users).toHaveLength(1);
    expect(result.userIds).toEqual(['u1']);
    expect(result.commentLikes[0].userId).toBe('u1');
    expect(result.commentLikes[0].createdAt).toBeInstanceOf(Date);
    expect(result.commentLikes[1].userId).toBe('');
  });
});

describe('fetchCommentStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts edited and reply comments', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ updatedAt: new Date(), parentId: 'c0' }) }, // both edited and reply
        { data: () => ({ updatedAt: null, parentId: null }) }, // neither
        { data: () => ({ updatedAt: new Date(), parentId: null }) }, // only edited
      ],
      size: 3,
    });
    const result = await fetchCommentStats();
    expect(result.total).toBe(3);
    expect(result.edited).toBe(2);
    expect(result.replies).toBe(1);
  });
});

describe('fetchAuthStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls httpsCallable and returns data', async () => {
    const statsData = { totalUsers: 100, emailVerified: 80 };
    const mockFn = vi.fn().mockResolvedValue({ data: statsData });
    mockHttpsCallable.mockReturnValue(mockFn);

    const result = await fetchAuthStats();
    expect(result).toEqual(statsData);
  });
});

describe('fetchSettingsAggregates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts public profiles, notifications, and analytics', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ profilePublic: true, notificationsEnabled: true, analyticsEnabled: false }) },
        { data: () => ({ profilePublic: false, notificationsEnabled: true, analyticsEnabled: true }) },
        { data: () => ({ profilePublic: false, notificationsEnabled: false, analyticsEnabled: false }) },
      ],
      size: 3,
    });
    const result = await fetchSettingsAggregates();
    expect(result.totalSettings).toBe(3);
    expect(result.publicProfiles).toBe(1);
    expect(result.notificationsEnabled).toBe(2);
    expect(result.analyticsEnabled).toBe(1);
  });
});
