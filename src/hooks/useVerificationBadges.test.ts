import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ withConverter: () => 'col-ref' })),
  query: vi.fn(() => 'query-ref'),
  where: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../config/collections', () => ({
  COLLECTIONS: { RATINGS: 'ratings', CHECKINS: 'checkins' },
}));
vi.mock('../config/converters', () => ({
  ratingConverter: {},
  checkinConverter: {},
}));
vi.mock('../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));
vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock('./useBusinesses', () => ({
  allBusinesses: [
    { id: 'biz_001', name: 'Test Biz', address: 'Calle 1, CABA', lat: -34.6, lng: -58.38, tags: [], phone: null, category: 'restaurant' },
    { id: 'biz_002', name: 'Test Biz 2', address: 'Calle 2, CABA', lat: -34.61, lng: -58.39, tags: [], phone: null, category: 'cafe' },
    { id: 'biz_003', name: 'Remote Biz', address: 'Calle 3, Rosario', lat: -32.94, lng: -60.63, tags: [], phone: null, category: 'bar' },
  ],
}));

import { useVerificationBadges } from './useVerificationBadges';
import type { Rating, CheckIn } from '../types';

function makeRating(businessId: string, score: number, userId = 'u1'): Rating {
  return { userId, businessId, score, createdAt: new Date(), updatedAt: new Date() };
}

function makeCheckIn(businessId: string, lat: number, lng: number): CheckIn {
  return { id: `ci-${businessId}`, userId: 'u1', businessId, businessName: 'Test', createdAt: new Date(), location: { lat, lng } };
}

function snap(items: unknown[]) {
  return { docs: items.map((item) => ({ data: () => item })) };
}

const EMPTY = snap([]);

describe('useVerificationBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('returns empty badges when no userId', () => {
    const { result } = renderHook(() => useVerificationBadges(undefined));
    expect(result.current.badges).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('calculates Local Guide - not earned', async () => {
    const ratings = Array.from({ length: 30 }, () => makeRating('biz_001', 4));
    // getDocs calls: 1) user ratings  2) user checkins  3) biz ratings for trusted reviewer
    mockGetDocs
      .mockResolvedValueOnce(snap(ratings))
      .mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(snap(ratings));

    const { result } = renderHook(() => useVerificationBadges('u1', 'CABA'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const lg = result.current.badges.find((b) => b.id === 'local_guide')!;
    expect(lg.earned).toBe(false);
    expect(lg.current).toBe(30);
  });

  it('calculates Local Guide - earned', async () => {
    const ratings = Array.from({ length: 55 }, () => makeRating('biz_001', 4));
    mockGetDocs
      .mockResolvedValueOnce(snap(ratings))
      .mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(snap(ratings));

    const { result } = renderHook(() => useVerificationBadges('u1', 'CABA'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const lg = result.current.badges.find((b) => b.id === 'local_guide')!;
    expect(lg.earned).toBe(true);
    expect(lg.current).toBe(55);
  });

  it('calculates Verified Visitor - close check-ins count', async () => {
    const checkIns = [
      makeCheckIn('biz_001', -34.6001, -58.3801),
      makeCheckIn('biz_002', -34.61, -58.39),
    ];
    mockGetDocs
      .mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(snap(checkIns));

    const { result } = renderHook(() => useVerificationBadges('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const vv = result.current.badges.find((b) => b.id === 'verified_visitor')!;
    expect(vv.current).toBe(2);
    expect(vv.earned).toBe(false);
  });

  it('calculates Verified Visitor - far check-in ignored', async () => {
    mockGetDocs
      .mockResolvedValueOnce(EMPTY)
      .mockResolvedValueOnce(snap([makeCheckIn('biz_001', -34.7, -58.5)]));

    const { result } = renderHook(() => useVerificationBadges('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const vv = result.current.badges.find((b) => b.id === 'verified_visitor')!;
    expect(vv.current).toBe(0);
  });

  it('uses valid cache', async () => {
    const cached = [
      { id: 'local_guide', name: 'LG', description: 't', icon: 'X', earned: true, progress: 100, current: 55, target: 50 },
      { id: 'verified_visitor', name: 'VV', description: 't', icon: 'Y', earned: false, progress: 40, current: 2, target: 5 },
      { id: 'trusted_reviewer', name: 'TR', description: 't', icon: 'Z', earned: false, progress: 50, current: 50, target: 80 },
    ];
    localStorage.setItem('mm_verification_badges_u1', JSON.stringify({ badges: cached, timestamp: Date.now() }));

    const { result } = renderHook(() => useVerificationBadges('u1'));
    await waitFor(() => expect(result.current.badges).toHaveLength(3));
    expect(result.current.badges[0].earned).toBe(true);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('ignores expired cache', async () => {
    localStorage.setItem('mm_verification_badges_u1', JSON.stringify({
      badges: [{ id: 'local_guide', name: 'LG', description: 't', icon: 'X', earned: true, progress: 100, current: 55, target: 50 }],
      timestamp: Date.now() - 25 * 60 * 60 * 1000,
    }));
    mockGetDocs.mockResolvedValue(EMPTY);

    const { result } = renderHook(() => useVerificationBadges('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetDocs).toHaveBeenCalled();
    expect(result.current.badges).toHaveLength(3);
  });
});
