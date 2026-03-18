import { describe, it, expect } from 'vitest';

// We import only the pure function — trackFunctionTiming requires Firestore
// and is tested via integration tests
import { calculatePercentile } from '../../utils/perfTracker';

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
