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
import { buildDb } from './fanOut.fixtures';

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
    const totalFollowers = FANOUT_MAX_RECIPIENTS_PER_ACTION + 50;
    const followers = Array.from({ length: totalFollowers }, (_, i) => ({
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
