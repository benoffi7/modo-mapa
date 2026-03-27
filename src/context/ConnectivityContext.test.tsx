import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAll = vi.fn();
const mockCount = vi.fn();
const mockRemove = vi.fn();
const mockBulkUpdateStatus = vi.fn();
const mockSubscribe = vi.fn();
const mockProcessQueue = vi.fn();
const mockTrackEvent = vi.fn();
const mockToast = { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };

vi.mock('../services/offlineQueue', () => ({
  getAll: (...args: unknown[]) => mockGetAll(...args),
  count: (...args: unknown[]) => mockCount(...args),
  remove: (...args: unknown[]) => mockRemove(...args),
  bulkUpdateStatus: (...args: unknown[]) => mockBulkUpdateStatus(...args),
  subscribe: (...args: unknown[]) => mockSubscribe(...args),
}));

vi.mock('../services/syncEngine', () => ({
  processQueue: (...args: unknown[]) => mockProcessQueue(...args),
}));

vi.mock('../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock('./ToastContext', () => ({
  useToast: () => mockToast,
}));

vi.mock('../constants/analyticsEvents', () => ({
  EVT_OFFLINE_SYNC_COMPLETED: 'offline_sync_completed',
  EVT_OFFLINE_SYNC_FAILED: 'offline_sync_failed',
  EVT_OFFLINE_ACTION_DISCARDED: 'offline_action_discarded',
}));

vi.mock('../constants/offline', () => ({
  CONNECTIVITY_CHECK_URL: '/favicon.ico',
  CONNECTIVITY_CHECK_TIMEOUT_MS: 5000,
}));

import { ConnectivityProvider, useConnectivity } from './ConnectivityContext';

function wrapper({ children }: { children: ReactNode }) {
  return <ConnectivityProvider>{children}</ConnectivityProvider>;
}

describe('ConnectivityContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
    mockRemove.mockResolvedValue(undefined);
    mockBulkUpdateStatus.mockResolvedValue(undefined);
    mockSubscribe.mockReturnValue(() => {});
    mockProcessQueue.mockResolvedValue(undefined);
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
    // Reset fetch mock
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response()));
  });

  it('throws when useConnectivity is used outside provider', () => {
    expect(() => {
      renderHook(() => useConnectivity());
    }).toThrow('useConnectivity must be used within a ConnectivityProvider');
  });

  it('provides initial online state', async () => {
    const { result } = renderHook(() => useConnectivity(), { wrapper });

    expect(result.current.isOffline).toBe(false);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.pendingActionsCount).toBe(0);
    expect(result.current.pendingActions).toEqual([]);
  });

  it('starts as offline when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    expect(result.current.isOffline).toBe(true);
  });

  it('subscribes to offline queue on mount', () => {
    renderHook(() => useConnectivity(), { wrapper });
    expect(mockSubscribe).toHaveBeenCalled();
    expect(mockGetAll).toHaveBeenCalled();
  });

  it('loads pending actions from queue', async () => {
    const actions = [
      { id: '1', type: 'checkin', status: 'pending' },
      { id: '2', type: 'rating', status: 'pending' },
    ];
    mockGetAll.mockResolvedValue(actions);

    const { result } = renderHook(() => useConnectivity(), { wrapper });

    await waitFor(() => expect(result.current.pendingActionsCount).toBe(2));
    expect(result.current.pendingActions).toEqual(actions);
  });

  it('handles offline event', async () => {
    const { result } = renderHook(() => useConnectivity(), { wrapper });

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOffline).toBe(true);
  });

  it('handles online event with real connectivity check', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useConnectivity(), { wrapper });
    expect(result.current.isOffline).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current.isOffline).toBe(false));
  });

  it('stays offline if real connectivity check fails', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    const fetchMock = vi.fn().mockRejectedValue(new Error('No network'));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useConnectivity(), { wrapper });
    expect(result.current.isOffline).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    // Should stay offline since connectivity check failed
    expect(result.current.isOffline).toBe(true);
  });

  it('discardAction removes from queue and tracks event', async () => {
    const actions = [
      { id: 'action-1', type: 'checkin', businessId: 'biz-1', status: 'pending' },
    ];
    mockGetAll.mockResolvedValue(actions);

    const { result } = renderHook(() => useConnectivity(), { wrapper });
    await waitFor(() => expect(result.current.pendingActionsCount).toBe(1));

    await act(async () => {
      await result.current.discardAction('action-1');
    });

    expect(mockRemove).toHaveBeenCalledWith('action-1');
    expect(mockTrackEvent).toHaveBeenCalledWith('offline_action_discarded', {
      action_type: 'checkin',
      business_id: 'biz-1',
    });
  });

  it('discardAction does not track when action not found', async () => {
    mockGetAll.mockResolvedValue([]);

    const { result } = renderHook(() => useConnectivity(), { wrapper });
    await waitFor(() => expect(mockGetAll).toHaveBeenCalled());

    await act(async () => {
      await result.current.discardAction('nonexistent');
    });

    expect(mockRemove).toHaveBeenCalledWith('nonexistent');
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  it('retryFailed resets failed actions to pending', async () => {
    const actions = [
      { id: '1', type: 'checkin', status: 'failed' },
      { id: '2', type: 'rating', status: 'pending' },
      { id: '3', type: 'comment', status: 'failed' },
    ];
    mockGetAll.mockResolvedValue(actions);

    const { result } = renderHook(() => useConnectivity(), { wrapper });
    await waitFor(() => expect(result.current.pendingActionsCount).toBe(3));

    await act(async () => {
      await result.current.retryFailed();
    });

    expect(mockBulkUpdateStatus).toHaveBeenCalledWith(['1', '3'], 'pending', 0);
  });

  it('cleans up event listeners on unmount', () => {
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useConnectivity(), { wrapper });
    unmount();

    expect(removeListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    removeListenerSpy.mockRestore();
  });
});
