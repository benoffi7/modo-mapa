import { describe, it, expect, vi } from 'vitest';

vi.mock('./useBusinesses', () => ({
  allBusinesses: [
    { id: 'biz_001', name: 'Cafe 1', address: 'Calle 1, CABA', lat: -34.6, lng: -58.38, tags: [], phone: null, category: 'cafe' },
    { id: 'biz_002', name: 'Cafe 2', address: 'Calle 2, CABA', lat: -34.61, lng: -58.39, tags: [], phone: null, category: 'cafe' },
  ],
}));

import { calcVerifiedVisitor, buildBusinessCoordsMap } from './useVerifiedVisitorBadge';
import type { CheckIn } from '../types';

function makeCheckIn(businessId: string, lat?: number, lng?: number): CheckIn {
  return {
    id: `ci-${businessId}`,
    userId: 'u1',
    businessId,
    businessName: 'Test',
    createdAt: new Date(),
    ...(lat != null && lng != null ? { location: { lat, lng } } : {}),
  };
}

describe('buildBusinessCoordsMap', () => {
  it('returns a map with coords for each business', () => {
    const map = buildBusinessCoordsMap();
    expect(map.size).toBe(2);
    expect(map.get('biz_001')).toEqual({ lat: -34.6, lng: -58.38 });
  });
});

describe('calcVerifiedVisitor', () => {
  it('returns 0 current with no check-ins', () => {
    const result = calcVerifiedVisitor([]);
    expect(result.current).toBe(0);
    expect(result.target).toBe(5);
  });

  it('counts close check-ins (< 100m)', () => {
    const checkIns = [
      makeCheckIn('biz_001', -34.6001, -58.3801), // close
      makeCheckIn('biz_002', -34.61, -58.39),      // close
    ];
    const result = calcVerifiedVisitor(checkIns);
    expect(result.current).toBe(2);
  });

  it('ignores far check-ins (> 100m)', () => {
    const checkIns = [
      makeCheckIn('biz_001', -34.7, -58.5), // far
    ];
    const result = calcVerifiedVisitor(checkIns);
    expect(result.current).toBe(0);
  });

  it('ignores check-ins without location', () => {
    const checkIns = [makeCheckIn('biz_001')]; // no location
    const result = calcVerifiedVisitor(checkIns);
    expect(result.current).toBe(0);
  });

  it('ignores check-ins for unknown businesses', () => {
    const checkIns = [makeCheckIn('biz_unknown', -34.6, -58.38)];
    const result = calcVerifiedVisitor(checkIns);
    expect(result.current).toBe(0);
  });

  it('counts threshold exactly (5)', () => {
    const checkIns = Array.from({ length: 5 }, (_, i) =>
      makeCheckIn('biz_001', -34.6 + i * 0.00001, -58.38),
    );
    const result = calcVerifiedVisitor(checkIns);
    expect(result.current).toBe(5);
    expect(result.current).toBeGreaterThanOrEqual(result.target);
  });
});
