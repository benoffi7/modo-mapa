import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/formatDate', () => ({
  toDate: vi.fn((v: unknown) => {
    if (v instanceof Date) return v;
    if (v && typeof v === 'object' && 'toDate' in v) return (v as { toDate: () => Date }).toDate();
    return new Date(0);
  }),
}));

import { userRankingConverter, notificationConverter, trendingDataConverter } from './index';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockSnapshot(data: Record<string, unknown>, id = 'test-id'): any {
  return { data: () => data, id };
}

const NOW = new Date('2025-06-01T12:00:00Z');

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
// trendingDataConverter
// ---------------------------------------------------------------------------
describe('trendingDataConverter', () => {
  it('toFirestore serializes all fields', () => {
    const data = {
      businesses: [{ businessId: 'b1', name: 'Cafe', category: 'food', score: 10, rank: 1, breakdown: { ratings: 5, comments: 2, userTags: 1, priceLevels: 1, listItems: 1 } }],
      computedAt: NOW,
      periodStart: NOW,
      periodEnd: NOW,
    };
    const result = trendingDataConverter.toFirestore(data);
    expect(result.businesses).toHaveLength(1);
    expect(result.computedAt).toEqual(NOW);
  });

  it('fromFirestore deserializes businesses with breakdown', () => {
    const snap = mockSnapshot({
      businesses: [{
        businessId: 'b1', name: 'Cafe', category: 'food', score: 10, rank: 1,
        breakdown: { ratings: 5, comments: 2, userTags: 1, priceLevels: 1, listItems: 1 },
      }],
      computedAt: NOW,
      periodStart: NOW,
      periodEnd: NOW,
    });
    const result = trendingDataConverter.fromFirestore(snap);
    expect(result.businesses).toHaveLength(1);
    expect(result.businesses[0].businessId).toBe('b1');
    expect(result.businesses[0].breakdown.ratings).toBe(5);
    expect(result.businesses[0].breakdown.comments).toBe(2);
  });

  it('fromFirestore handles empty businesses array', () => {
    const snap = mockSnapshot({ businesses: [], computedAt: NOW, periodStart: NOW, periodEnd: NOW });
    const result = trendingDataConverter.fromFirestore(snap);
    expect(result.businesses).toEqual([]);
  });

  it('fromFirestore defaults businesses to empty array when missing', () => {
    const snap = mockSnapshot({ computedAt: NOW, periodStart: NOW, periodEnd: NOW });
    const result = trendingDataConverter.fromFirestore(snap);
    expect(result.businesses).toEqual([]);
  });
});
