import { describe, it, expect } from 'vitest';
import {
  countersConverter,
  dailyMetricsConverter,
  abuseLogConverter,
  perfMetricsConverter,
  moderationLogConverter,
} from './adminConverters';

function mockSnap(data: Record<string, unknown>, id = 'doc-id') {
  return { data: () => data, id } as Parameters<typeof countersConverter.fromFirestore>[0];
}

describe('countersConverter', () => {
  it('fromFirestore: maps numeric values correctly', () => {
    const result = countersConverter.fromFirestore(mockSnap({
      comments: 10, ratings: 5, favorites: 3, feedback: 1,
      users: 100, customTags: 2, userTags: 7, commentLikes: 20,
      checkins: 4, follows: 8, recommendations: 0, priceLevels: 1,
      dailyReads: 50, dailyWrites: 25, dailyDeletes: 5,
    }));
    expect(result.comments).toBe(10);
    expect(result.ratings).toBe(5);
    expect(result.users).toBe(100);
  });

  it('fromFirestore: falls back to 0 for non-numeric values', () => {
    const result = countersConverter.fromFirestore(mockSnap({
      comments: 'bad', ratings: null, favorites: undefined,
    }));
    expect(result.comments).toBe(0);
    expect(result.ratings).toBe(0);
    expect(result.favorites).toBe(0);
  });

  it('toFirestore: spreads data unchanged', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input = { comments: 5 } as any;
    expect(countersConverter.toFirestore(input)).toEqual({ comments: 5 });
  });
});

describe('dailyMetricsConverter', () => {
  it('fromFirestore: maps numeric and collection fields', () => {
    const result = dailyMetricsConverter.fromFirestore(mockSnap(
      {
        ratingDistribution: { '5': 10, '4': 5 },
        topFavorited: ['b1', 'b2'],
        topCommented: [],
        topRated: ['b3'],
        topTags: ['wifi'],
        dailyReads: 100,
        dailyWrites: 50,
        dailyDeletes: 5,
        writesByCollection: { comments: 20 },
        readsByCollection: { businesses: 80 },
        deletesByCollection: {},
        activeUsers: 30,
        newAccounts: 3,
      },
      '2024-06-01',
    ));
    expect(result.id).toBe('2024-06-01');
    expect(result.date).toBe('2024-06-01');
    expect(result.ratingDistribution).toEqual({ '5': 10, '4': 5 });
    expect(result.topFavorited).toEqual(['b1', 'b2']);
    expect(result.dailyReads).toBe(100);
  });

  it('fromFirestore: falls back for non-object/non-array fields', () => {
    const result = dailyMetricsConverter.fromFirestore(mockSnap({
      ratingDistribution: 'bad',
      topFavorited: null,
      topCommented: 42,
    }));
    expect(result.ratingDistribution).toEqual({});
    expect(result.topFavorited).toEqual([]);
    expect(result.topCommented).toEqual([]);
  });
});

describe('abuseLogConverter', () => {
  it('fromFirestore: maps all fields including optional severity', () => {
    const now = new Date();
    const result = abuseLogConverter.fromFirestore(mockSnap({
      userId: 'u1',
      type: 'rate_limit',
      collection: 'comments',
      detail: 'exceeded',
      timestamp: now,
      reviewed: true,
      dismissed: false,
      reviewedAt: now,
      severity: 'high',
    }));
    expect(result.userId).toBe('u1');
    expect(result.type).toBe('rate_limit');
    expect(result.reviewed).toBe(true);
    expect(result.dismissed).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.reviewedAt).toBeInstanceOf(Date);
  });

  it('fromFirestore: severity is undefined for unknown value', () => {
    const result = abuseLogConverter.fromFirestore(mockSnap({
      userId: 'u1',
      type: 'flagged',
      collection: 'tags',
      detail: '',
      timestamp: new Date(),
      severity: 'extreme', // unknown
    }));
    expect(result.severity).toBeUndefined();
  });

  it('fromFirestore: severity is medium when set to medium', () => {
    const result = abuseLogConverter.fromFirestore(mockSnap({
      userId: 'u1',
      type: 'flagged',
      collection: 'tags',
      detail: '',
      timestamp: new Date(),
      severity: 'medium',
    }));
    expect(result.severity).toBe('medium');
  });

  it('fromFirestore: reviewedAt is undefined when not present', () => {
    const result = abuseLogConverter.fromFirestore(mockSnap({
      userId: 'u1',
      type: 'rate_limit',
      collection: 'comments',
      detail: 'd',
      timestamp: new Date(),
    }));
    expect(result.reviewedAt).toBeUndefined();
  });
});

