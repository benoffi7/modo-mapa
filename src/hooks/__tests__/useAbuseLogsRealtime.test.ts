import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AbuseLog } from '../../types/admin';

const subscribeMock = vi.hoisted(() => vi.fn());
const unsubscribeMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/abuseLogs', () => ({
  subscribeToAbuseLogs: subscribeMock,
}));

import { useAbuseLogsRealtime } from '../useAbuseLogsRealtime';

type SnapshotCallback = (
  logs: AbuseLog[],
  changes: { type: string; id: string }[],
) => void;

type ErrorCallback = () => void;

interface CapturedSubscribe {
  maxDocs: number;
  onNext: SnapshotCallback;
  onError: ErrorCallback;
}

function makeLog(id: string): AbuseLog {
  return {
    id,
    userId: `user-${id}`,
    type: 'rate_limit',
    collection: 'comments',
    detail: '{}',
    timestamp: new Date(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  unsubscribeMock.mockReset();
  subscribeMock.mockReset();
  subscribeMock.mockImplementation(() => unsubscribeMock);
});

function captureSubscribe(): CapturedSubscribe {
  const last = subscribeMock.mock.calls.at(-1);
  if (!last) throw new Error('subscribeToAbuseLogs not called');
  return { maxDocs: last[0] as number, onNext: last[1] as SnapshotCallback, onError: last[2] as ErrorCallback };
}

describe('useAbuseLogsRealtime', () => {
  it('default enabled=true subscribes on mount', () => {
    renderHook(() => useAbuseLogsRealtime(50));
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    expect(subscribeMock.mock.calls[0][0]).toBe(50);
  });

  it('initial snapshot seeds initialIds and does not count as new', () => {
    const { result } = renderHook(() => useAbuseLogsRealtime(10));
    const { onNext } = captureSubscribe();
    act(() => {
      onNext(
        [makeLog('a'), makeLog('b')],
        [
          { type: 'added', id: 'a' },
          { type: 'added', id: 'b' },
        ],
      );
    });
    expect(result.current.logs).toHaveLength(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.newCount).toBe(0);
  });

  it('subsequent snapshots count truly new docs', () => {
    const { result } = renderHook(() => useAbuseLogsRealtime(10));
    const { onNext } = captureSubscribe();
    act(() => {
      onNext([makeLog('a')], [{ type: 'added', id: 'a' }]);
    });
    expect(result.current.newCount).toBe(0);
    act(() => {
      onNext([makeLog('b'), makeLog('a')], [{ type: 'added', id: 'b' }]);
    });
    expect(result.current.newCount).toBe(1);
  });

  it('onError sets error=true and loading=false', () => {
    const { result } = renderHook(() => useAbuseLogsRealtime(10));
    const { onError } = captureSubscribe();
    act(() => {
      onError();
    });
    expect(result.current.error).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('enabled=false does NOT subscribe and resets state', () => {
    const { result } = renderHook(() => useAbuseLogsRealtime(10, false));
    expect(subscribeMock).not.toHaveBeenCalled();
    expect(result.current.logs).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
    expect(result.current.newCount).toBe(0);
  });

  it('flip enabled true→false unsubscribes and resets state', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useAbuseLogsRealtime(10, enabled),
      { initialProps: { enabled: true } },
    );
    const { onNext } = captureSubscribe();
    act(() => {
      onNext(
        [makeLog('a'), makeLog('b')],
        [
          { type: 'added', id: 'a' },
          { type: 'added', id: 'b' },
        ],
      );
    });
    expect(result.current.logs).toHaveLength(2);

    rerender({ enabled: false });

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(result.current.logs).toBeNull();
    expect(result.current.newCount).toBe(0);
  });

  it('flip enabled false→true re-subscribes cleanly (first snapshot does not count)', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useAbuseLogsRealtime(10, enabled),
      { initialProps: { enabled: false } },
    );
    expect(subscribeMock).not.toHaveBeenCalled();

    rerender({ enabled: true });
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    const { onNext } = captureSubscribe();
    act(() => {
      onNext(
        [makeLog('a'), makeLog('b'), makeLog('c')],
        [
          { type: 'added', id: 'a' },
          { type: 'added', id: 'b' },
          { type: 'added', id: 'c' },
        ],
      );
    });

    // Re-subscribe is clean: docs already present do NOT count as "new"
    expect(result.current.newCount).toBe(0);
    expect(result.current.logs).toHaveLength(3);
  });

  it('resetNewCount clears the counter and seeds initialIds from current logs', () => {
    const { result } = renderHook(() => useAbuseLogsRealtime(10));
    const { onNext } = captureSubscribe();
    act(() => {
      onNext([makeLog('a')], [{ type: 'added', id: 'a' }]);
    });
    act(() => {
      onNext([makeLog('b'), makeLog('a')], [{ type: 'added', id: 'b' }]);
    });
    expect(result.current.newCount).toBe(1);

    act(() => {
      result.current.resetNewCount();
    });
    expect(result.current.newCount).toBe(0);

    // After reset, a new "added" doc should count as 1
    act(() => {
      onNext(
        [makeLog('c'), makeLog('b'), makeLog('a')],
        [{ type: 'added', id: 'c' }],
      );
    });
    expect(result.current.newCount).toBe(1);
  });

  it('unmount calls unsubscribe', () => {
    const { unmount } = renderHook(() => useAbuseLogsRealtime(10));
    expect(subscribeMock).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });
});
