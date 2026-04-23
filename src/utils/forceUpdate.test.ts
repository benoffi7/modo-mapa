import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH,
  STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
} from '../constants/storage';
import { FORCE_UPDATE_COOLDOWN_MS, MAX_FORCE_UPDATE_RELOADS } from '../constants/timing';
import {
  isCooldownActive,
  getReloadCount,
  incrementReloadCount,
  isReloadLimitReached,
} from './forceUpdate';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ── isCooldownActive ─────────────────────────────────────────────────────────

describe('isCooldownActive', () => {
  it('returns false when localStorage key is absent', () => {
    expect(isCooldownActive()).toBe(false);
  });

  it('returns true when last refresh is within the cooldown window', () => {
    localStorage.setItem(STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH, String(Date.now() - 1000));
    expect(isCooldownActive()).toBe(true);
  });

  it('returns false when last refresh is outside the cooldown window', () => {
    const expired = Date.now() - FORCE_UPDATE_COOLDOWN_MS - 1000;
    localStorage.setItem(STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH, String(expired));
    expect(isCooldownActive()).toBe(false);
  });

  it('returns false when localStorage.getItem throws', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(isCooldownActive()).toBe(false);
  });
});

// ── getReloadCount ───────────────────────────────────────────────────────────

describe('getReloadCount', () => {
  it('returns defaults when key is absent', () => {
    expect(getReloadCount()).toEqual({ count: 0, firstAt: 0 });
  });

  it('returns parsed values from valid JSON', () => {
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: 2, firstAt: 1700000000000 }),
    );
    expect(getReloadCount()).toEqual({ count: 2, firstAt: 1700000000000 });
  });

  it('returns defaults when JSON has non-numeric fields', () => {
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: 'two', firstAt: null }),
    );
    expect(getReloadCount()).toEqual({ count: 0, firstAt: 0 });
  });

  it('returns defaults when JSON is malformed', () => {
    localStorage.setItem(STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT, 'not-json{{{');
    expect(getReloadCount()).toEqual({ count: 0, firstAt: 0 });
  });
});

// ── incrementReloadCount ─────────────────────────────────────────────────────

describe('incrementReloadCount', () => {
  it('sets count to 1 and records firstAt on first use', () => {
    const before = Date.now();
    incrementReloadCount();
    const result = getReloadCount();
    expect(result.count).toBe(1);
    expect(result.firstAt).toBeGreaterThanOrEqual(before);
  });

  it('increments count on second call within the same window', () => {
    const firstAt = Date.now();
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: 1, firstAt }),
    );
    incrementReloadCount();
    const result = getReloadCount();
    expect(result.count).toBe(2);
    expect(result.firstAt).toBe(firstAt);
  });

  it('resets count to 1 when the window has expired', () => {
    const expiredFirstAt = Date.now() - FORCE_UPDATE_COOLDOWN_MS - 5000;
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: MAX_FORCE_UPDATE_RELOADS, firstAt: expiredFirstAt }),
    );
    const before = Date.now();
    incrementReloadCount();
    const result = getReloadCount();
    expect(result.count).toBe(1);
    expect(result.firstAt).toBeGreaterThanOrEqual(before);
  });

  it('does not crash when localStorage throws', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    expect(() => incrementReloadCount()).not.toThrow();
  });
});

// ── isReloadLimitReached ─────────────────────────────────────────────────────

describe('isReloadLimitReached', () => {
  it('returns false when count is below the limit', () => {
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: MAX_FORCE_UPDATE_RELOADS - 1, firstAt: Date.now() }),
    );
    expect(isReloadLimitReached()).toBe(false);
  });

  it('returns true when count equals the limit', () => {
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: MAX_FORCE_UPDATE_RELOADS, firstAt: Date.now() }),
    );
    expect(isReloadLimitReached()).toBe(true);
  });

  it('returns true when count exceeds the limit', () => {
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: MAX_FORCE_UPDATE_RELOADS + 5, firstAt: Date.now() }),
    );
    expect(isReloadLimitReached()).toBe(true);
  });

  it('returns false when the window has expired even if count is high', () => {
    const expiredFirstAt = Date.now() - FORCE_UPDATE_COOLDOWN_MS - 5000;
    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({ count: MAX_FORCE_UPDATE_RELOADS + 10, firstAt: expiredFirstAt }),
    );
    expect(isReloadLimitReached()).toBe(false);
  });
});
