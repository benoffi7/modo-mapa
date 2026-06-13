import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetDocFromServer = vi.hoisted(() => vi.fn());
const mockGetDoc = vi.hoisted(() => vi.fn());
const mockDoc = vi.hoisted(() => vi.fn().mockReturnValue({}));
const mockMeasuredGetDoc = vi.hoisted(() => vi.fn());

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { CONFIG: 'config' },
}));
vi.mock('../utils/logger', () => ({ logger: { warn: vi.fn() } }));

vi.mock('../utils/perfMetrics', () => ({
  measuredGetDoc: mockMeasuredGetDoc,
}));

vi.mock('../constants/timing', () => ({
  FORCE_UPDATE_FETCH_RETRY_DELAYS_MS: [500, 1500],
}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDocFromServer: (...args: unknown[]) => mockGetDocFromServer(...args),
  FirestoreError: class FirestoreError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'FirestoreError';
      this.code = code;
    }
  },
}));

import { fetchAppVersionConfig } from './config';
import { FirestoreError } from 'firebase/firestore';

function makeSnap(exists: boolean, data?: Record<string, unknown>) {
  return {
    exists: () => exists,
    data: () => data ?? {},
  };
}

function makeFirestoreError(code: string): FirestoreError {
  // FirestoreError is mocked with a public constructor — safe to call at test runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (FirestoreError as any)(code, `Firestore error: ${code}`) as FirestoreError;
}

describe('fetchAppVersionConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
    mockDoc.mockReturnValue({});
    // Transparent proxy: measuredGetDoc forwards to the legacy mockGetDoc so
    // existing tests that pre-configure mockGetDoc keep working unchanged.
    mockMeasuredGetDoc.mockImplementation((_name: string, ref: unknown) => mockGetDoc(ref));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // a) Happy path — server first attempt
  // ---------------------------------------------------------------------------

  it('a) returns { minVersion, source: "server" } when getDocFromServer resolves on 1st attempt', async () => {
    mockGetDocFromServer.mockResolvedValue(makeSnap(true, { minVersion: '2.0.0' }));

    const result = await fetchAppVersionConfig();

    expect(result).toEqual({ minVersion: '2.0.0', source: 'server' });
    expect(mockGetDocFromServer).toHaveBeenCalledTimes(1);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // b) Server retry — first call fails with retryable error, second succeeds
  // ---------------------------------------------------------------------------

  it('b) retries on retryable error and returns source: "server-retry"', async () => {
    vi.useFakeTimers();

    mockGetDocFromServer
      .mockRejectedValueOnce(makeFirestoreError('unavailable'))
      .mockResolvedValueOnce(makeSnap(true, { minVersion: '2.1.0' }));

    const promise = fetchAppVersionConfig();
    // advance past first backoff (500ms)
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toEqual({ minVersion: '2.1.0', source: 'server-retry' });
    expect(mockGetDocFromServer).toHaveBeenCalledTimes(2);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // c) Cache fallback — 3 retryable failures exhaust retries, falls back to getDoc
  // ---------------------------------------------------------------------------

  it('c) falls back to cache after 3 retryable failures from getDocFromServer', async () => {
    vi.useFakeTimers();

    mockGetDocFromServer
      .mockRejectedValueOnce(makeFirestoreError('unavailable'))
      .mockRejectedValueOnce(makeFirestoreError('deadline-exceeded'))
      .mockRejectedValueOnce(makeFirestoreError('unavailable'));

    mockGetDoc.mockResolvedValue(makeSnap(true, { minVersion: '1.9.0' }));

    const promise = fetchAppVersionConfig();
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toEqual({ minVersion: '1.9.0', source: 'cache' });
    expect(mockGetDocFromServer).toHaveBeenCalledTimes(3);
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // d) Non-retryable error — jumps to cache immediately (no retries)
  // ---------------------------------------------------------------------------

  it('d) does not retry on non-retryable error and falls back to cache', async () => {
    mockGetDocFromServer.mockRejectedValueOnce(makeFirestoreError('permission-denied'));
    mockGetDoc.mockResolvedValue(makeSnap(true, { minVersion: '1.8.0' }));

    const result = await fetchAppVersionConfig();

    expect(result).toEqual({ minVersion: '1.8.0', source: 'cache' });
    // Only 1 attempt to getDocFromServer, no retries
    expect(mockGetDocFromServer).toHaveBeenCalledTimes(1);
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // e) Doc does not exist — returns source: "empty"
  // ---------------------------------------------------------------------------

  it('e) returns { minVersion: undefined, source: "empty" } when doc does not exist on server', async () => {
    mockGetDocFromServer.mockResolvedValue(makeSnap(false));

    const result = await fetchAppVersionConfig();

    expect(result).toEqual({ minVersion: undefined, source: 'empty' });
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // f) Cache also fails — rethrows the error
  // ---------------------------------------------------------------------------

  it('f) rethrows when all getDocFromServer attempts fail and getDoc also throws', async () => {
    vi.useFakeTimers();

    const cacheError = new Error('cache unavailable');

    mockGetDocFromServer
      .mockRejectedValueOnce(makeFirestoreError('unavailable'))
      .mockRejectedValueOnce(makeFirestoreError('unavailable'))
      .mockRejectedValueOnce(makeFirestoreError('unavailable'));

    mockGetDoc.mockRejectedValue(cacheError);

    // Attach rejection handler immediately before advancing timers
    const promise = fetchAppVersionConfig();
    const caught = promise.catch((e: unknown) => e);
    await vi.runAllTimersAsync();

    const err = await caught;
    expect(err).toBe(cacheError);
    expect(mockGetDocFromServer).toHaveBeenCalledTimes(3);
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // g) Perf instrumentation — cache fallback goes through measuredGetDoc
  // ---------------------------------------------------------------------------

  it('g) uses measuredGetDoc with appVersionConfig metric name on cache fallback', async () => {
    vi.useFakeTimers();

    mockGetDocFromServer
      .mockRejectedValueOnce(makeFirestoreError('unavailable'))
      .mockRejectedValueOnce(makeFirestoreError('unavailable'))
      .mockRejectedValueOnce(makeFirestoreError('unavailable'));

    mockGetDoc.mockResolvedValue(makeSnap(true, { minVersion: '2.30.0' }));

    const promise = fetchAppVersionConfig();
    await vi.runAllTimersAsync();
    await promise;

    expect(mockMeasuredGetDoc).toHaveBeenCalledTimes(1);
    expect(mockMeasuredGetDoc).toHaveBeenCalledWith('appVersionConfig', expect.anything());
  });

  // ---------------------------------------------------------------------------
  // Legacy / extra coverage
  // ---------------------------------------------------------------------------

  it('returns { minVersion: undefined, source: "server" } when doc exists but has no minVersion field', async () => {
    mockGetDocFromServer.mockResolvedValue(makeSnap(true, {}));

    const result = await fetchAppVersionConfig();

    expect(result).toEqual({ minVersion: undefined, source: 'server' });
  });
});
