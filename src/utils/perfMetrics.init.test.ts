import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Top-level mocks (hoisted) ---

const mockCallable = vi.fn().mockResolvedValue({ data: 'ok' });

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

vi.mock('firebase/firestore', () => ({
  getDocs: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  functions: {},
}));

vi.mock('../constants/performance', () => ({
  PERF_FLUSH_DELAY_MS: 100,
}));

vi.mock('./analytics', () => ({
  trackEvent: vi.fn(),
}));

// --- MockPerformanceObserver ---

type PerfObserverCallback = (list: { getEntries: () => PerformanceEntry[] }) => void;

const observerCallbacks = new Map<string, PerfObserverCallback>();

class MockPerformanceObserver {
  private callback: PerfObserverCallback;
  observe(options: { type?: string }): void {
    if (options.type) {
      observerCallbacks.set(options.type, this.callback);
    }
  }
  disconnect(): void { /* noop */ }
  constructor(callback: PerfObserverCallback) {
    this.callback = callback;
  }
}

// --- Helpers ---

function triggerObserver(type: string, entries: Partial<PerformanceEntry & { value?: number; hadRecentInput?: boolean; responseStart?: number }>[]) {
  const cb = observerCallbacks.get(type);
  if (!cb) throw new Error(`No observer registered for type "${type}"`);
  cb({ getEntries: () => entries as PerformanceEntry[] });
}

async function freshImport() {
  return import('./perfMetrics');
}

// Stub the Vite compile-time global that is not replaced in test mode
// @ts-expect-error -- Vite define replacement not available in vitest
globalThis.__APP_VERSION__ = '0.0.0-test';

