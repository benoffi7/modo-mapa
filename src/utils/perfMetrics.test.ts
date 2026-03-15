import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculatePercentile, getDeviceInfo, measureAsync } from './perfMetrics';

// Mock firebase/firestore to prevent real Firestore initialization
vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock('../config/firebase', () => ({
  db: {},
}));

vi.mock('../config/collections', () => ({
  COLLECTIONS: { PERF_METRICS: 'perfMetrics' },
}));

vi.mock('../constants/performance', () => ({
  PERF_FLUSH_DELAY_MS: 30000,
}));

vi.mock('./analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('calculatePercentile', () => {
  it('returns the single value for a 1-element array', () => {
    expect(calculatePercentile([42], 50)).toBe(42);
    expect(calculatePercentile([42], 95)).toBe(42);
  });

  it('computes p50 correctly', () => {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(calculatePercentile(arr, 50)).toBe(50);
  });

  it('computes p95 correctly', () => {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(calculatePercentile(arr, 95)).toBe(100);
  });

  it('handles unsorted input', () => {
    const arr = [100, 10, 50, 30, 70];
    expect(calculatePercentile(arr, 50)).toBe(50);
  });
});

describe('getDeviceInfo', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    // Reset navigator mock
    Object.defineProperty(globalThis, 'navigator', {
      value: { ...originalNavigator },
      writable: true,
      configurable: true,
    });
  });

  it('detects mobile device from userAgent', () => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0) AppleWebKit/605.1.15',
      configurable: true,
    });
    const info = getDeviceInfo();
    expect(info.type).toBe('mobile');
  });

  it('detects desktop device from userAgent', () => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/91.0',
      configurable: true,
    });
    const info = getDeviceInfo();
    expect(info.type).toBe('desktop');
  });

  it('returns connection type when available', () => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 10)',
      configurable: true,
    });
    Object.defineProperty(globalThis.navigator, 'connection', {
      value: { effectiveType: '4g' },
      configurable: true,
    });
    const info = getDeviceInfo();
    expect(info.connection).toBe('4g');
  });

  it('returns unknown when connection API is unavailable', () => {
    Object.defineProperty(globalThis.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
      configurable: true,
    });
    const info = getDeviceInfo();
    expect(info.connection).toBe('unknown');
  });
});

describe('measureAsync', () => {
  it('returns the result of the wrapped function', async () => {
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

  it('does not alter the return type', async () => {
    const result = await measureAsync('test', async () => ({ a: 1, b: [2, 3] }));
    expect(result).toEqual({ a: 1, b: [2, 3] });
  });
});
