import { describe, it, expect } from 'vitest';
import { distanceKm, formatDistance } from './distance';

describe('distanceKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(distanceKm(0, 0, 0, 0)).toBe(0);
    expect(distanceKm(-34.6, -58.4, -34.6, -58.4)).toBe(0);
  });

  it('calculates known distance (Buenos Aires to Córdoba ≈ 650 km)', () => {
    const km = distanceKm(-34.6037, -58.3816, -31.4201, -64.1888);
    expect(km).toBeGreaterThan(640);
    expect(km).toBeLessThan(660);
  });

  it('calculates short distance (< 1 km)', () => {
    // Two points ~100m apart in Buenos Aires
    const km = distanceKm(-34.6037, -58.3816, -34.6037, -58.3804);
    expect(km).toBeGreaterThan(0.05);
    expect(km).toBeLessThan(0.2);
  });

  it('handles negative latitudes and longitudes', () => {
    const km = distanceKm(-34.6, -58.4, -33.9, -60.6);
    expect(km).toBeGreaterThan(0);
  });

  it('is symmetric (a→b equals b→a)', () => {
    const ab = distanceKm(-34.6, -58.4, -31.4, -64.2);
    const ba = distanceKm(-31.4, -64.2, -34.6, -58.4);
    expect(ab).toBeCloseTo(ba, 10);
  });
});

describe('formatDistance', () => {
  it('formats sub-kilometer distances in meters', () => {
    expect(formatDistance(0.3)).toBe('a 300m');
    expect(formatDistance(0.05)).toBe('a 50m');
    expect(formatDistance(0.999)).toBe('a 999m');
  });

  it('formats distances >= 1km with one decimal', () => {
    expect(formatDistance(1)).toBe('a 1.0km');
    expect(formatDistance(1.5)).toBe('a 1.5km');
    expect(formatDistance(12.34)).toBe('a 12.3km');
  });

  it('formats 0 as 0m', () => {
    expect(formatDistance(0)).toBe('a 0m');
  });

  it('rounds meters to nearest integer', () => {
    expect(formatDistance(0.4567)).toBe('a 457m');
  });
});
