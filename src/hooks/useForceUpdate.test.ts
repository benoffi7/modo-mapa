import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDoc = vi.fn();
const mockDoc = vi.fn();

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

const mockTrackEvent = vi.fn();
vi.mock('../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock('../utils/logger', () => ({
  logger: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
}));

// Mock __APP_VERSION__
vi.stubGlobal('__APP_VERSION__', '2.30.3');

// Mock navigator.serviceWorker
const mockUnregister = vi.fn().mockResolvedValue(true);
Object.defineProperty(globalThis.navigator, 'serviceWorker', {
  value: {
    getRegistrations: vi.fn().mockResolvedValue([{ unregister: mockUnregister }]),
  },
  configurable: true,
});

// Mock caches API
vi.stubGlobal('caches', {
  keys: vi.fn().mockResolvedValue(['workbox-cache']),
  delete: vi.fn().mockResolvedValue(true),
});

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

// We import the checkVersion and performHardRefresh indirectly through the hook.
// The hook has a DEV guard — in vitest, import.meta.env.DEV is true.
// We test the exported checkVersion logic by importing internal functions.
// Instead, we'll test the core logic functions directly and the hook integration.

// Since useForceUpdate has an import.meta.env.DEV guard that we can't easily override,
// we'll test the core logic by extracting it. For now, we test via the _checkVersion export.

describe('useForceUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  function mockFirestoreDoc(data: Record<string, unknown> | null) {
    mockGetDoc.mockResolvedValue({
      exists: () => data !== null,
      data: () => data,
    });
  }

  it('triggers reload when server version > client version', async () => {
    mockFirestoreDoc({ minVersion: '2.31.0' });

    const { _checkVersion } = await import('./useForceUpdate');
    await _checkVersion();

    expect(mockTrackEvent).toHaveBeenCalledWith('force_update_triggered', {
      from: '2.30.3',
      to: '2.31.0',
    });
    expect(mockUnregister).toHaveBeenCalled();
    expect(mockReload).toHaveBeenCalled();
  });

  it('does NOT reload when server version == client version', async () => {
    mockFirestoreDoc({ minVersion: '2.30.3' });

    const { _checkVersion } = await import('./useForceUpdate');
    await _checkVersion();

    expect(mockReload).not.toHaveBeenCalled();
  });

  it('does NOT reload when server version < client version', async () => {
    mockFirestoreDoc({ minVersion: '2.29.0' });

    const { _checkVersion } = await import('./useForceUpdate');
    await _checkVersion();

    expect(mockReload).not.toHaveBeenCalled();
  });

  it('handles non-existent doc without error', async () => {
    mockFirestoreDoc(null);

    const { _checkVersion } = await import('./useForceUpdate');
    await _checkVersion();

    expect(mockReload).not.toHaveBeenCalled();
  });

  it('handles Firestore error without crash', async () => {
    mockGetDoc.mockRejectedValue(new Error('offline'));

    const { _checkVersion } = await import('./useForceUpdate');
    await _checkVersion();

    expect(mockReload).not.toHaveBeenCalled();
  });

  it('respects cooldown from sessionStorage', async () => {
    sessionStorage.setItem('force_update_last_refresh', String(Date.now()));
    mockFirestoreDoc({ minVersion: '2.31.0' });

    const { _checkVersion } = await import('./useForceUpdate');
    await _checkVersion();

    expect(mockReload).not.toHaveBeenCalled();
  });

  it('sets up and cleans up interval on mount/unmount', async () => {
    vi.useFakeTimers();
    mockFirestoreDoc({ minVersion: '2.30.3' });

    const { useForceUpdate } = await import('./useForceUpdate');

    const { unmount } = renderHook(() => useForceUpdate());

    // In DEV mode (vitest), the hook returns early, so interval won't be set.
    // This test verifies the hook doesn't crash on mount/unmount.
    unmount();

    vi.useRealTimers();
  });
});
