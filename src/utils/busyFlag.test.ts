import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./logger', () => ({ logger: { warn: vi.fn() } }));
vi.mock('../constants/timing', () => ({
  BUSY_FLAG_MAX_AGE_MS: 180_000,
  BUSY_FLAG_HEARTBEAT_MS: 30_000,
}));
vi.mock('../constants/storage', () => ({
  STORAGE_KEY_FORCE_UPDATE_BUSY: 'force_update_busy',
}));

import { withBusyFlag, isBusyFlagActive, _writeBusyFlag, _readBusyFlag } from './busyFlag';

const STORAGE_KEY = 'force_update_busy';

describe('busyFlag', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // withBusyFlag — happy path
  // ---------------------------------------------------------------------------

  describe('withBusyFlag — happy path', () => {
    it('sets the flag before fn executes and clears it after success', async () => {
      let flagDuringExecution = false;
      await withBusyFlag('upload', async () => {
        flagDuringExecution = isBusyFlagActive();
      });

      expect(flagDuringExecution).toBe(true);
      expect(isBusyFlagActive()).toBe(false);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('clears the flag in finally even when fn rejects with a regular error', async () => {
      await expect(
        withBusyFlag('upload', async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(isBusyFlagActive()).toBe(false);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('clears the flag when fn rejects with an AbortError', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');

      await expect(
        withBusyFlag('upload', async () => {
          throw abortError;
        }),
      ).rejects.toThrow('Aborted');

      expect(isBusyFlagActive()).toBe(false);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // isBusyFlagActive
  // ---------------------------------------------------------------------------

  describe('isBusyFlagActive', () => {
    it('returns true with a fresh flag (recent startedAt, count=1)', () => {
      _writeBusyFlag({ startedAt: Date.now(), kind: 'upload', count: 1 });
      expect(isBusyFlagActive()).toBe(true);
    });

    it('returns false when sessionStorage is empty', () => {
      expect(isBusyFlagActive()).toBe(false);
    });

    it('returns false when the flag is stale (startedAt > BUSY_FLAG_MAX_AGE_MS)', () => {
      const staleTime = Date.now() - 181_000; // 181s > 180s max age
      _writeBusyFlag({ startedAt: staleTime, kind: 'upload', count: 1 });
      expect(isBusyFlagActive()).toBe(false);
    });

    it('returns false when count is 0', () => {
      _writeBusyFlag({ startedAt: Date.now(), kind: 'upload', count: 0 });
      expect(isBusyFlagActive()).toBe(false);
    });

    it('returns false and does not crash with malformed JSON in sessionStorage', () => {
      sessionStorage.setItem(STORAGE_KEY, '{invalid json{{');
      expect(() => isBusyFlagActive()).not.toThrow();
      expect(isBusyFlagActive()).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Refcount — concurrency
  // ---------------------------------------------------------------------------

  describe('refcount — concurrency', () => {
    it('keeps flag active until both concurrent operations resolve', async () => {
      let resolveP1!: () => void;
      let resolveP2!: () => void;

      const p1 = withBusyFlag(
        'upload',
        () =>
          new Promise<void>((resolve) => {
            resolveP1 = resolve;
          }),
      );
      const p2 = withBusyFlag(
        'upload',
        () =>
          new Promise<void>((resolve) => {
            resolveP2 = resolve;
          }),
      );

      // Both started: count should be 2, flag active
      expect(isBusyFlagActive()).toBe(true);
      const flagAfterBothStart = _readBusyFlag();
      expect(flagAfterBothStart?.count).toBe(2);

      // Resolve p1 — flag should still be active (count=1)
      resolveP1();
      await p1;
      expect(isBusyFlagActive()).toBe(true);
      expect(_readBusyFlag()?.count).toBe(1);

      // Resolve p2 — flag should be gone
      resolveP2();
      await p2;
      expect(isBusyFlagActive()).toBe(false);
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Heartbeat — visibility-aware
  // ---------------------------------------------------------------------------

  describe('heartbeat — visibility-aware', () => {
    it('updates startedAt when document is visible', async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });

      vi.useFakeTimers();
      const initialTime = Date.now();

      // Write a flag manually to simulate an in-flight operation
      _writeBusyFlag({ startedAt: initialTime, kind: 'upload', count: 1 });

      // Advance time so startedAt will differ after heartbeat
      vi.advanceTimersByTime(5_000);

      // Simulate heartbeat by capturing it from withBusyFlag
      let capturedHeartbeat!: () => void;
      const p = withBusyFlag('upload', async (heartbeat) => {
        capturedHeartbeat = heartbeat;
      });
      await p;

      // Write fresh flag and call heartbeat
      _writeBusyFlag({ startedAt: initialTime, kind: 'upload', count: 1 });
      vi.advanceTimersByTime(10_000);
      const timeBeforeHeartbeat = Date.now();
      capturedHeartbeat();

      const after = _readBusyFlag();
      expect(after).not.toBeNull();
      expect(after!.startedAt).toBeGreaterThanOrEqual(timeBeforeHeartbeat);
    });

    it('does not update startedAt when document is hidden', async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });

      const fixedTime = Date.now();
      _writeBusyFlag({ startedAt: fixedTime, kind: 'upload', count: 1 });

      let capturedHeartbeat!: () => void;
      const p = withBusyFlag('upload', async (heartbeat) => {
        capturedHeartbeat = heartbeat;
      });
      await p;

      // Restore flag (withBusyFlag decremented it) and call heartbeat
      _writeBusyFlag({ startedAt: fixedTime, kind: 'upload', count: 1 });
      capturedHeartbeat();

      const after = _readBusyFlag();
      // startedAt should not have been updated (heartbeat is no-op when hidden)
      expect(after!.startedAt).toBe(fixedTime);

      // Cleanup
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
    });
  });
});
