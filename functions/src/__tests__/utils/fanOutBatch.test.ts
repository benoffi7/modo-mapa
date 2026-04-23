/**
 * Tests for the db.getAll() batch dedup optimization introduced in #312.
 * Functional/dedup tests live in fanOut.test.ts.
 * Shared mock setup lives in fanOut.fixtures.ts.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { serverTimestamp: () => '__ts__' },
}));

vi.mock('../../utils/perfTracker', () => ({
  trackFunctionTiming: vi.fn().mockResolvedValue(undefined),
}));

import { fanOutToFollowers, fanOutDedupKey } from '../../utils/fanOut';
import {
  FANOUT_DEDUP_WINDOW_MS,
  FANOUT_GETALL_CHUNK_SIZE,
  FANOUT_MAX_RECIPIENTS_PER_ACTION,
} from '../../constants/fanOut';
import { buildDb } from './fanOut.fixtures';

const BASE_DATA = {
  actorId: 'actor1',
  actorName: 'A',
  type: 'favorite' as const,
  businessId: 'b1',
  businessName: 'B',
  referenceId: 'r1',
};

describe('fanOutToFollowers — db.getAll batch reads (#312)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('1 follower, no dedup → db.getAll called 1 time; 1 feed write + 1 dedup write', async () => {
    const { db, state, getAllSpy } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers: [{ id: 'fd1', data: () => ({ followerId: 'f1' }) }],
    });

    await fanOutToFollowers(db as never, BASE_DATA);

    expect(getAllSpy).toHaveBeenCalledTimes(1);
    expect(state.feedWrites).toHaveLength(1);
    expect(state.dedupWrites).toHaveLength(1);
  });

  it('31 followers, no dedup → db.getAll called 2 times; 31 feed writes', async () => {
    const followers = Array.from({ length: 31 }, (_, i) => ({
      id: `fd${i}`, data: () => ({ followerId: `f${i}` }),
    }));

    const { db, state, getAllSpy } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers,
    });

    await fanOutToFollowers(db as never, BASE_DATA);

    // ceil(31 / 30) = 2 chunks
    expect(getAllSpy).toHaveBeenCalledTimes(2);
    expect(getAllSpy.mock.calls[0]).toHaveLength(FANOUT_GETALL_CHUNK_SIZE);
    expect(getAllSpy.mock.calls[1]).toHaveLength(1);
    expect(state.feedWrites).toHaveLength(31);
  });

  it('31 followers, first 30 with fresh dedup → db.getAll 2 times; only 1 feed write', async () => {
    const followers = Array.from({ length: 31 }, (_, i) => ({
      id: `fd${i}`, data: () => ({ followerId: `f${i}` }),
    }));

    const freshTimestamp = Date.now() - 1000;
    const dedupMap = new Map<string, { createdAt: number }>();
    for (let i = 0; i < 30; i++) {
      const key = fanOutDedupKey('actor1', 'favorite', 'b1', `f${i}`);
      dedupMap.set(key, { createdAt: freshTimestamp });
    }

    const { db, state, getAllSpy } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers,
      dedup: dedupMap,
    });

    await fanOutToFollowers(db as never, BASE_DATA);

    expect(getAllSpy).toHaveBeenCalledTimes(2);
    // Only f30 (index 30) passes dedup check
    expect(state.feedWrites).toHaveLength(1);
    expect(state.dedupWrites).toHaveLength(1);
  });

  it('expired dedup → overwrites; 1 feed write + 1 dedup write', async () => {
    const expiredTimestamp = Date.now() - FANOUT_DEDUP_WINDOW_MS - 60_000;
    const dedupKey = fanOutDedupKey('actor1', 'favorite', 'b1', 'f1');

    const { db, state, getAllSpy } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers: [{ id: 'fd1', data: () => ({ followerId: 'f1' }) }],
      dedup: new Map([[dedupKey, { createdAt: expiredTimestamp }]]),
    });

    await fanOutToFollowers(db as never, BASE_DATA);

    expect(getAllSpy).toHaveBeenCalledTimes(1);
    expect(state.feedWrites).toHaveLength(1);
    expect(state.dedupWrites).toHaveLength(1);
  });

  it('profilePublic === false → early return; db.getAll never called', async () => {
    const { db, getAllSpy } = buildDb({
      userSettings: { actor1: { profilePublic: false } },
      followers: [{ id: 'fd1', data: () => ({ followerId: 'f1' }) }],
    });

    await fanOutToFollowers(db as never, BASE_DATA);

    expect(getAllSpy).not.toHaveBeenCalled();
  });

  it('no followers → early return; db.getAll never called', async () => {
    const { db, getAllSpy } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers: [],
    });

    await fanOutToFollowers(db as never, BASE_DATA);

    expect(getAllSpy).not.toHaveBeenCalled();
  });

  it('cap of 500 → total refs passed to getAll never exceeds cap', async () => {
    const totalFollowers = FANOUT_MAX_RECIPIENTS_PER_ACTION + 50;
    const followers = Array.from({ length: totalFollowers }, (_, i) => ({
      id: `fd${i}`, data: () => ({ followerId: `f${i}` }),
    }));

    const { db, getAllSpy } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers,
    });

    await fanOutToFollowers(db as never, BASE_DATA);

    const totalRefsQueried = getAllSpy.mock.calls.reduce(
      (sum: number, call: unknown[]) => sum + call.length,
      0,
    );
    expect(totalRefsQueried).toBeLessThanOrEqual(FANOUT_MAX_RECIPIENTS_PER_ACTION);
  });

  it('trackFunctionTiming called exactly once for fanOutDedupBatch and once for fanOutToFollowers', async () => {
    const { trackFunctionTiming } = await import('../../utils/perfTracker');

    const { db } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers: [{ id: 'fd1', data: () => ({ followerId: 'f1' }) }],
    });

    await fanOutToFollowers(db as never, BASE_DATA);

    const calls = (trackFunctionTiming as Mock).mock.calls as string[][];
    const dedupBatchCalls = calls.filter((c) => c[0] === 'fanOutDedupBatch');
    const fanOutCalls = calls.filter((c) => c[0] === 'fanOutToFollowers');
    expect(dedupBatchCalls).toHaveLength(1);
    expect(fanOutCalls).toHaveLength(1);
  });

  it('individual .get() is never called on dedup refs in the normal fan-out path', async () => {
    const { db } = buildDb({
      userSettings: { actor1: { profilePublic: true } },
      followers: [
        { id: 'fd1', data: () => ({ followerId: 'f1' }) },
        { id: 'fd2', data: () => ({ followerId: 'f2' }) },
      ],
    });

    await fanOutToFollowers(db as never, BASE_DATA);

    // dedupCollection.doc().get should never be called since we use getAll
    const dedupDocMock = (db.collection as Mock).mock.results.find(
      (r: { value: { doc?: Mock } }) => r.value?.doc !== undefined,
    );
    if (dedupDocMock) {
      const individualGetCalls = (dedupDocMock.value.doc as Mock).mock.results
        .flatMap((r: { value: { get?: Mock } }) => r.value?.get?.mock.calls ?? []);
      expect(individualGetCalls).toHaveLength(0);
    }
  });
});
