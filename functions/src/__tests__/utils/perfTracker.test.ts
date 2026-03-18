import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Firestore mock setup for trackFunctionTiming tests ---
const mockTxGet = vi.fn();
const mockTxSet = vi.fn();
const mockRunTransaction = vi.fn();
const mockDocRef = { path: 'config/perfCounters' };
const mockDoc = vi.fn().mockReturnValue(mockDocRef);

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    doc: mockDoc,
    runTransaction: mockRunTransaction,
  }),
}));

import { calculatePercentile, trackFunctionTiming } from '../../utils/perfTracker';

describe('calculatePercentile', () => {
  it('returns 0 for empty array', () => {
    expect(calculatePercentile([], 50)).toBe(0);
  });

  it('returns the single value for 1-element array', () => {
    expect(calculatePercentile([42], 50)).toBe(42);
    expect(calculatePercentile([42], 95)).toBe(42);
  });

  it('computes p50 for even-length array', () => {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(calculatePercentile(arr, 50)).toBe(50);
  });

  it('computes p95 correctly', () => {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(calculatePercentile(arr, 95)).toBe(100);
  });

  it('computes p75 correctly', () => {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(calculatePercentile(arr, 75)).toBe(80);
  });

  it('handles unsorted input', () => {
    expect(calculatePercentile([100, 10, 50, 30, 70], 50)).toBe(50);
  });

  it('handles p0 (minimum)', () => {
    expect(calculatePercentile([10, 20, 30], 0)).toBe(10);
  });

  it('handles p100 (maximum)', () => {
    expect(calculatePercentile([10, 20, 30], 100)).toBe(30);
  });

  it('works with duplicate values', () => {
    expect(calculatePercentile([5, 5, 5, 5], 50)).toBe(5);
  });
});

describe('trackFunctionTiming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // By default, runTransaction executes the callback with our mock tx
    mockRunTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({ get: mockTxGet, set: mockTxSet });
    });
  });

  it('creates a new array when function name does not exist yet', async () => {
    mockTxGet.mockResolvedValue({ data: () => ({}) });

    await trackFunctionTiming('myFunction', performance.now() - 10);

    expect(mockTxSet).toHaveBeenCalledTimes(1);
    const [docRef, data, options] = mockTxSet.mock.calls[0] as [unknown, Record<string, unknown>, unknown];
    expect(docRef).toBe(mockDocRef);
    expect(options).toEqual({ merge: true });
    // Should be an array with exactly one number (the elapsed time)
    const samples = data['myFunction'] as number[];
    expect(Array.isArray(samples)).toBe(true);
    expect(samples).toHaveLength(1);
    expect(typeof samples[0]).toBe('number');
  });

  it('appends to an existing array of samples', async () => {
    mockTxGet.mockResolvedValue({ data: () => ({ myFunction: [100, 200] }) });

    await trackFunctionTiming('myFunction', performance.now() - 5);

    expect(mockTxSet).toHaveBeenCalledTimes(1);
    const data = (mockTxSet.mock.calls[0] as [unknown, Record<string, unknown>])[1];
    const samples = data['myFunction'] as number[];
    expect(samples).toHaveLength(3);
    // First two should be the existing values
    expect(samples[0]).toBe(100);
    expect(samples[1]).toBe(200);
    expect(typeof samples[2]).toBe('number');
  });

  it('does not write when samples array is at MAX_SAMPLES_PER_FUNCTION (5000)', async () => {
    const fullArray = Array.from({ length: 5000 }, (_, i) => i);
    mockTxGet.mockResolvedValue({ data: () => ({ myFunction: fullArray }) });

    await trackFunctionTiming('myFunction', performance.now() - 5);

    // Transaction callback should return early without calling set
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it('treats non-array field value as empty array and creates a new one', async () => {
    // data[functionName] exists but is not an array (e.g. corrupted data)
    mockTxGet.mockResolvedValue({ data: () => ({ myFunction: 'not-an-array' }) });

    await trackFunctionTiming('myFunction', performance.now() - 5);

    expect(mockTxSet).toHaveBeenCalledTimes(1);
    const data = (mockTxSet.mock.calls[0] as [unknown, Record<string, unknown>])[1];
    const samples = data['myFunction'] as number[];
    expect(samples).toHaveLength(1);
  });

  it('handles missing document (snap.data() returns undefined)', async () => {
    mockTxGet.mockResolvedValue({ data: () => undefined });

    await trackFunctionTiming('myFunction', performance.now() - 5);

    expect(mockTxSet).toHaveBeenCalledTimes(1);
    const data = (mockTxSet.mock.calls[0] as [unknown, Record<string, unknown>])[1];
    const samples = data['myFunction'] as number[];
    expect(samples).toHaveLength(1);
  });

  it('does not throw when the transaction rejects (silent catch)', async () => {
    mockRunTransaction.mockRejectedValue(new Error('Firestore unavailable'));

    // Should resolve without throwing
    await expect(trackFunctionTiming('myFunction', performance.now())).resolves.toBeUndefined();
  });
});
