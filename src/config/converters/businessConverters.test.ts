import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/formatDate', () => ({
  toDate: vi.fn((v: unknown) => {
    if (v instanceof Date) return v;
    if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate: () => Date }).toDate();
    return new Date(0);
  }),
}));

import {
  ratingConverter,
  commentConverter,
  commentLikeConverter,
  userTagConverter,
  customTagConverter,
  favoriteConverter,
  menuPhotoConverter,
  priceLevelConverter,
} from './index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockSnapshot(data: Record<string, unknown>, id = 'test-id'): any {
  return { data: () => data, id };
}

const NOW = new Date('2025-06-01T12:00:00Z');

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

  it('toFirestore includes type when present', () => {
    const comment = { id: 'c1', ...baseData, likeCount: 0, type: 'question' as const };
    const result = commentConverter.toFirestore(comment);
    expect(result.type).toBe('question');
  });

  it('toFirestore omits type when not present', () => {
    const comment = { id: 'c1', ...baseData, likeCount: 0 };
    const result = commentConverter.toFirestore(comment);
    expect(result).not.toHaveProperty('type');
  });

  it('fromFirestore includes type when present', () => {
    const snap = mockSnapshot({ ...baseData, type: 'question' });
    expect(commentConverter.fromFirestore(snap).type).toBe('question');
  });

  it('fromFirestore omits type when not present', () => {
    const snap = mockSnapshot(baseData);
    expect(commentConverter.fromFirestore(snap)).not.toHaveProperty('type');
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
