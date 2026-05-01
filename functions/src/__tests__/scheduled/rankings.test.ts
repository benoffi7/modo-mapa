import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  weeklyHandler,
  monthlyHandler,
  alltimeHandler,
  mockGetDb,
  mockTrackFunctionTiming,
  scheduleState,
} = vi.hoisted(() => ({
  weeklyHandler: { fn: null as (() => Promise<void>) | null },
  monthlyHandler: { fn: null as (() => Promise<void>) | null },
  alltimeHandler: { fn: null as (() => Promise<void>) | null },
  mockGetDb: vi.fn(),
  mockTrackFunctionTiming: vi.fn().mockResolvedValue(undefined),
  scheduleState: { count: 0 },
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_opts: unknown, handler: () => Promise<void>) => {
    // Three onSchedule calls in scheduled/rankings.ts in order:
    // 1) computeWeeklyRanking, 2) computeMonthlyRanking, 3) computeAlltimeRanking
    if (scheduleState.count === 0) weeklyHandler.fn = handler;
    else if (scheduleState.count === 1) monthlyHandler.fn = handler;
    else if (scheduleState.count === 2) alltimeHandler.fn = handler;
    scheduleState.count += 1;
    return handler;
  },
}));

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromDate: (d: Date) => d,
  },
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TS'),
  },
}));

vi.mock('../../helpers/env', () => ({
  get getDb() { return mockGetDb; },
}));

vi.mock('../../utils/perfTracker', () => ({
  trackFunctionTiming: (name: string, startMs: number) => mockTrackFunctionTiming(name, startMs),
}));

import '../../scheduled/rankings';

function createMockDb() {
  // computeRanking calls:
  //   db.collection('users').select('displayName').get() → user docs
  //   db.collection(<col>).where(...).where(...).select('userId').get() for 5 collections
  //   db.collection('menuPhotos').where(...).where(...).where(...).select('userId').get()
  //   db.doc(`userRankings/${period}`).set(payload)
  // We return empty results everywhere; only verify timing tracking + heartbeat calls.
  const usersGet = vi.fn().mockResolvedValue({ docs: [] });
  const usersSelect = vi.fn().mockReturnValue({ get: usersGet });

  const colGet = vi.fn().mockResolvedValue({ docs: [] });
  const colSelect = vi.fn().mockReturnValue({ get: colGet });
  const colWhere2 = vi.fn().mockReturnValue({ select: colSelect, where: vi.fn().mockReturnValue({ select: colSelect }) });
  const colWhere = vi.fn().mockReturnValue({ where: colWhere2, select: colSelect });

  const collection = vi.fn().mockImplementation((name: string) => {
    if (name === 'users') return { select: usersSelect };
    return { where: colWhere };
  });

  const docSet = vi.fn().mockResolvedValue(undefined);
  const docFn = vi.fn().mockReturnValue({ set: docSet });

  return { collection, doc: docFn };
}

describe('scheduled rankings handlers', () => {
  beforeEach(() => {
    mockTrackFunctionTiming.mockClear();
    mockGetDb.mockReturnValue(createMockDb());
  });

  it('computeWeeklyRanking tracks timing with its label', async () => {
    expect(weeklyHandler.fn).not.toBeNull();
    await weeklyHandler.fn!();
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('computeWeeklyRanking', expect.any(Number));
  });

  it('computeMonthlyRanking tracks timing with its label', async () => {
    expect(monthlyHandler.fn).not.toBeNull();
    await monthlyHandler.fn!();
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('computeMonthlyRanking', expect.any(Number));
  });

  it('computeAlltimeRanking tracks timing with its label', async () => {
    expect(alltimeHandler.fn).not.toBeNull();
    await alltimeHandler.fn!();
    expect(mockTrackFunctionTiming).toHaveBeenCalledWith('computeAlltimeRanking', expect.any(Number));
  });
});
