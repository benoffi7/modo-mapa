import { describe, it, expect, vi } from 'vitest';

vi.mock('../utils/formatDate', () => ({
  toDate: vi.fn((v: unknown) => {
    if (v instanceof Date) return v;
    if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate: () => Date }).toDate();
    return new Date(0);
  }),
}));

import {
  userProfileConverter,
  ratingConverter,
  commentConverter,
  commentLikeConverter,
  userTagConverter,
  customTagConverter,
  feedbackConverter,
  favoriteConverter,
  menuPhotoConverter,
  priceLevelConverter,
  userRankingConverter,
  notificationConverter,
  userSettingsConverter,
  sharedListConverter,
  listItemConverter,
} from './converters';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockSnapshot(data: Record<string, unknown>, id = 'test-id'): any {
  return { data: () => data, id };
}

const NOW = new Date('2025-06-01T12:00:00Z');

// ---------------------------------------------------------------------------
// userProfileConverter
// ---------------------------------------------------------------------------
describe('userProfileConverter', () => {
  it('toFirestore serializes all fields', () => {
    const result = userProfileConverter.toFirestore({ displayName: 'Ana', createdAt: NOW });
    expect(result).toEqual({ displayName: 'Ana', createdAt: NOW });
  });

  it('fromFirestore deserializes a complete document', () => {
    const snap = mockSnapshot({ displayName: 'Ana', createdAt: NOW });
    const result = userProfileConverter.fromFirestore(snap);
    expect(result).toEqual({ displayName: 'Ana', createdAt: NOW });
  });
});

// ---------------------------------------------------------------------------
// ratingConverter
// ---------------------------------------------------------------------------
describe('ratingConverter', () => {
  const base = { userId: 'u1', businessId: 'b1', score: 4, createdAt: NOW, updatedAt: NOW };

  it('toFirestore serializes without optional criteria', () => {
    const result = ratingConverter.toFirestore(base);
    expect(result).toEqual(base);
    expect(result).not.toHaveProperty('criteria');
  });

  it('toFirestore includes criteria when present', () => {
    const criteria = { food: 5, service: 4 };
    const result = ratingConverter.toFirestore({ ...base, criteria });
    expect(result.criteria).toEqual(criteria);
  });

  it('fromFirestore deserializes complete document', () => {
    const snap = mockSnapshot({ ...base, criteria: { food: 5 } });
    const result = ratingConverter.fromFirestore(snap);
    expect(result.criteria).toEqual({ food: 5 });
  });

  it('fromFirestore omits criteria when missing', () => {
    const snap = mockSnapshot(base);
    const result = ratingConverter.fromFirestore(snap);
    expect(result).not.toHaveProperty('criteria');
  });
});

