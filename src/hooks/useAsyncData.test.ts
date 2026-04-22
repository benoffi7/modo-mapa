import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAsyncData } from './useAsyncData';

vi.mock('../utils/logger', () => ({ logger: { error: vi.fn() } }));

describe('useAsyncData', () => {
  it('starts with loading=true', () => {
    const fetcher = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useAsyncData(fetcher));
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(false);
  });

  it('resolves data and sets loading=false on success', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 42 });
    const { result } = renderHook(() => useAsyncData(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ value: 42 });
    expect(result.current.error).toBe(false);
  });

  it('sets error=true and loading=false on failure', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useAsyncData(fetcher));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('refetch triggers a new fetch', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });

    const { result } = renderHook(() => useAsyncData(fetcher));
    await waitFor(() => expect(result.current.data).toEqual({ count: 1 }));

    act(() => { result.current.refetch(); });
    await waitFor(() => expect(result.current.data).toEqual({ count: 2 }));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('ignores stale result when component unmounts before fetch completes', async () => {
    let resolveFirst: (val: string) => void;
    const firstPromise = new Promise<string>((r) => { resolveFirst = r; });
    const fetcher = vi.fn().mockReturnValue(firstPromise);

    const { result, unmount } = renderHook(() => useAsyncData(fetcher));
    unmount();

    // Resolve after unmount — should not cause state update
    act(() => { resolveFirst!('stale'); });
    // Still null because ignore=true
    expect(result.current.data).toBeNull();
  });
});
