import { renderHook, act } from '@testing-library/react';
import { useRatingPrompt } from './useRatingPrompt';
import type { CheckIn } from '../types';

const mockTrackEvent = vi.fn();
vi.mock('../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

const mockSetSelectedBusiness = vi.fn();
vi.mock('../context/MapContext', () => ({
  useSelection: () => ({ setSelectedBusiness: mockSetSelectedBusiness }),
}));

let mockUser: { uid: string } | null = { uid: 'user1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockFetchMyCheckIns = vi.fn<(userId: string, limit?: number) => Promise<CheckIn[]>>();
vi.mock('../services/checkins', () => ({
  fetchMyCheckIns: (...args: unknown[]) => mockFetchMyCheckIns(args[0] as string, args[1] as number),
}));

const mockHasUserRatedBusiness = vi.fn();
vi.mock('../services/ratings', () => ({
  hasUserRatedBusiness: (...args: unknown[]) => mockHasUserRatedBusiness(...args),
}));

// Mock allBusinesses
vi.mock('./useBusinesses', () => ({
  allBusinesses: [
    { id: 'biz_001', name: 'Test Cafe' },
    { id: 'biz_002', name: 'Test Bar' },
    { id: 'biz_003', name: 'Test Shop' },
  ],
}));

function makeCheckIn(overrides: Partial<CheckIn> & { id: string; businessId: string; businessName: string; createdAt: Date }): CheckIn {
  return {
    userId: 'user1',
    ...overrides,
  } as CheckIn;
}

/** Flush all pending microtasks/promises so async evaluate() completes */
async function flushPromises() {
  await act(async () => {
    // Multiple rounds to ensure chained promises (fetchMyCheckIns -> getDoc -> setState) all resolve
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useRatingPrompt', () => {
  const NOW = new Date('2026-03-27T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUser = { uid: 'user1' };
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockFetchMyCheckIns.mockResolvedValue([]);
    mockHasUserRatedBusiness.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows prompt for check-in 3h ago without rating (happy path)', async () => {
    const threeHoursAgo = new Date('2026-03-27T09:00:00Z');
    mockFetchMyCheckIns.mockResolvedValue([
      makeCheckIn({ id: 'ci1', businessId: 'biz_001', businessName: 'Test Cafe', createdAt: threeHoursAgo }),
    ]);
    mockHasUserRatedBusiness.mockResolvedValue(false);

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).not.toBeNull();
    expect(result.current.promptData!.businessId).toBe('biz_001');
    expect(result.current.promptData!.businessName).toBe('Test Cafe');
    expect(result.current.promptData!.checkInId).toBe('ci1');
  });

  it('does not show for check-in less than 2h ago (too early)', async () => {
    const oneHourAgo = new Date('2026-03-27T11:00:00Z');
    mockFetchMyCheckIns.mockResolvedValue([
      makeCheckIn({ id: 'ci1', businessId: 'biz_001', businessName: 'Test Cafe', createdAt: oneHourAgo }),
    ]);

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).toBeNull();
  });

  it('does not show for check-in more than 8h ago (too late)', async () => {
    const nineHoursAgo = new Date('2026-03-27T03:00:00Z');
    mockFetchMyCheckIns.mockResolvedValue([
      makeCheckIn({ id: 'ci1', businessId: 'biz_001', businessName: 'Test Cafe', createdAt: nineHoursAgo }),
    ]);

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).toBeNull();
  });

  it('shows prompt for check-in exactly at 2h boundary', async () => {
    const exactlyTwoHours = new Date('2026-03-27T10:00:00Z');
    mockFetchMyCheckIns.mockResolvedValue([
      makeCheckIn({ id: 'ci1', businessId: 'biz_001', businessName: 'Test Cafe', createdAt: exactlyTwoHours }),
    ]);
    mockHasUserRatedBusiness.mockResolvedValue(false);

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).not.toBeNull();
    expect(result.current.promptData!.businessId).toBe('biz_001');
  });

  it('shows prompt for check-in exactly at 8h boundary', async () => {
    const exactlyEightHours = new Date('2026-03-27T04:00:00Z');
    mockFetchMyCheckIns.mockResolvedValue([
      makeCheckIn({ id: 'ci1', businessId: 'biz_001', businessName: 'Test Cafe', createdAt: exactlyEightHours }),
    ]);
    mockHasUserRatedBusiness.mockResolvedValue(false);

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).not.toBeNull();
    expect(result.current.promptData!.businessId).toBe('biz_001');
  });

  it('does not show if already rated', async () => {
    const threeHoursAgo = new Date('2026-03-27T09:00:00Z');
    mockFetchMyCheckIns.mockResolvedValue([
      makeCheckIn({ id: 'ci1', businessId: 'biz_001', businessName: 'Test Cafe', createdAt: threeHoursAgo }),
    ]);
    mockHasUserRatedBusiness.mockResolvedValue(true);

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).toBeNull();
  });

  it('does not show if check-in was already dismissed', async () => {
    localStorage.setItem('rating_prompt_dismissed', JSON.stringify(['ci1']));
    const threeHoursAgo = new Date('2026-03-27T09:00:00Z');
    mockFetchMyCheckIns.mockResolvedValue([
      makeCheckIn({ id: 'ci1', businessId: 'biz_001', businessName: 'Test Cafe', createdAt: threeHoursAgo }),
    ]);

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).toBeNull();
  });

  it('does not show if max daily prompts reached', async () => {
    localStorage.setItem('rating_prompt_shown_today', JSON.stringify({ date: '2026-03-27', count: 3 }));
    const threeHoursAgo = new Date('2026-03-27T09:00:00Z');
    mockFetchMyCheckIns.mockResolvedValue([
      makeCheckIn({ id: 'ci1', businessId: 'biz_001', businessName: 'Test Cafe', createdAt: threeHoursAgo }),
    ]);

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).toBeNull();
  });

  it('selects the most recent eligible check-in from multiple', async () => {
    const fourHoursAgo = new Date('2026-03-27T08:00:00Z');
    const threeHoursAgo = new Date('2026-03-27T09:00:00Z');
    mockFetchMyCheckIns.mockResolvedValue([
      // Ordered desc by createdAt (most recent first)
      makeCheckIn({ id: 'ci_recent', businessId: 'biz_001', businessName: 'Test Cafe', createdAt: threeHoursAgo }),
      makeCheckIn({ id: 'ci_old', businessId: 'biz_002', businessName: 'Test Bar', createdAt: fourHoursAgo }),
    ]);
    mockHasUserRatedBusiness.mockResolvedValue(false);

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).not.toBeNull();
    expect(result.current.promptData!.checkInId).toBe('ci_recent');
    expect(result.current.promptData!.businessName).toBe('Test Cafe');
  });

  it('returns null when no user', async () => {
    mockUser = null;

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).toBeNull();
    expect(mockFetchMyCheckIns).not.toHaveBeenCalled();
  });

  it('returns null when no check-ins', async () => {
    mockFetchMyCheckIns.mockResolvedValue([]);

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).toBeNull();
  });

  it('skips business not in allBusinesses and picks next eligible', async () => {
    const threeHoursAgo = new Date('2026-03-27T09:00:00Z');
    mockFetchMyCheckIns.mockResolvedValue([
      makeCheckIn({ id: 'ci_unknown', businessId: 'biz_999', businessName: 'Unknown Place', createdAt: threeHoursAgo }),
      makeCheckIn({ id: 'ci_known', businessId: 'biz_002', businessName: 'Test Bar', createdAt: threeHoursAgo }),
    ]);
    mockHasUserRatedBusiness.mockResolvedValue(false);

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).not.toBeNull();
    expect(result.current.promptData!.businessId).toBe('biz_002');
    expect(result.current.promptData!.businessName).toBe('Test Bar');
  });

  it('dismiss persists checkInId in localStorage and tracks analytics', async () => {
    const threeHoursAgo = new Date('2026-03-27T09:00:00Z');
    mockFetchMyCheckIns.mockResolvedValue([
      makeCheckIn({ id: 'ci1', businessId: 'biz_001', businessName: 'Test Cafe', createdAt: threeHoursAgo }),
    ]);
    mockHasUserRatedBusiness.mockResolvedValue(false);

    const { result } = renderHook(() => useRatingPrompt());
    await flushPromises();

    expect(result.current.promptData).not.toBeNull();

    act(() => { result.current.dismiss(); });

    expect(result.current.promptData).toBeNull();
    expect(JSON.parse(localStorage.getItem('rating_prompt_dismissed')!)).toContain('ci1');
    expect(mockTrackEvent).toHaveBeenCalledWith('rating_prompt_dismissed', { business_id: 'biz_001' });
  });
});
