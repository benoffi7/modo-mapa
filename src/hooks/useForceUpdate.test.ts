import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH,
  STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
  STORAGE_KEY_FORCE_UPDATE_LAST_CHECK,
  STORAGE_KEY_APP_VERSION_EVENT_EMITTED,
} from '../constants/storage';
import { MAX_FORCE_UPDATE_RELOADS } from '../constants/timing';

const mockFetchAppVersionConfig = vi.fn();

vi.mock('../services/config', () => ({
  fetchAppVersionConfig: (...args: unknown[]) => mockFetchAppVersionConfig(...args),
}));

const mockIsBusyFlagActive = vi.fn(() => false);
vi.mock('../utils/busyFlag', () => ({
  isBusyFlagActive: () => mockIsBusyFlagActive(),
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
    localStorage.clear();
    sessionStorage.clear();
    mockIsBusyFlagActive.mockReturnValue(false);
  });

  function mockConfig(minVersion: string | undefined, source = 'server') {
    mockFetchAppVersionConfig.mockResolvedValue({ minVersion, source });
  }

  function mockConfigError() {
    mockFetchAppVersionConfig.mockRejectedValue(new Error('offline'));
  }

  it('triggers reload when server version > client version', async () => {
    mockConfig('2.31.0');

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    expect(result.status).toBe('reloading');
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

    expect(result.status).toBe('up-to-date');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('does NOT reload when server version < client version', async () => {
    mockConfig('2.29.0');

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    expect(result.status).toBe('up-to-date');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('handles non-existent doc without error (minVersion undefined)', async () => {
    mockConfig(undefined);

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    expect(result.status).toBe('up-to-date');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('handles service error without crash', async () => {
    mockConfigError();

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    expect(result.status).toBe('error');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('respects cooldown from localStorage', async () => {
    localStorage.setItem(STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH, String(Date.now()));
    mockConfig('2.31.0');

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    expect(result.status).toBe('up-to-date');
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

    expect(result.status).toBe('limit-reached');
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
    expect(result.status).toBe('reloading');
    expect(mockReload).toHaveBeenCalled();
  });

  it('handles corrupted localStorage gracefully', async () => {
    localStorage.setItem(STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT, 'not-json');
    mockConfig('2.31.0');

    const { _checkVersion } = await import('./useForceUpdate');
    const result = await _checkVersion();

    // Corrupted data treated as count: 0, so reload proceeds
    expect(result.status).toBe('reloading');
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

  // ── STORAGE_KEY_FORCE_UPDATE_LAST_CHECK written on all paths ─────────

  describe('writeLastCheck — written on all checkVersion paths', () => {
    it('writes last check timestamp on up-to-date path (no minVersion)', async () => {
      mockConfig(undefined, 'server');

      const { _checkVersion } = await import('./useForceUpdate');
      await _checkVersion();

      const stored = localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_LAST_CHECK);
      expect(stored).toBeTruthy();
      expect(Number(stored)).toBeGreaterThan(0);
    });

    it('writes last check timestamp on up-to-date path (minVersion present but not required)', async () => {
      mockConfig('2.30.0', 'server');

      const { _checkVersion } = await import('./useForceUpdate');
      await _checkVersion();

      const stored = localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_LAST_CHECK);
      expect(stored).toBeTruthy();
      expect(Number(stored)).toBeGreaterThan(0);
    });

    it('writes last check timestamp on error path', async () => {
      mockConfigError();

      const { _checkVersion } = await import('./useForceUpdate');
      await _checkVersion();

      const stored = localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_LAST_CHECK);
      expect(stored).toBeTruthy();
      expect(Number(stored)).toBeGreaterThan(0);
    });

    it('writes last check timestamp on reloading path', async () => {
      // Prevent actual reload from interfering
      mockReload.mockImplementation(() => undefined);
      mockConfig('2.31.0', 'server');

      const { _checkVersion: checkV } = await import('./useForceUpdate');
      await checkV();

      const stored = localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_LAST_CHECK);
      expect(stored).toBeTruthy();
      expect(Number(stored)).toBeGreaterThan(0);
    });
  });

  // ── visibilitychange + online listeners trigger run() ─────────────────

  describe('listeners — visibilitychange and online trigger run()', () => {
    // These tests override import.meta.env.DEV to false via vi.stubEnv,
    // since the hook early-returns in DEV mode.

    it('calls fetchAppVersionConfig again on visibilitychange → visible', async () => {
      vi.stubEnv('DEV', false);
      mockConfig('2.30.3', 'server');

      const { useForceUpdate } = await import('./useForceUpdate');

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });

      await act(async () => {
        renderHook(() => useForceUpdate());
        // Allow initial run() to settle
        await Promise.resolve();
      });

      const callsAfterMount = mockFetchAppVersionConfig.mock.calls.length;
      expect(callsAfterMount).toBeGreaterThanOrEqual(1);

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });

      expect(mockFetchAppVersionConfig.mock.calls.length).toBeGreaterThan(callsAfterMount);

      vi.unstubAllEnvs();
    });

    it('does NOT call fetchAppVersionConfig on visibilitychange → hidden', async () => {
      vi.stubEnv('DEV', false);
      mockConfig('2.30.3', 'server');

      const { useForceUpdate } = await import('./useForceUpdate');

      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });

      await act(async () => {
        renderHook(() => useForceUpdate());
        await Promise.resolve();
      });

      const callsAfterMount = mockFetchAppVersionConfig.mock.calls.length;

      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });

      // Listener should NOT call run() when hidden
      expect(mockFetchAppVersionConfig.mock.calls.length).toBe(callsAfterMount);

      // Restore visible for other tests
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      vi.unstubAllEnvs();
    });

    it('calls fetchAppVersionConfig again on online event', async () => {
      vi.stubEnv('DEV', false);
      mockConfig('2.30.3', 'server');

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });

      const { useForceUpdate } = await import('./useForceUpdate');

      await act(async () => {
        renderHook(() => useForceUpdate());
        await Promise.resolve();
      });

      const callsAfterMount = mockFetchAppVersionConfig.mock.calls.length;
      expect(callsAfterMount).toBeGreaterThanOrEqual(1);

      await act(async () => {
        window.dispatchEvent(new Event('online'));
        await Promise.resolve();
      });

      expect(mockFetchAppVersionConfig.mock.calls.length).toBeGreaterThan(callsAfterMount);

      vi.unstubAllEnvs();
    });
  });

  // ── EVT_APP_VERSION_ACTIVE emission rules ──────────────────────────────

  describe('EVT_APP_VERSION_ACTIVE emission', () => {
    it('emits app_version_active when source is server and status is up-to-date', async () => {
      mockConfig(undefined, 'server');

      // Simulate the hook logic: check if sessionStorage flag is absent, then emit
      sessionStorage.removeItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED);

      // We test via the hook's run() logic by using renderHook with DEV=false
      vi.stubEnv('DEV', false);
      const { useForceUpdate } = await import('./useForceUpdate');

      await act(async () => {
        renderHook(() => useForceUpdate());
        await Promise.resolve();
      });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        'app_version_active',
        expect.objectContaining({ source: 'server' }),
      );

      vi.unstubAllEnvs();
    });

    it('emits app_version_active when source is server-retry and status is up-to-date', async () => {
      mockConfig(undefined, 'server-retry');
      sessionStorage.removeItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED);
      vi.stubEnv('DEV', false);

      const { useForceUpdate } = await import('./useForceUpdate');

      await act(async () => {
        renderHook(() => useForceUpdate());
        await Promise.resolve();
      });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        'app_version_active',
        expect.objectContaining({ source: 'server-retry' }),
      );

      vi.unstubAllEnvs();
    });

    it('emits app_version_active when source is empty and status is up-to-date', async () => {
      mockConfig(undefined, 'empty');
      sessionStorage.removeItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED);
      vi.stubEnv('DEV', false);

      const { useForceUpdate } = await import('./useForceUpdate');

      await act(async () => {
        renderHook(() => useForceUpdate());
        await Promise.resolve();
      });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        'app_version_active',
        expect.objectContaining({ source: 'empty' }),
      );

      vi.unstubAllEnvs();
    });

    it('does NOT emit app_version_active when source is cache', async () => {
      mockConfig(undefined, 'cache');
      sessionStorage.removeItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED);
      vi.stubEnv('DEV', false);

      const { useForceUpdate } = await import('./useForceUpdate');

      await act(async () => {
        renderHook(() => useForceUpdate());
        await Promise.resolve();
      });

      const appVersionActiveCalls = mockTrackEvent.mock.calls.filter(
        (call) => call[0] === 'app_version_active',
      );
      expect(appVersionActiveCalls).toHaveLength(0);

      vi.unstubAllEnvs();
    });

    it('does NOT emit app_version_active when fetchAppVersionConfig throws (error status)', async () => {
      mockConfigError();
      sessionStorage.removeItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED);
      vi.stubEnv('DEV', false);

      const { useForceUpdate } = await import('./useForceUpdate');

      await act(async () => {
        renderHook(() => useForceUpdate());
        await Promise.resolve();
      });

      const appVersionActiveCalls = mockTrackEvent.mock.calls.filter(
        (call) => call[0] === 'app_version_active',
      );
      expect(appVersionActiveCalls).toHaveLength(0);

      vi.unstubAllEnvs();
    });

    it('does NOT emit app_version_active when session flag already set', async () => {
      mockConfig(undefined, 'server');
      sessionStorage.setItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED, '1');
      vi.stubEnv('DEV', false);

      const { useForceUpdate } = await import('./useForceUpdate');

      await act(async () => {
        renderHook(() => useForceUpdate());
        await Promise.resolve();
      });

      const appVersionActiveCalls = mockTrackEvent.mock.calls.filter(
        (call) => call[0] === 'app_version_active',
      );
      expect(appVersionActiveCalls).toHaveLength(0);

      vi.unstubAllEnvs();
    });

    it('emits app_version_active only once (one-shot) even if run() is called multiple times', async () => {
      mockConfig(undefined, 'server');
      sessionStorage.removeItem(STORAGE_KEY_APP_VERSION_EVENT_EMITTED);
      vi.stubEnv('DEV', false);

      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });

      const { useForceUpdate } = await import('./useForceUpdate');

      await act(async () => {
        renderHook(() => useForceUpdate());
        await Promise.resolve();
      });

      // Trigger run() a second time via online event
      await act(async () => {
        window.dispatchEvent(new Event('online'));
        await Promise.resolve();
      });

      const appVersionActiveCalls = mockTrackEvent.mock.calls.filter(
        (call) => call[0] === 'app_version_active',
      );
      expect(appVersionActiveCalls).toHaveLength(1);

      vi.unstubAllEnvs();
    });
  });

  // ── isBusyFlagActive prevents reload ──────────────────────────────────

  describe('isBusyFlagActive() — defers reload', () => {
    it('returns up-to-date without reloading when busy flag is active', async () => {
      mockIsBusyFlagActive.mockReturnValue(true);
      mockConfig('2.31.0', 'server');

      const { _checkVersion } = await import('./useForceUpdate');
      const result = await _checkVersion();

      expect(result.status).toBe('up-to-date');
      expect(mockReload).not.toHaveBeenCalled();
    });

    it('includes minVersion in result when busy flag defers reload', async () => {
      mockIsBusyFlagActive.mockReturnValue(true);
      mockConfig('2.31.0', 'server');

      const { _checkVersion } = await import('./useForceUpdate');
      const result = await _checkVersion();

      expect(result.minVersion).toBe('2.31.0');
    });
  });
});