describe('perfMetricsConverter', () => {
  it('fromFirestore: maps vitals and device correctly', () => {
    const result = perfMetricsConverter.fromFirestore(mockSnap({
      sessionId: 'sess1',
      userId: 'u1',
      timestamp: new Date(),
      vitals: { lcp: 1500, inp: 200, cls: 0.1, ttfb: 300 },
      queries: { fetchBusinesses: { p50: 200, p95: 500, count: 10 } },
      device: { type: 'mobile', connection: '4g' },
      appVersion: '2.35.0',
    }));
    expect(result.sessionId).toBe('sess1');
    expect(result.userId).toBe('u1');
    expect(result.vitals.lcp).toBe(1500);
    expect(result.device.type).toBe('mobile');
    expect(result.device.connection).toBe('4g');
    expect(result.queries.fetchBusinesses.p50).toBe(200);
  });

  it('fromFirestore: device type defaults to desktop for non-mobile', () => {
    const result = perfMetricsConverter.fromFirestore(mockSnap({
      sessionId: 'sess2',
      userId: null,
      timestamp: new Date(),
      vitals: {},
      device: { type: 'tablet', connection: 'wifi' },
      appVersion: '2.0.0',
    }));
    expect(result.device.type).toBe('desktop');
    expect(result.userId).toBeNull();
  });

  it('fromFirestore: handles missing vitals and device', () => {
    const result = perfMetricsConverter.fromFirestore(mockSnap({
      sessionId: 'sess3',
      userId: 'u1',
      timestamp: new Date(),
      appVersion: '2.0.0',
    }));
    expect(result.vitals.lcp).toBeNull();
    expect(result.vitals.inp).toBeNull();
    expect(result.device.connection).toBe('unknown');
    expect(result.queries).toEqual({});
  });

  it('fromFirestore: asQueryTimingRecord handles invalid query entry', () => {
    const result = perfMetricsConverter.fromFirestore(mockSnap({
      sessionId: 'sess4',
      userId: 'u1',
      timestamp: new Date(),
      vitals: {},
      device: {},
      appVersion: '1.0.0',
      queries: {
        validQuery: { p50: 100, p95: 300, count: 5 },
        invalidEntry: 'not-an-object', // Should be skipped
      },
    }));
    expect(result.queries.validQuery).toEqual({ p50: 100, p95: 300, count: 5 });
    expect(result.queries.invalidEntry).toBeUndefined();
  });
});

describe('moderationLogConverter', () => {
  it('fromFirestore: maps all fields', () => {
    const result = moderationLogConverter.fromFirestore(mockSnap({
      adminId: 'admin1',
      action: 'delete',
      targetCollection: 'comments',
      targetDocId: 'doc1',
      targetUserId: 'user1',
      reason: 'Spam',
      snapshot: { text: 'bad content' },
      timestamp: new Date(),
    }));
    expect(result.adminId).toBe('admin1');
    expect(result.action).toBe('delete');
    expect(result.reason).toBe('Spam');
    expect(result.snapshot).toEqual({ text: 'bad content' });
  });

  it('fromFirestore: reason is undefined when not present', () => {
    const result = moderationLogConverter.fromFirestore(mockSnap({
      adminId: 'admin1',
      action: 'flag',
      targetCollection: 'comments',
      targetDocId: 'doc1',
      targetUserId: 'user1',
      snapshot: {},
      timestamp: new Date(),
    }));
    expect(result.reason).toBeUndefined();
  });

  it('fromFirestore: snapshot defaults to {} when invalid', () => {
    const result = moderationLogConverter.fromFirestore(mockSnap({
      adminId: 'admin1',
      action: 'delete',
      targetCollection: 'comments',
      targetDocId: 'doc1',
      targetUserId: 'user1',
      snapshot: 'not-an-object',
      timestamp: new Date(),
    }));
    expect(result.snapshot).toEqual({});
  });
});
