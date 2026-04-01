import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockFetchUserSettings = vi.fn();
const mockUpdateUserSettings = vi.fn();

vi.mock('../../services/userSettings', () => ({
  fetchUserSettings: (...args: unknown[]) => mockFetchUserSettings(...args),
  updateUserSettings: (...args: unknown[]) => mockUpdateUserSettings(...args),
  DEFAULT_SETTINGS: {
    profilePublic: false,
    notificationsEnabled: true,
    notifyLikes: true,
    notifyPhotos: true,
    notifyRankings: true,
    notifyFeedback: true,
    notifyReplies: true,
    notifyFollowers: true,
    notifyRecommendations: true,
    analyticsEnabled: true,
    notificationDigest: 'daily',
    locality: '',
    localityLat: 0,
    localityLng: 0,
  },
}));

vi.mock('../../utils/analytics', () => ({
  setAnalyticsEnabled: vi.fn(),
}));

vi.mock('../../utils/perfMetrics', () => ({
  initPerfMetrics: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

const mockToast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
vi.mock('../../context/ToastContext', () => ({
  useToast: () => mockToast,
}));

let mockUser: { uid: string } | null = { uid: 'user1' };
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

import { act } from '@testing-library/react';
import { useUserSettings } from '../useUserSettings';

describe('useUserSettings – toast.warning on catch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'user1' };
    mockFetchUserSettings.mockResolvedValue({
      profilePublic: false, notificationsEnabled: true, notifyLikes: true,
      notifyPhotos: true, notifyRankings: true, notifyFeedback: true,
      notifyReplies: true, notifyFollowers: true, notifyRecommendations: true,
      analyticsEnabled: true, notificationDigest: 'daily',
      locality: '', localityLat: 0, localityLng: 0,
    });
  });

  it('updateLocality calls toast.warning when updateUserSettings rejects', async () => {
    mockUpdateUserSettings.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useUserSettings());

    await act(async () => {
      result.current.updateLocality('San Isidro', -34.47, -58.51);
    });
    // Allow the promise rejection to propagate
    await act(async () => { await Promise.resolve(); });

    expect(mockToast.warning).toHaveBeenCalledTimes(1);
  });

  it('clearLocality calls toast.warning when updateUserSettings rejects', async () => {
    mockUpdateUserSettings.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useUserSettings());

    await act(async () => {
      result.current.clearLocality();
    });
    await act(async () => { await Promise.resolve(); });

    expect(mockToast.warning).toHaveBeenCalledTimes(1);
  });

  it('updateDigestFrequency calls toast.warning when updateUserSettings rejects', async () => {
    mockUpdateUserSettings.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useUserSettings());

    await act(async () => {
      result.current.updateDigestFrequency('weekly');
    });
    await act(async () => { await Promise.resolve(); });

    expect(mockToast.warning).toHaveBeenCalledTimes(1);
  });
});

describe('useUserSettings – settings memoization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'user1' };
    mockFetchUserSettings.mockResolvedValue({
      profilePublic: false,
      notificationsEnabled: true,
      notifyLikes: true,
      notifyPhotos: true,
      notifyRankings: true,
      notifyFeedback: true,
      notifyReplies: true,
      notifyFollowers: true,
      notifyRecommendations: true,
      analyticsEnabled: true,
      notificationDigest: 'daily',
      locality: '',
      localityLat: 0,
      localityLng: 0,
    });
    mockUpdateUserSettings.mockResolvedValue(undefined);
  });

  it('returns the same settings reference between renders when inputs do not change', async () => {
    const { result, rerender } = renderHook(() => useUserSettings());

    // Capture the settings reference after initial render
    const ref1 = result.current.settings;

    // Re-render without changing any inputs
    rerender();

    const ref2 = result.current.settings;

    // useMemo ensures the same object reference is returned
    expect(ref1).toBe(ref2);
  });

  it('settings reference is stable on multiple rerenders with same data', async () => {
    const { result, rerender } = renderHook(() => useUserSettings());

    const refs = [result.current.settings];

    for (let i = 0; i < 5; i++) {
      rerender();
      refs.push(result.current.settings);
    }

    // All references after the first stable render should be identical
    const uniqueRefs = new Set(refs);
    // Should have at most 2 unique refs (initial empty + settled)
    // In practice the object is stable after the first render cycle
    expect(uniqueRefs.size).toBeLessThanOrEqual(2);
  });

  it('loads default settings when user is null', () => {
    mockUser = null;
    const { result } = renderHook(() => useUserSettings());

    // Should not throw and should return DEFAULT_SETTINGS shape
    expect(result.current.settings).toBeDefined();
    expect(typeof result.current.settings.analyticsEnabled).toBe('boolean');
  });
});
