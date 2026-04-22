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

// --- Helpers ---

/**
 * Dynamically import a fresh perfMetrics module with clean internal state.
 * Must be called after vi.resetModules().
 */
async function freshImport() {
  return import('./perfMetrics');
}

// Stub the Vite compile-time global that is not replaced in test mode
// @ts-expect-error -- Vite define replacement not available in vitest
globalThis.__APP_VERSION__ = '0.0.0-test';

// --- Tests ---

describe('calculatePercentile', () => {
  let calculatePercentile: typeof import('./perfMetrics').calculatePercentile;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await freshImport();
    calculatePercentile = mod.calculatePercentile;
  });

  it('returns the single value for a 1-element array', () => {
    expect(calculatePercentile([42], 50)).toBe(42);
    expect(calculatePercentile([42], 95)).toBe(42);
  });

  it('computes p50 correctly on a sorted 10-element array', () => {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(calculatePercentile(arr, 50)).toBe(50);
  });

  it('computes p95 correctly', () => {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(calculatePercentile(arr, 95)).toBe(100);
  });

  it('handles unsorted input by sorting internally', () => {
    const arr = [100, 10, 50, 30, 70];
    expect(calculatePercentile(arr, 50)).toBe(50);
  });

  it('does not mutate the original array', () => {
    const arr = [30, 10, 20];
    calculatePercentile(arr, 50);
    expect(arr).toEqual([30, 10, 20]);
  });
});

describe('getDeviceInfo', () => {
  let getDeviceInfo: typeof import('./perfMetrics').getDeviceInfo;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await freshImport();
    getDeviceInfo = mod.getDeviceInfo;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects iPhone as mobile', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0) AppleWebKit/605.1.15',
    });
    expect(getDeviceInfo().type).toBe('mobile');
  });

  it('detects Android as mobile', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 10)',
    });
    expect(getDeviceInfo().type).toBe('mobile');
  });

  it('detects desktop userAgent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/91.0',
      onLine: true,
    });
    expect(getDeviceInfo().type).toBe('desktop');
  });

  it('reads connection.effectiveType when available', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 10)',
      connection: { effectiveType: '4g' },
    });
    expect(getDeviceInfo().connection).toBe('4g');
  });

  it('returns "unknown" when connection API is absent', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
    });
    expect(getDeviceInfo().connection).toBe('unknown');
  });
});

describe('measureAsync', () => {
  let measureAsync: typeof import('./perfMetrics').measureAsync;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await freshImport();
    measureAsync = mod.measureAsync;
  });

  it('returns the result of the wrapped function when sessionId is empty', async () => {
    // sessionId is empty by default (no initPerfMetrics called), so fn() runs without timing
    const result = await measureAsync('test', async () => 'hello');
    expect(result).toBe('hello');
  });

  it('propagates errors from the wrapped function', async () => {
    await expect(
      measureAsync('test', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('preserves complex return types', async () => {
    const result = await measureAsync('test', async () => ({ a: 1, b: [2, 3] }));
    expect(result).toEqual({ a: 1, b: [2, 3] });
  });
});

describe('measuredGetDocs', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('delegates to measureAsync with the provided name and returns the snapshot', async () => {
    const fakeSnapshot = { docs: [], empty: true, size: 0 };
    const mockGetDocs = vi.fn().mockResolvedValue(fakeSnapshot);
    vi.doMock('firebase/firestore', () => ({
      getDocs: mockGetDocs,
      getDoc: vi.fn(),
    }));
    const mod = await freshImport();
    const fakeQuery = { id: 'fake-query' } as unknown as Parameters<typeof mod.measuredGetDocs>[1];
    const result = await mod.measuredGetDocs('test_query', fakeQuery);

    expect(result).toBe(fakeSnapshot);
    expect(mockGetDocs).toHaveBeenCalledWith(fakeQuery);
  });

  it('propagates errors from getDocs', async () => {
    const mockGetDocs = vi.fn().mockRejectedValue(new Error('firestore down'));
    vi.doMock('firebase/firestore', () => ({
      getDocs: mockGetDocs,
      getDoc: vi.fn(),
    }));
    const mod = await freshImport();
    const fakeQuery = {} as unknown as Parameters<typeof mod.measuredGetDocs>[1];
    await expect(mod.measuredGetDocs('test_query', fakeQuery)).rejects.toThrow('firestore down');
  });
});

describe('measuredGetDoc', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('delegates to measureAsync with the provided name and returns the snapshot', async () => {
    const fakeSnapshot = { exists: () => false, data: () => undefined, id: 'doc-1' };
    const mockGetDoc = vi.fn().mockResolvedValue(fakeSnapshot);
    vi.doMock('firebase/firestore', () => ({
      getDocs: vi.fn(),
      getDoc: mockGetDoc,
    }));
    const mod = await freshImport();
    const fakeRef = { id: 'fake-ref' } as unknown as Parameters<typeof mod.measuredGetDoc>[1];
    const result = await mod.measuredGetDoc('test_doc', fakeRef);

    expect(result).toBe(fakeSnapshot);
    expect(mockGetDoc).toHaveBeenCalledWith(fakeRef);
  });

  it('propagates errors from getDoc', async () => {
    const mockGetDoc = vi.fn().mockRejectedValue(new Error('doc read failed'));
    vi.doMock('firebase/firestore', () => ({
      getDocs: vi.fn(),
      getDoc: mockGetDoc,
    }));
    const mod = await freshImport();
    const fakeRef = {} as unknown as Parameters<typeof mod.measuredGetDoc>[1];
    await expect(mod.measuredGetDoc('test_doc', fakeRef)).rejects.toThrow('doc read failed');
  });
});
