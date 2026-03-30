import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchMyCheckIns = vi.fn();

vi.mock('../services/checkins', () => ({
  fetchMyCheckIns: (...args: unknown[]) => mockFetchMyCheckIns(...args),
}));

let mockUser: { uid: string } | null = { uid: 'user1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

import { useMyCheckIns } from './useMyCheckIns';

describe('useMyCheckIns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'user1' };
    mockFetchMyCheckIns.mockResolvedValue([]);
  });

  it('loads check-ins on mount', async () => {
    mockFetchMyCheckIns.mockResolvedValue([
      { id: 'ci-1', businessId: 'biz-1' },
      { id: 'ci-2', businessId: 'biz-2' },
    ]);

    const { result } = renderHook(() => useMyCheckIns());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.checkIns).toHaveLength(2);
    expect(result.current.error).toBeNull();
    expect(mockFetchMyCheckIns).toHaveBeenCalledWith('user1');
  });

  it('computes stats correctly', async () => {
    mockFetchMyCheckIns.mockResolvedValue([
      { id: 'ci-1', businessId: 'biz-1' },
      { id: 'ci-2', businessId: 'biz-2' },
      { id: 'ci-3', businessId: 'biz-1' }, // duplicate business
    ]);

    const { result } = renderHook(() => useMyCheckIns());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stats.totalCheckIns).toBe(3);
    expect(result.current.stats.uniqueBusinesses).toBe(2);
  });

  it('does not fetch when no user', async () => {
    mockUser = null;
    const { result } = renderHook(() => useMyCheckIns());

    // Give it a tick
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockFetchMyCheckIns).not.toHaveBeenCalled();
    expect(result.current.checkIns).toEqual([]);
  });

  it('handles fetch error with Error instance', async () => {
    mockFetchMyCheckIns.mockRejectedValue(new Error('Firestore fail'));

    const { result } = renderHook(() => useMyCheckIns());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Firestore fail');
    expect(result.current.checkIns).toEqual([]);
  });

  it('handles fetch error with non-Error', async () => {
    mockFetchMyCheckIns.mockRejectedValue('unknown');

    const { result } = renderHook(() => useMyCheckIns());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('No se pudieron cargar las visitas');
  });

  it('sets isLoading true while fetching', async () => {
    let resolve!: (value: unknown[]) => void;
    mockFetchMyCheckIns.mockImplementation(() => new Promise((r) => { resolve = r; }));

    const { result } = renderHook(() => useMyCheckIns());

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    await act(async () => { resolve([]); });

    expect(result.current.isLoading).toBe(false);
  });

  it('refresh reloads data', async () => {
    mockFetchMyCheckIns.mockResolvedValue([{ id: 'ci-1', businessId: 'biz-1' }]);

    const { result } = renderHook(() => useMyCheckIns());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockFetchMyCheckIns.mockResolvedValue([
      { id: 'ci-1', businessId: 'biz-1' },
      { id: 'ci-2', businessId: 'biz-2' },
    ]);

    await act(async () => { await result.current.refresh(); });

    expect(result.current.checkIns).toHaveLength(2);
    expect(mockFetchMyCheckIns).toHaveBeenCalledTimes(2);
  });

  it('returns empty stats when no check-ins', async () => {
    mockFetchMyCheckIns.mockResolvedValue([]);

    const { result } = renderHook(() => useMyCheckIns());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stats.totalCheckIns).toBe(0);
    expect(result.current.stats.uniqueBusinesses).toBe(0);
  });
});
