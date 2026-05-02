import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { UserRanking } from '../types';

const { mockUseAsyncData, mockFetchRanking, mockGetCurrentPeriodKey, mockGetPreviousPeriodKey } =
  vi.hoisted(() => ({
    mockUseAsyncData: vi.fn(),
    mockFetchRanking: vi.fn(),
    mockGetCurrentPeriodKey: vi.fn(),
    mockGetPreviousPeriodKey: vi.fn(),
  }));

vi.mock('./useAsyncData', () => ({
  useAsyncData: (fetcher: () => Promise<unknown>) => mockUseAsyncData(fetcher),
}));

vi.mock('../services/rankings', () => ({
  fetchRanking: (...args: unknown[]) => mockFetchRanking(...args),
  getCurrentPeriodKey: (...args: unknown[]) => mockGetCurrentPeriodKey(...args),
  getPreviousPeriodKey: (...args: unknown[]) => mockGetPreviousPeriodKey(...args),
}));

import { useRankings } from './useRankings';

function makeRanking(entries: Array<{ userId: string; score: number; displayName?: string }>): UserRanking {
  return {
    period: 'weekly_2026-W01',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-07'),
    totalParticipants: entries.length,
    rankings: entries.map((e) => ({
      userId: e.userId,
      displayName: e.displayName ?? e.userId,
      score: e.score,
      breakdown: {
        comments: 0,
        ratings: 0,
        likes: 0,
        tags: 0,
        favorites: 0,
        photos: 0,
      },
    })),
  };
}

describe('useRankings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentPeriodKey.mockReturnValue('weekly_2026-W01');
    mockGetPreviousPeriodKey.mockReturnValue('weekly_2025-W52');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('builds positionChanges map for users present in both periods', async () => {
    const refetchSpy = vi.fn();
    // First useAsyncData call (current period), second call (prev period)
    mockUseAsyncData
      .mockReturnValueOnce({
        data: makeRanking([
          { userId: 'u1', score: 100 }, // pos 1
          { userId: 'u2', score: 80 }, // pos 2
          { userId: 'u3', score: 60 }, // pos 3
        ]),
        loading: false,
        error: false,
        refetch: refetchSpy,
      })
      .mockReturnValueOnce({
        data: makeRanking([
          { userId: 'u2', score: 90 }, // pos 1 prev
          { userId: 'u1', score: 85 }, // pos 2 prev
          { userId: 'u3', score: 60 }, // pos 3 prev
        ]),
        loading: false,
        error: false,
        refetch: vi.fn(),
      });

    const { result } = renderHook(() => useRankings());

    // Defensive: assert dual call
    expect(mockUseAsyncData).toHaveBeenCalledTimes(2);

    // u1: prev pos 2 → curr pos 1 → +1 (moved up)
    expect(result.current.positionChanges.get('u1')).toBe(1);
    // u2: prev pos 1 → curr pos 2 → -1 (moved down)
    expect(result.current.positionChanges.get('u2')).toBe(-1);
    // u3: prev pos 3 → curr pos 3 → 0
    expect(result.current.positionChanges.get('u3')).toBe(0);
  });

  it('omits userIds present only in current period (not in prev map)', () => {
    mockUseAsyncData
      .mockReturnValueOnce({
        data: makeRanking([
          { userId: 'u1', score: 100 },
          { userId: 'newUser', score: 50 }, // newcomer, not in prev
        ]),
        loading: false,
        error: false,
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({
        data: makeRanking([{ userId: 'u1', score: 90 }]),
        loading: false,
        error: false,
        refetch: vi.fn(),
      });

    const { result } = renderHook(() => useRankings());

    expect(result.current.positionChanges.has('u1')).toBe(true);
    expect(result.current.positionChanges.has('newUser')).toBe(false);
  });

  it('returns empty map when prevRanking is null (alltime branch)', () => {
    mockGetPreviousPeriodKey.mockReturnValue(null); // alltime
    mockUseAsyncData
      .mockReturnValueOnce({
        data: makeRanking([{ userId: 'u1', score: 100 }]),
        loading: false,
        error: false,
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({
        data: null, // prev resolves to null for alltime
        loading: false,
        error: false,
        refetch: vi.fn(),
      });

    const { result } = renderHook(() => useRankings());

    expect(result.current.positionChanges.size).toBe(0);
  });

  it('returns empty map when current data is null (loading)', () => {
    mockUseAsyncData
      .mockReturnValueOnce({
        data: null,
        loading: true,
        error: false,
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({
        data: null,
        loading: true,
        error: false,
        refetch: vi.fn(),
      });

    const { result } = renderHook(() => useRankings());

    expect(result.current.positionChanges.size).toBe(0);
    expect(result.current.loading).toBe(true);
    expect(result.current.ranking).toBeNull();
  });

  it('exposes error from current period fetcher', () => {
    mockUseAsyncData
      .mockReturnValueOnce({
        data: null,
        loading: false,
        error: true,
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({
        data: null,
        loading: false,
        error: false,
        refetch: vi.fn(),
      });

    const { result } = renderHook(() => useRankings());

    expect(result.current.error).toBe(true);
  });

  it('refetch propagates to current-period useAsyncData refetch', () => {
    const refetchSpy = vi.fn();
    mockUseAsyncData
      .mockReturnValueOnce({
        data: null,
        loading: false,
        error: false,
        refetch: refetchSpy,
      })
      .mockReturnValueOnce({
        data: null,
        loading: false,
        error: false,
        refetch: vi.fn(),
      });

    const { result } = renderHook(() => useRankings());

    act(() => {
      result.current.refetch();
    });

    expect(refetchSpy).toHaveBeenCalledTimes(1);
  });

  it('default periodType is weekly and setPeriodType updates it', async () => {
    mockUseAsyncData.mockReturnValue({
      data: null,
      loading: false,
      error: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useRankings());

    expect(result.current.periodType).toBe('weekly');

    act(() => {
      result.current.setPeriodType('alltime');
    });

    await waitFor(() => expect(result.current.periodType).toBe('alltime'));
  });

  it('fetcher invokes fetchRanking with current period key (verified via fetcher invocation)', async () => {
    mockFetchRanking.mockResolvedValue(null);
    mockUseAsyncData.mockImplementation((fetcher: () => Promise<unknown>) => {
      // Eagerly invoke the fetcher to verify it routes through fetchRanking
      void fetcher();
      return { data: null, loading: false, error: false, refetch: vi.fn() };
    });

    renderHook(() => useRankings());

    await waitFor(() => expect(mockFetchRanking).toHaveBeenCalledWith('weekly_2026-W01'));
  });

  it('prevFetcher resolves null when getPreviousPeriodKey returns null (alltime)', async () => {
    mockGetPreviousPeriodKey.mockReturnValue(null);
    const fetchersInvoked: Array<unknown> = [];
    mockUseAsyncData.mockImplementation(async (fetcher: () => Promise<unknown>) => {
      fetchersInvoked.push(await fetcher());
      return { data: null, loading: false, error: false, refetch: vi.fn() };
    });

    renderHook(() => useRankings());

    await waitFor(() => expect(fetchersInvoked.length).toBeGreaterThanOrEqual(2));
    // The second fetcher (prev) resolves null without calling fetchRanking
    expect(fetchersInvoked[1]).toBeNull();
  });
});
