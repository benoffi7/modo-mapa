import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH,
  STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
} from '../constants/storage';
import { MAX_FORCE_UPDATE_RELOADS } from '../constants/timing';

const mockFetchAppVersionConfig = vi.fn();

vi.mock('../services/config', () => ({
  fetchAppVersionConfig: (...args: unknown[]) => mockFetchAppVersionConfig(...args),
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

// We test the core logic by importing internal functions.
// The hook has a DEV guard — in vitest, import.meta.env.DEV is true.

describe('useForceUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH);
    localStorage.removeItem(STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT);
  });

  function mockConfig(minVersion: string | undefined) {
    mockFetchAppVersionConfig.mockResolvedValue({ minVersion });
  }

  function mockConfigError() {
    mockFetchAppVersionConfig.mockRejectedValue(new Error('offline'));
  }

  it('triggers reload when server version > client version', async () => {
    mockConfig('2.31.0');

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    expect(result).toBe('reloading');
    expect(mockTrackEvent).toHaveBeenCalledWith('force_update_triggered', {
      from: '2.30.3',
      to: '2.31.0',
    });
    expect(mockUnregister).toHaveBeenCalled();
    expect(mockReload).toHaveBeenCalled();
  });

  it('does NOT reload when server version == client version', async () => {
    mockConfig('2.30.3');

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    expect(result).toBe('up-to-date');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('does NOT reload when server version < client version', async () => {
    mockConfig('2.29.0');

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    expect(result).toBe('up-to-date');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('handles non-existent doc without error (minVersion undefined)', async () => {
    mockConfig(undefined);

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    expect(result).toBe('up-to-date');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('handles service error without crash', async () => {
    mockConfigError();

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    expect(result).toBe('error');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('respects cooldown from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH, String(Date.now()));
    mockConfig('2.31.0');

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    expect(result).toBe('up-to-date');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('increments reload counter in localStorage', async () => {
    mockConfig('2.31.0');

    const { _checkVersion } = await import('./useForceUpdate');
    await _checkVersion();

    const raw = localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.count).toBe(1);
    expect(parsed.firstAt).toBeGreaterThan(0);
  });

  it('stops reloading after MAX_FORCE_UPDATE_RELOADS', async () => {
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: MAX_FORCE_UPDATE_RELOADS, firstAt: Date.now() }),
    );
    mockConfig('2.31.0');

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    expect(result).toBe('limit-reached');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('resets counter when cooldown window expires', async () => {
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: MAX_FORCE_UPDATE_RELOADS, firstAt: Date.now() - 6 * 60 * 1000 }),
    );
    mockConfig('2.31.0');

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    // Window expired, so counter resets and reload proceeds
    expect(result).toBe('reloading');
    expect(mockReload).toHaveBeenCalled();
  });

  it('handles corrupted localStorage gracefully', async () => {
    localStorage.setItem(STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT, 'not-json');
    mockConfig('2.31.0');

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    // Corrupted data treated as count: 0, so reload proceeds
    expect(result).toBe('reloading');
    expect(mockReload).toHaveBeenCalled();
  });

  it('tracks EVT_FORCE_UPDATE_LIMIT_REACHED analytics', async () => {
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: MAX_FORCE_UPDATE_RELOADS, firstAt: Date.now() }),
    );
    mockConfig('2.31.0');

    const { _checkVersion } = await import('./useForceUpdate');
    await _checkVersion();

    expect(mockTrackEvent).toHaveBeenCalledWith('force_update_limit_reached', {
      from: '2.30.3',
      to: '2.31.0',
      reloadCount: MAX_FORCE_UPDATE_RELOADS,
    });
  });

  it('_getReloadCount returns defaults for missing data', async () => {
    const { _getReloadCount } = await import('./useForceUpdate');
    const result = _getReloadCount();

    expect(result).toEqual({ count: 0, firstAt: 0 });
  });

  it('_isReloadLimitReached returns false when under limit', async () => {
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: 1, firstAt: Date.now() }),
    );

    const { _isReloadLimitReached } = await import('./useForceUpdate');
    expect(_isReloadLimitReached()).toBe(false);
  });

  it('_isReloadLimitReached returns true when at limit', async () => {
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: MAX_FORCE_UPDATE_RELOADS, firstAt: Date.now() }),
    );

    const { _isReloadLimitReached } = await import('./useForceUpdate');
    expect(_isReloadLimitReached()).toBe(true);
  });

  it('sets up and cleans up interval on mount/unmount', async () => {
    vi.useFakeTimers();
    mockConfig('2.30.3');

    const { useForceUpdate } = await import('./useForceUpdate');

    const { unmount } = renderHook(() => useForceUpdate());

    // In DEV mode (vitest), the hook returns early, so interval won't be set.
    // This test verifies the hook doesn't crash on mount/unmount.
    unmount();

    vi.useRealTimers();
  });
});
