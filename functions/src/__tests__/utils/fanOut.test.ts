import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '__ts__' },
}));

vi.mock('../../utils/perfTracker', () => ({
  trackFunctionTiming: vi.fn().mockResolvedValue(undefined),
}));

import { fanOutToFollowers, fanOutDedupKey } from '../../utils/fanOut';
import {
  FANOUT_DEDUP_WINDOW_MS,
  FANOUT_MAX_RECIPIENTS_PER_ACTION,
} from '../../constants/fanOut';

type Docish = {
  id: string;
  data: () => Record<string, unknown>;
  get?: (k: string) => unknown;
};

interface MockDbState {
  userSettings: Record<string, { profilePublic?: boolean } | null>;
  followers: Docish[];
  dedup: Map<string, { createdAt: number }>;
  batches: Array<Array<{ ref: string; data: Record<string, unknown> }>>;
  feedWrites: Array<{ ref: string; data: Record<string, unknown> }>;
  dedupWrites: Array<{ ref: string; data: Record<string, unknown> }>;
  commitCount: number;
}

function buildDb(initial: Partial<MockDbState> = {}) {
  const state: MockDbState = {
    userSettings: initial.userSettings ?? {},
    followers: initial.followers ?? [],
    dedup: initial.dedup ?? new Map(),
    batches: [],
    feedWrites: [],
    dedupWrites: [],
    commitCount: 0,
  };

  let currentBatch: Array<{ ref: string; data: Record<string, unknown> }> = [];

  const doc = (path: string) => {
    if (path.startsWith('userSettings/')) {
      const uid = path.split('/')[1];
      const data = state.userSettings[uid];
      return {
        get: vi.fn().mockResolvedValue({
          exists: data !== undefined && data !== null,
          data: () => data ?? null,
        }),
        _path: path,
      };
    }
    return { _path: path };
  };

  const collectionCursor = {
    where: vi.fn().mockImplementation(() => ({
      limit: vi.fn().mockImplementation((n: number) => ({
        get: vi.fn().mockResolvedValue({
          empty: state.followers.length === 0,
          docs: state.followers.slice(0, n),
        }),
      })),
    })),
  };

  const dedupCollection = {
    doc: vi.fn().mockImplementation((id: string) => {
      const existing = state.dedup.get(id);
      return {
        _path: `_fanoutDedup/${id}`,
        get: vi.fn().mockResolvedValue({
          exists: existing !== undefined,
          get: (k: string) => {
            if (!existing) return undefined;
            if (k === 'createdAt') return existing.createdAt;
            return undefined;
          },
        }),
      };
    }),
  };

  const activityFeedCollection = {
    doc: vi.fn().mockImplementation(() => ({
      collection: vi.fn().mockImplementation(() => ({
        doc: vi.fn().mockImplementation(() => ({ _path: 'activityFeed/X/items/Y' })),
      })),
    })),
  };

  const db = {
    doc,
    collection: vi.fn().mockImplementation((name: string) => {
      if (name === 'follows') return collectionCursor;
      if (name === '_fanoutDedup') return dedupCollection;
      if (name === 'activityFeed') return activityFeedCollection;
      throw new Error(`Unexpected collection ${name}`);
    }),
    batch: vi.fn().mockImplementation(() => {
      currentBatch = [];
      return {
        set: vi.fn().mockImplementation((ref: { _path: string }, data: Record<string, unknown>) => {
          currentBatch.push({ ref: ref._path, data });
          if (ref._path.startsWith('_fanoutDedup/')) {
            state.dedupWrites.push({ ref: ref._path, data });
          } else {
            state.feedWrites.push({ ref: ref._path, data });
          }
        }),
        commit: vi.fn().mockImplementation(async () => {
          state.batches.push([...currentBatch]);
          state.commitCount += 1;
          currentBatch = [];
        }),
      };
    }),
  };

  return { db, state };
}

describe('fanOutDedupKey', () => {
  it('produces a deterministic sha256 hex', () => {
    const key = fanOutDedupKey('a', 'favorite', 'biz_1', 'f1');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(fanOutDedupKey('a', 'favorite', 'biz_1', 'f1')).toBe(key);
  });

  it('differs per recipient', () => {
    expect(fanOutDedupKey('a', 'favorite', 'biz_1', 'f1'))
      .not.toBe(fanOutDedupKey('a', 'favorite', 'biz_1', 'f2'));
  });

  it('differs per type', () => {
    expect(fanOutDedupKey('a', 'favorite', 'biz_1', 'f1'))
      .not.toBe(fanOutDedupKey('a', 'comment', 'biz_1', 'f1'));
  });
});