describe('initPerfMetrics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    observerCallbacks.clear();

    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver);
    vi.stubGlobal('crypto', { randomUUID: () => 'test-session-uuid' });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/91.0',
      onLine: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    mockCallable.mockReset().mockResolvedValue({ data: 'ok' });
  });

  it('does nothing when not in PROD mode', async () => {
    // import.meta.env.PROD is false in test by default
    const { initPerfMetrics } = await freshImport();
    initPerfMetrics('user1', true);
    expect(observerCallbacks.size).toBe(0);
  });

  it('does nothing when analyticsEnabled is false', async () => {
    vi.stubGlobal('import', { meta: { env: { PROD: true } } });
    const { initPerfMetrics } = await freshImport();
    initPerfMetrics('user1', false);
    expect(observerCallbacks.size).toBe(0);
  });

  describe('in PROD mode (overriding import.meta.env)', () => {
    beforeEach(() => {
      // Override PROD to true so initPerfMetrics proceeds
      import.meta.env.PROD = true;
    });

    afterEach(() => {
      import.meta.env.PROD = false;
    });

    it('registers all four PerformanceObserver types', async () => {
      const { initPerfMetrics } = await freshImport();
      initPerfMetrics('user1', true);

      expect(observerCallbacks.has('largest-contentful-paint')).toBe(true);
      expect(observerCallbacks.has('event')).toBe(true);
      expect(observerCallbacks.has('layout-shift')).toBe(true);
      expect(observerCallbacks.has('navigation')).toBe(true);
    });

    it('does not re-initialize if called twice (idempotent)', async () => {
      const uuidMock = vi.fn().mockReturnValue('uuid-1');
      vi.stubGlobal('crypto', { randomUUID: uuidMock });

      const { initPerfMetrics } = await freshImport();
      initPerfMetrics('user1', true);
      initPerfMetrics('user1', true);

      expect(uuidMock).toHaveBeenCalledTimes(1);
    });

    it('measureAsync records timing when session is active', async () => {
      const { initPerfMetrics, measureAsync: ma } = await freshImport();
      initPerfMetrics('user1', true);

      const result = await ma('fetchItems', async () => {
        return 'data';
      });

      expect(result).toBe('data');
      // The timing was recorded internally -- we verify via flush
    });

    it('LCP observer callback sets lcp vital and triggers flush', async () => {
      const { initPerfMetrics } = await freshImport();
      initPerfMetrics('user1', true);

      triggerObserver('largest-contentful-paint', [
        { startTime: 1200 } as PerformanceEntry,
      ]);

      // Advance timer to trigger flush
      await vi.advanceTimersByTimeAsync(150);

      expect(mockCallable).toHaveBeenCalledTimes(1);
      const payload = mockCallable.mock.calls[0][0];
      expect(payload.vitals.lcp).toBe(1200);
      expect(payload.sessionId).toBe('test-session-uuid');
      expect(payload.device.type).toBe('desktop');
    });

    it('INP observer tracks the maximum duration', async () => {
      const { initPerfMetrics } = await freshImport();
      initPerfMetrics('user1', true);

      triggerObserver('event', [
        { duration: 50 } as PerformanceEntry,
        { duration: 120 } as PerformanceEntry,
        { duration: 80 } as PerformanceEntry,
      ]);

      // Also trigger LCP so hasVitals is satisfied for flush
      triggerObserver('largest-contentful-paint', [
        { startTime: 500 } as PerformanceEntry,
      ]);

      await vi.advanceTimersByTimeAsync(150);

      const payload = mockCallable.mock.calls[0][0];
      expect(payload.vitals.inp).toBe(120);
    });

    it('CLS observer accumulates layout shifts (ignoring hadRecentInput)', async () => {
      const { initPerfMetrics } = await freshImport();
      initPerfMetrics('user1', true);

      triggerObserver('layout-shift', [
        { startTime: 100, value: 0.05, hadRecentInput: false },
        { startTime: 200, value: 0.03, hadRecentInput: false },
        { startTime: 300, value: 0.10, hadRecentInput: true }, // should be ignored
      ]);

      await vi.advanceTimersByTimeAsync(150);

      const payload = mockCallable.mock.calls[0][0];
      // 0.05 + 0.03 = 0.08, the hadRecentInput entry is excluded
      expect(payload.vitals.cls).toBeCloseTo(0.08, 5);
    });

    it('TTFB observer sets responseStart as ttfb', async () => {
      const { initPerfMetrics } = await freshImport();
      initPerfMetrics('user1', true);

      triggerObserver('navigation', [
        { startTime: 0, responseStart: 350 } as unknown as PerformanceEntry,
      ]);

      await vi.advanceTimersByTimeAsync(150);

      const payload = mockCallable.mock.calls[0][0];
      expect(payload.vitals.ttfb).toBe(350);
    });

    it('flush does not fire if no vitals have been captured', async () => {
      const { initPerfMetrics } = await freshImport();
      initPerfMetrics('user1', true);

      // Don't trigger any observer, just advance time
      await vi.advanceTimersByTimeAsync(150);

      expect(mockCallable).not.toHaveBeenCalled();
    });

    it('flush only fires once (flushed flag prevents duplicates)', async () => {
      const { initPerfMetrics } = await freshImport();
      initPerfMetrics('user1', true);

      triggerObserver('largest-contentful-paint', [
        { startTime: 1000 } as PerformanceEntry,
      ]);

      await vi.advanceTimersByTimeAsync(150);
      expect(mockCallable).toHaveBeenCalledTimes(1);

      // Trigger another observer -- should not flush again
      triggerObserver('navigation', [
        { startTime: 0, responseStart: 200 } as unknown as PerformanceEntry,
      ]);
      await vi.advanceTimersByTimeAsync(150);

      expect(mockCallable).toHaveBeenCalledTimes(1);
    });

    it('flush resets flushed flag on callable error so it can retry', async () => {
      mockCallable.mockRejectedValueOnce(new Error('network error'));

      const { initPerfMetrics } = await freshImport();
      initPerfMetrics('user1', true);

      triggerObserver('largest-contentful-paint', [
        { startTime: 1000 } as PerformanceEntry,
      ]);

      await vi.advanceTimersByTimeAsync(150);
      expect(mockCallable).toHaveBeenCalledTimes(1);

      // Because the callable threw, flushed was reset to false.
      // Trigger another flush.
      triggerObserver('navigation', [
        { startTime: 0, responseStart: 200 } as unknown as PerformanceEntry,
      ]);
      await vi.advanceTimersByTimeAsync(150);

      expect(mockCallable).toHaveBeenCalledTimes(2);
    });

    it('flush calls trackEvent with vital values', async () => {
      const { trackEvent } = await import('./analytics');
      const { initPerfMetrics } = await freshImport();
      initPerfMetrics('user1', true);

      triggerObserver('largest-contentful-paint', [
        { startTime: 900 } as PerformanceEntry,
      ]);

      await vi.advanceTimersByTimeAsync(150);

      expect(trackEvent).toHaveBeenCalledWith('perf_vitals_captured', expect.objectContaining({
        lcp: 900,
        device_type: 'desktop',
      }));
    });

    it('flush includes query stats from measureAsync calls', async () => {
      const { initPerfMetrics, measureAsync: ma } = await freshImport();
      initPerfMetrics('user1', true);

      // Record some query timings
      await ma('fetchBusinesses', async () => 'ok');
      await ma('fetchBusinesses', async () => 'ok');

      // Trigger a vital so flush proceeds
      triggerObserver('largest-contentful-paint', [
        { startTime: 600 } as PerformanceEntry,
      ]);

      await vi.advanceTimersByTimeAsync(150);

      const payload = mockCallable.mock.calls[0][0];
      expect(payload.queries).toHaveProperty('fetchBusinesses');
      expect(payload.queries.fetchBusinesses.count).toBe(2);
      expect(typeof payload.queries.fetchBusinesses.p50).toBe('number');
      expect(typeof payload.queries.fetchBusinesses.p95).toBe('number');
    });
  });
});
