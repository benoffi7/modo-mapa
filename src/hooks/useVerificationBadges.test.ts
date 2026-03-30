import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---
const mockFetchUserRatings = vi.fn();
const mockFetchUserCheckIns = vi.fn();
const mockCalcLocalGuide = vi.fn();
const mockCalcVerifiedVisitor = vi.fn();
const mockCalcTrustedReviewer = vi.fn();

vi.mock('../services/ratings', () => ({
  fetchUserRatings: (...args: unknown[]) => mockFetchUserRatings(...args),
}));

vi.mock('../services/checkins', () => ({
  fetchUserCheckIns: (...args: unknown[]) => mockFetchUserCheckIns(...args),
}));

vi.mock('./useLocalGuideBadge', () => ({
  calcLocalGuide: (...args: unknown[]) => mockCalcLocalGuide(...args),
}));

vi.mock('./useVerifiedVisitorBadge', () => ({
  calcVerifiedVisitor: (...args: unknown[]) => mockCalcVerifiedVisitor(...args),
}));

vi.mock('./useTrustedReviewerBadge', () => ({
  calcTrustedReviewer: (...args: unknown[]) => mockCalcTrustedReviewer(...args),
}));

vi.mock('../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));
vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

import { useVerificationBadges } from './useVerificationBadges';

describe('useVerificationBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetchUserRatings.mockResolvedValue([]);
    mockFetchUserCheckIns.mockResolvedValue([]);
    mockCalcLocalGuide.mockReturnValue({ current: 0, target: 50 });
    mockCalcVerifiedVisitor.mockReturnValue({ current: 0, target: 5 });
    mockCalcTrustedReviewer.mockResolvedValue({ current: 0, target: 80 });
  });

  it('returns empty badges when no userId', () => {
    const { result } = renderHook(() => useVerificationBadges(undefined));
    expect(result.current.badges).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('delegates to service layer for data fetching', async () => {
    const { result } = renderHook(() => useVerificationBadges('u1', 'CABA'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockFetchUserRatings).toHaveBeenCalledWith('u1');
    expect(mockFetchUserCheckIns).toHaveBeenCalledWith('u1');
  });

  it('delegates to calculators and builds badges', async () => {
    mockCalcLocalGuide.mockReturnValue({ current: 30, target: 50 });
    mockCalcVerifiedVisitor.mockReturnValue({ current: 2, target: 5 });
    mockCalcTrustedReviewer.mockResolvedValue({ current: 90, target: 80 });

    const { result } = renderHook(() => useVerificationBadges('u1', 'CABA'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.badges).toHaveLength(3);
    const lg = result.current.badges.find((b) => b.id === 'local_guide')!;
    expect(lg.current).toBe(30);
    expect(lg.earned).toBe(false);

    const tr = result.current.badges.find((b) => b.id === 'trusted_reviewer')!;
    expect(tr.current).toBe(90);
    expect(tr.earned).toBe(true);
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
    expect(mockFetchUserRatings).not.toHaveBeenCalled();
  });

  it('ignores expired cache', async () => {
    localStorage.setItem('mm_verification_badges_u1', JSON.stringify({
      badges: [{ id: 'local_guide', name: 'LG', description: 't', icon: 'X', earned: true, progress: 100, current: 55, target: 50 }],
      timestamp: Date.now() - 25 * 60 * 60 * 1000,
    }));

    const { result } = renderHook(() => useVerificationBadges('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchUserRatings).toHaveBeenCalled();
    expect(result.current.badges).toHaveLength(3);
  });

  it('handles compute error gracefully', async () => {
    mockFetchUserRatings.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useVerificationBadges('u1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.badges).toEqual([]);
  });
});
