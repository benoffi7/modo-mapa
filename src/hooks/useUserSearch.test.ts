import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockSearchUsers, mockLoggerError } = vi.hoisted(() => ({
  mockSearchUsers: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('../services/users', () => ({
  searchUsers: (...args: unknown[]) => mockSearchUsers(...args),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: vi.fn(),
    log: vi.fn(),
  },
}));

import { useUserSearch } from './useUserSearch';

describe('useUserSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initial state: empty results, not searching', () => {
    const { result } = renderHook(() => useUserSearch());
    expect(result.current.results).toEqual([]);
    expect(result.current.searching).toBe(false);
  });

  it('term="" clears results and does not call searchUsers', () => {
    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.search('');
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.searching).toBe(false);
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('term="a" (1 char) is below threshold and does not call searchUsers', () => {
    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.search('a');
    });

    expect(mockSearchUsers).not.toHaveBeenCalled();
    expect(result.current.searching).toBe(false);
  });

  it('does NOT call searchUsers before 300ms have passed', () => {
    mockSearchUsers.mockResolvedValue([]);
    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.search('alice');
    });

    expect(result.current.searching).toBe(true);

    act(() => {
      vi.advanceTimersByTime(299);
    });

    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('calls searchUsers after 300ms and sets results on success', async () => {
    const fakeResults = [{ userId: 'u1', displayName: 'Alice' }];
    mockSearchUsers.mockResolvedValue(fakeResults);

    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.search('alice');
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockSearchUsers).toHaveBeenCalledWith('alice');
    expect(result.current.results).toEqual(fakeResults);
    expect(result.current.searching).toBe(false);
  });

  it('calls logger.error and resets results on searchUsers rejection', async () => {
    mockSearchUsers.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.search('alice');
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockLoggerError).toHaveBeenCalledWith(
      'User search failed:',
      expect.any(Error),
    );
    expect(result.current.results).toEqual([]);
    expect(result.current.searching).toBe(false);
  });

  it('clear() cancels pending debounced timer', () => {
    mockSearchUsers.mockResolvedValue([]);
    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.search('alice');
    });
    expect(result.current.searching).toBe(true);

    act(() => {
      result.current.clear();
    });
    expect(result.current.searching).toBe(false);

    // Advance past debounce — searchUsers should never have been called
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mockSearchUsers).not.toHaveBeenCalled();
  });

  it('consecutive calls cancel previous timer (only last one fires)', async () => {
    mockSearchUsers.mockResolvedValue([{ userId: 'u1', displayName: 'Bob' }]);
    const { result } = renderHook(() => useUserSearch());

    act(() => {
      result.current.search('alice');
    });

    act(() => {
      vi.advanceTimersByTime(200);
      result.current.search('bob');
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockSearchUsers).toHaveBeenCalledTimes(1);
    expect(mockSearchUsers).toHaveBeenCalledWith('bob');
  });
});