describe('fanOutToFollowers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips fan-out when actor profilePublic is false', async () => {
    const { db, state } = buildDb({
      userSettings: { actor1: { profilePublic: false } },
      followers: [
        { id: 'f1', data: () => ({ followerId: 'f1' }) },
      ],
    });

    // Add dedupCollection.doc spy behavior — default
    await fanOutToFollowers(db as never, {
      actorId: 'actor1',
      actorName: 'Actor',
      type: 'favorite',
      businessId: 'biz_1',
      businessName: 'Biz',
      referenceId: 'ref_1',
    });

    expect(state.feedWrites).toHaveLength(0);
    expect(state.dedupWrites).toHaveLength(0);
  });

  it('returns early when no followers exist', async () => {
    const { db, state } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers: [],
    });

    await fanOutToFollowers(db as never, {
      actorId: 'actor1',
      actorName: 'Actor',
      type: 'favorite',
      businessId: 'biz_1',
      businessName: 'Biz',
      referenceId: 'ref_1',
    });

    expect(state.feedWrites).toHaveLength(0);
    expect(state.commitCount).toBe(0);
  });

  it('writes dedup + feed for first delivery', async () => {
    const { db, state } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers: [
        { id: 'fd1', data: () => ({ followerId: 'follower1' }) },
      ],
    });

    await fanOutToFollowers(db as never, {
      actorId: 'actor1',
      actorName: 'Actor',
      type: 'favorite',
      businessId: 'biz_1',
      businessName: 'Biz',
      referenceId: 'ref_1',
    });

    expect(state.feedWrites).toHaveLength(1);
    expect(state.dedupWrites).toHaveLength(1);
    expect(state.dedupWrites[0].data).toMatchObject({
      actorId: 'actor1',
      type: 'favorite',
      businessId: 'biz_1',
      followerId: 'follower1',
    });
  });

  it('skips recipient when dedup exists within window', async () => {
    const dedupKey = fanOutDedupKey('actor1', 'favorite', 'biz_1', 'follower1');
    const freshTimestamp = Date.now() - 1000; // 1s ago, well inside 24h window

    const { db, state } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers: [
        { id: 'fd1', data: () => ({ followerId: 'follower1' }) },
      ],
      dedup: new Map([[dedupKey, { createdAt: freshTimestamp }]]),
    });

    await fanOutToFollowers(db as never, {
      actorId: 'actor1',
      actorName: 'Actor',
      type: 'favorite',
      businessId: 'biz_1',
      businessName: 'Biz',
      referenceId: 'ref_1',
    });

    expect(state.feedWrites).toHaveLength(0);
    expect(state.dedupWrites).toHaveLength(0);
  });

  it('re-delivers when dedup is older than window', async () => {
    const dedupKey = fanOutDedupKey('actor1', 'favorite', 'biz_1', 'follower1');
    const expiredTimestamp = Date.now() - FANOUT_DEDUP_WINDOW_MS - 60_000;

    const { db, state } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers: [
        { id: 'fd1', data: () => ({ followerId: 'follower1' }) },
      ],
      dedup: new Map([[dedupKey, { createdAt: expiredTimestamp }]]),
    });

    await fanOutToFollowers(db as never, {
      actorId: 'actor1',
      actorName: 'Actor',
      type: 'favorite',
      businessId: 'biz_1',
      businessName: 'Biz',
      referenceId: 'ref_1',
    });

    expect(state.feedWrites).toHaveLength(1);
    expect(state.dedupWrites).toHaveLength(1);
  });

  it('applies FANOUT_MAX_RECIPIENTS_PER_ACTION cap', async () => {
    // Simulate more followers than the cap
    const totalFollowers = FANOUT_MAX_RECIPIENTS_PER_ACTION + 50;
    const followers: Docish[] = Array.from({ length: totalFollowers }, (_, i) => ({
      id: `fd${i}`,
      data: () => ({ followerId: `f${i}` }),
    }));

    const { db, state } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers,
    });

    await fanOutToFollowers(db as never, {
      actorId: 'actor1',
      actorName: 'Actor',
      type: 'favorite',
      businessId: 'biz_1',
      businessName: 'Biz',
      referenceId: 'ref_1',
    });

    expect(state.feedWrites.length).toBe(FANOUT_MAX_RECIPIENTS_PER_ACTION);
    expect(state.dedupWrites.length).toBe(FANOUT_MAX_RECIPIENTS_PER_ACTION);
  });

  it('mixes skip and write when some dedups exist and others do not', async () => {
    const key1 = fanOutDedupKey('actor1', 'favorite', 'biz_1', 'f1');
    const fresh = Date.now() - 1000;

    const { db, state } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers: [
        { id: 'd1', data: () => ({ followerId: 'f1' }) },
        { id: 'd2', data: () => ({ followerId: 'f2' }) },
      ],
      dedup: new Map([[key1, { createdAt: fresh }]]),
    });

    await fanOutToFollowers(db as never, {
      actorId: 'actor1',
      actorName: 'Actor',
      type: 'favorite',
      businessId: 'biz_1',
      businessName: 'Biz',
      referenceId: 'ref_1',
    });

    // Only f2 should be written
    expect(state.feedWrites).toHaveLength(1);
    expect(state.dedupWrites).toHaveLength(1);
    expect(state.dedupWrites[0].data.followerId).toBe('f2');
  });

  it('fans out when actor has no userSettings doc (public default)', async () => {
    const { db, state } = buildDb({
      userSettings: {},
      followers: [
        { id: 'fd1', data: () => ({ followerId: 'follower1' }) },
      ],
    });

    await fanOutToFollowers(db as never, {
      actorId: 'actor1',
      actorName: 'Actor',
      type: 'comment',
      businessId: 'biz_1',
      businessName: 'Biz',
      referenceId: 'ref_1',
    });

    expect(state.feedWrites).toHaveLength(1);
  });
});
