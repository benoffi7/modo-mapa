import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockFetchDailyMetrics = vi.fn();

vi.mock('../services/metrics', () => ({
  fetchDailyMetrics: (...args: unknown[]) => mockFetchDailyMetrics(...args),
}));

vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn() },
}));

import { usePublicMetrics } from './usePublicMetrics';
import type { PublicMetrics } from '../types/metrics';

const mockMetrics: PublicMetrics = {
  date: '2026-03-31',
  ratingDistribution: { '5': 10 },
  topFavorited: [],
  topCommented: [],
  topRated: [],
  topTags: [],
};

describe('usePublicMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns metrics on success', async () => {
    mockFetchDailyMetrics.mockResolvedValue(mockMetrics);

    const { result } = renderHook(() => usePublicMetrics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metrics).toEqual(mockMetrics);
    expect(result.current.error).toBe(false);
  });

  it('returns null metrics when doc does not exist', async () => {
    mockFetchDailyMetrics.mockResolvedValue(null);

    const { result } = renderHook(() => usePublicMetrics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metrics).toBeNull();
    expect(result.current.error).toBe(false);
  });

  it('sets error on fetch failure', async () => {
    mockFetchDailyMetrics.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => usePublicMetrics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(true);
    expect(result.current.metrics).toBeNull();
  });

  it('starts with loading=true', () => {
    mockFetchDailyMetrics.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePublicMetrics());

    expect(result.current.loading).toBe(true);
  });

  it('ignores result if unmounted before fetch resolves (ignore pattern)', async () => {
    let resolvePromise!: (v: PublicMetrics | null) => void;
    mockFetchDailyMetrics.mockReturnValue(new Promise((res) => { resolvePromise = res; }));

    const { result, unmount } = renderHook(() => usePublicMetrics());

    unmount();

    // Resolve after unmount — should not update state
    resolvePromise(mockMetrics);
    await new Promise((r) => setTimeout(r, 10));

    // State should not have changed (still loading=true because no update happened)
    expect(result.current.loading).toBe(true);
    expect(result.current.metrics).toBeNull();
  });
});