// ---------------------------------------------------------------------------
// commentConverter
// ---------------------------------------------------------------------------
describe('commentConverter', () => {
  const baseData = { userId: 'u1', userName: 'Gon', businessId: 'b1', text: 'Great', createdAt: NOW };

  it('toFirestore serializes required fields', () => {
    const comment = { id: 'c1', ...baseData, likeCount: 3 };
    const result = commentConverter.toFirestore(comment);
    expect(result).toEqual(baseData);
    expect(result).not.toHaveProperty('id');
  });

  it('fromFirestore deserializes with defaults for missing optional fields', () => {
    const snap = mockSnapshot(baseData, 'c1');
    const result = commentConverter.fromFirestore(snap);
    expect(result.id).toBe('c1');
    expect(result.likeCount).toBe(0);
    expect(result).not.toHaveProperty('updatedAt');
    expect(result).not.toHaveProperty('flagged');
    expect(result).not.toHaveProperty('parentId');
    expect(result).not.toHaveProperty('replyCount');
  });

  it('fromFirestore includes updatedAt when present', () => {
    const snap = mockSnapshot({ ...baseData, updatedAt: NOW });
    const result = commentConverter.fromFirestore(snap);
    expect(result.updatedAt).toEqual(NOW);
  });

  it('fromFirestore includes flagged only when true', () => {
    const snap = mockSnapshot({ ...baseData, flagged: true });
    expect(commentConverter.fromFirestore(snap).flagged).toBe(true);

    const snap2 = mockSnapshot({ ...baseData, flagged: false });
    expect(commentConverter.fromFirestore(snap2)).not.toHaveProperty('flagged');
  });

  it('fromFirestore includes parentId and replyCount when present', () => {
    const snap = mockSnapshot({ ...baseData, parentId: 'p1', replyCount: 5 });
    const result = commentConverter.fromFirestore(snap);
    expect(result.parentId).toBe('p1');
    expect(result.replyCount).toBe(5);
  });

  it('fromFirestore uses likeCount from document data', () => {
    const snap = mockSnapshot({ ...baseData, likeCount: 42 });
    expect(commentConverter.fromFirestore(snap).likeCount).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// commentLikeConverter
// ---------------------------------------------------------------------------
describe('commentLikeConverter', () => {
  it('round-trips correctly', () => {
    const like = { userId: 'u1', commentId: 'c1', createdAt: NOW };
    const result = commentLikeConverter.toFirestore(like);
    expect(result).toEqual(like);

    const snap = mockSnapshot(like);
    expect(commentLikeConverter.fromFirestore(snap)).toEqual(like);
  });
});

// ---------------------------------------------------------------------------
// userTagConverter
// ---------------------------------------------------------------------------
describe('userTagConverter', () => {
  it('round-trips correctly', () => {
    const tag = { userId: 'u1', businessId: 'b1', tagId: 't1', createdAt: NOW };
    expect(userTagConverter.toFirestore(tag)).toEqual(tag);
    expect(userTagConverter.fromFirestore(mockSnapshot(tag))).toEqual(tag);
  });
});

// ---------------------------------------------------------------------------
// customTagConverter
// ---------------------------------------------------------------------------
describe('customTagConverter', () => {
  it('toFirestore serializes without id', () => {
    const tag = { id: 'ct1', userId: 'u1', businessId: 'b1', label: 'Vegan', createdAt: NOW };
    const result = customTagConverter.toFirestore(tag);
    expect(result).not.toHaveProperty('id');
    expect(result.label).toBe('Vegan');
  });

  it('fromFirestore adds snapshot id', () => {
    const snap = mockSnapshot({ userId: 'u1', businessId: 'b1', label: 'Vegan', createdAt: NOW }, 'ct1');
    expect(customTagConverter.fromFirestore(snap).id).toBe('ct1');
  });
});

// ---------------------------------------------------------------------------
// feedbackConverter
// ---------------------------------------------------------------------------
describe('feedbackConverter', () => {
  const baseData = { userId: 'u1', message: 'Bug found', category: 'bug', status: 'pending', createdAt: NOW };

  it('toFirestore serializes required fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = feedbackConverter.toFirestore({ id: 'f1', ...baseData } as any);
    expect(result).toEqual(baseData);
    expect(result).not.toHaveProperty('id');
  });

  it('fromFirestore applies defaults for missing optional fields', () => {
    const snap = mockSnapshot({}, 'f1');
    const result = feedbackConverter.fromFirestore(snap);
    expect(result.id).toBe('f1');
    expect(result.message).toBe('');
    expect(result.category).toBe('otro');
    expect(result.status).toBe('pending');
    expect(result).not.toHaveProperty('flagged');
    expect(result).not.toHaveProperty('adminResponse');
    expect(result).not.toHaveProperty('viewedByUser');
    expect(result).not.toHaveProperty('mediaUrl');
    expect(result).not.toHaveProperty('mediaType');
    expect(result).not.toHaveProperty('githubIssueUrl');
    expect(result).not.toHaveProperty('businessId');
    expect(result).not.toHaveProperty('businessName');
  });

  it('fromFirestore includes flagged only when true', () => {
    const snap = mockSnapshot({ ...baseData, flagged: true }, 'f1');
    expect(feedbackConverter.fromFirestore(snap).flagged).toBe(true);

    const snap2 = mockSnapshot({ ...baseData, flagged: false }, 'f1');
    expect(feedbackConverter.fromFirestore(snap2)).not.toHaveProperty('flagged');
  });

  it('fromFirestore includes admin response fields when present', () => {
    const snap = mockSnapshot({
      ...baseData,
      adminResponse: 'Fixed',
      respondedAt: NOW,
      respondedBy: 'admin1',
    }, 'f1');
    const result = feedbackConverter.fromFirestore(snap);
    expect(result.adminResponse).toBe('Fixed');
    expect(result.respondedAt).toEqual(NOW);
    expect(result.respondedBy).toBe('admin1');
  });

  it('fromFirestore includes viewedByUser only when true', () => {
    const snap = mockSnapshot({ ...baseData, viewedByUser: true }, 'f1');
    expect(feedbackConverter.fromFirestore(snap).viewedByUser).toBe(true);

    const snap2 = mockSnapshot({ ...baseData, viewedByUser: false }, 'f1');
    expect(feedbackConverter.fromFirestore(snap2)).not.toHaveProperty('viewedByUser');
  });

  it('fromFirestore includes media and github fields when present', () => {
    const snap = mockSnapshot({
      ...baseData,
      mediaUrl: 'https://example.com/img.png',
      mediaType: 'image',
      githubIssueUrl: 'https://github.com/issue/1',
      businessId: 'b1',
      businessName: 'Cafe',
    }, 'f1');
    const result = feedbackConverter.fromFirestore(snap);
    expect(result.mediaUrl).toBe('https://example.com/img.png');
    expect(result.mediaType).toBe('image');
    expect(result.githubIssueUrl).toBe('https://github.com/issue/1');
    expect(result.businessId).toBe('b1');
    expect(result.businessName).toBe('Cafe');
  });
});

// ---------------------------------------------------------------------------
// favoriteConverter
// ---------------------------------------------------------------------------
describe('favoriteConverter', () => {
  it('round-trips correctly', () => {
    const fav = { userId: 'u1', businessId: 'b1', createdAt: NOW };
    expect(favoriteConverter.toFirestore(fav)).toEqual(fav);
    expect(favoriteConverter.fromFirestore(mockSnapshot(fav))).toEqual(fav);
  });
});

// ---------------------------------------------------------------------------
// menuPhotoConverter
// ---------------------------------------------------------------------------
describe('menuPhotoConverter', () => {
  const baseData = {
    userId: 'u1', businessId: 'b1', storagePath: '/photos/1.jpg',
    thumbnailPath: '/thumbs/1.jpg', status: 'approved', createdAt: NOW, reportCount: 2,
  };

  it('toFirestore serializes all required fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = menuPhotoConverter.toFirestore({ id: 'mp1', ...baseData } as any);
    expect(result).toEqual(baseData);
    expect(result).not.toHaveProperty('id');
  });

  it('fromFirestore applies defaults for missing optional fields', () => {
    const snap = mockSnapshot({}, 'mp1');
    const result = menuPhotoConverter.fromFirestore(snap);
    expect(result.id).toBe('mp1');
    expect(result.storagePath).toBe('');
    expect(result.thumbnailPath).toBe('');
    expect(result.status).toBe('pending');
    expect(result.reportCount).toBe(0);
    expect(result).not.toHaveProperty('rejectionReason');
    expect(result).not.toHaveProperty('reviewedBy');
    expect(result).not.toHaveProperty('reviewedAt');
  });

  it('fromFirestore includes review fields when present', () => {
    const snap = mockSnapshot({
      ...baseData,
      rejectionReason: 'Blurry',
      reviewedBy: 'admin1',
      reviewedAt: NOW,
    }, 'mp1');
    const result = menuPhotoConverter.fromFirestore(snap);
    expect(result.rejectionReason).toBe('Blurry');
    expect(result.reviewedBy).toBe('admin1');
    expect(result.reviewedAt).toEqual(NOW);
  });
});

// ---------------------------------------------------------------------------
// priceLevelConverter
// ---------------------------------------------------------------------------
describe('priceLevelConverter', () => {
  it('round-trips correctly', () => {
    const pl = { userId: 'u1', businessId: 'b1', level: 3, createdAt: NOW, updatedAt: NOW };
    expect(priceLevelConverter.toFirestore(pl)).toEqual(pl);
    expect(priceLevelConverter.fromFirestore(mockSnapshot(pl))).toEqual(pl);
  });
});

// ---------------------------------------------------------------------------
// userRankingConverter
// ---------------------------------------------------------------------------
describe('userRankingConverter', () => {
  const entry = {
    userId: 'u1', displayName: 'Ana', score: 100,
    breakdown: { comments: 10, ratings: 20, likes: 30, tags: 10, favorites: 15, photos: 15 },
  };

  it('toFirestore serializes all fields', () => {
    const ranking = { period: '2025-06', startDate: NOW, endDate: NOW, rankings: [entry], totalParticipants: 1 };
    const result = userRankingConverter.toFirestore(ranking);
    expect(result.period).toBe('2025-06');
    expect(result.rankings).toHaveLength(1);
  });

  it('fromFirestore applies defaults when rankings and totalParticipants are missing', () => {
    const snap = mockSnapshot({ period: '2025-06', startDate: NOW, endDate: NOW });
    const result = userRankingConverter.fromFirestore(snap);
    expect(result.rankings).toEqual([]);
    expect(result.totalParticipants).toBe(0);
  });

  it('fromFirestore deserializes complete document', () => {
    const snap = mockSnapshot({ period: '2025-06', startDate: NOW, endDate: NOW, rankings: [entry], totalParticipants: 5 });
    const result = userRankingConverter.fromFirestore(snap);
    expect(result.rankings).toHaveLength(1);
    expect(result.totalParticipants).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// notificationConverter
// ---------------------------------------------------------------------------
describe('notificationConverter', () => {
  const baseData = { userId: 'u1', type: 'like', message: 'You got a like', read: false, createdAt: NOW, expiresAt: NOW };

  it('toFirestore serializes required fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = notificationConverter.toFirestore({ id: 'n1', ...baseData } as any);
    expect(result).toEqual(baseData);
    expect(result).not.toHaveProperty('id');
  });

  it('fromFirestore applies defaults for missing optional fields', () => {
    const snap = mockSnapshot({ userId: 'u1', type: 'like' }, 'n1');
    const result = notificationConverter.fromFirestore(snap);
    expect(result.id).toBe('n1');
    expect(result.message).toBe('');
    expect(result.read).toBe(false);
    expect(result).not.toHaveProperty('actorId');
    expect(result).not.toHaveProperty('actorName');
    expect(result).not.toHaveProperty('businessId');
    expect(result).not.toHaveProperty('businessName');
    expect(result).not.toHaveProperty('referenceId');
  });

  it('fromFirestore includes all optional fields when present', () => {
    const snap = mockSnapshot({
      ...baseData,
      actorId: 'u2',
      actorName: 'Bob',
      businessId: 'b1',
      businessName: 'Cafe',
      referenceId: 'ref1',
    }, 'n1');
    const result = notificationConverter.fromFirestore(snap);
    expect(result.actorId).toBe('u2');
    expect(result.actorName).toBe('Bob');
    expect(result.businessId).toBe('b1');
    expect(result.businessName).toBe('Cafe');
    expect(result.referenceId).toBe('ref1');
  });
});

// ---------------------------------------------------------------------------
// userSettingsConverter
// ---------------------------------------------------------------------------
describe('userSettingsConverter', () => {
  const full = {
    profilePublic: true, notificationsEnabled: true,
    notifyLikes: true, notifyPhotos: true, notifyRankings: true,
    notifyFeedback: false, notifyReplies: false,
    analyticsEnabled: true, updatedAt: NOW,
  };

  it('toFirestore serializes all fields', () => {
    expect(userSettingsConverter.toFirestore(full)).toEqual(full);
  });

  it('fromFirestore applies defaults for missing fields', () => {
    const snap = mockSnapshot({});
    const result = userSettingsConverter.fromFirestore(snap);
    expect(result.profilePublic).toBe(false);
    expect(result.notificationsEnabled).toBe(false);
    expect(result.notifyLikes).toBe(false);
    expect(result.notifyPhotos).toBe(false);
    expect(result.notifyRankings).toBe(false);
    expect(result.notifyFeedback).toBe(true);
    expect(result.notifyReplies).toBe(true);
    expect(result.analyticsEnabled).toBe(false);
  });

  it('fromFirestore deserializes complete document', () => {
    const snap = mockSnapshot(full);
    const result = userSettingsConverter.fromFirestore(snap);
    expect(result.profilePublic).toBe(true);
    expect(result.notifyFeedback).toBe(false);
    expect(result.notifyReplies).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sharedListConverter
// ---------------------------------------------------------------------------
describe('sharedListConverter', () => {
  const full = {
    ownerId: 'u1', name: 'My List', description: 'Desc',
    isPublic: true, itemCount: 3, createdAt: NOW, updatedAt: NOW,
  };

  it('toFirestore serializes all fields', () => {
    const result = sharedListConverter.toFirestore({ id: 'sl1', ...full });
    expect(result).toEqual(full);
    expect(result).not.toHaveProperty('id');
  });

  it('fromFirestore applies defaults for missing fields', () => {
    const snap = mockSnapshot({}, 'sl1');
    const result = sharedListConverter.fromFirestore(snap);
    expect(result.id).toBe('sl1');
    expect(result.ownerId).toBe('');
    expect(result.name).toBe('');
    expect(result.description).toBe('');
    expect(result.isPublic).toBe(false);
    expect(result.itemCount).toBe(0);
  });

  it('fromFirestore deserializes complete document', () => {
    const snap = mockSnapshot(full, 'sl1');
    const result = sharedListConverter.fromFirestore(snap);
    expect(result.id).toBe('sl1');
    expect(result.name).toBe('My List');
    expect(result.isPublic).toBe(true);
    expect(result.itemCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// listItemConverter
// ---------------------------------------------------------------------------
describe('listItemConverter', () => {
  it('toFirestore serializes without id', () => {
    const item = { id: 'li1', listId: 'sl1', businessId: 'b1', createdAt: NOW };
    const result = listItemConverter.toFirestore(item);
    expect(result).not.toHaveProperty('id');
    expect(result.listId).toBe('sl1');
  });

  it('fromFirestore applies defaults for missing fields', () => {
    const snap = mockSnapshot({}, 'li1');
    const result = listItemConverter.fromFirestore(snap);
    expect(result.id).toBe('li1');
    expect(result.listId).toBe('');
    expect(result.businessId).toBe('');
  });

  it('fromFirestore deserializes complete document', () => {
    const snap = mockSnapshot({ listId: 'sl1', businessId: 'b1', createdAt: NOW }, 'li1');
    const result = listItemConverter.fromFirestore(snap);
    expect(result.id).toBe('li1');
    expect(result.listId).toBe('sl1');
    expect(result.businessId).toBe('b1');
  });
});
