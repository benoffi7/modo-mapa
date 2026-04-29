import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (#323 C1) ---

const mockUpdateUserSettings = vi.hoisted(() => vi.fn());
const mockFetchUserSettings = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
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
    notificationDigest: 'instant',
    locality: '',
    localityLat: 0,
    localityLng: 0,
    interests: [],
    followedTags: [],
    blockedUsers: [],
    updatedAt: new Date(),
  }),
);

vi.mock('../../services/userSettings', () => ({
  updateUserSettings: mockUpdateUserSettings,
  fetchUserSettings: mockFetchUserSettings,
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
    notificationDigest: 'instant',
    locality: '',
    localityLat: 0,
    localityLng: 0,
    interests: [],
    followedTags: [],
    blockedUsers: [],
    updatedAt: new Date(),
  },
}));

vi.mock('../../utils/analytics', () => ({
  setAnalyticsEnabled: vi.fn(),
  initAnalytics: vi.fn(),
  trackEvent: vi.fn(),
}));
vi.mock('../../utils/perfMetrics', () => ({ initPerfMetrics: vi.fn() }));

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
vi.mock('../../context/ToastContext', () => ({ useToast: () => mockToast }));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user1' }, displayName: 'Test User' }),
}));

let mockIsOffline = false;
vi.mock('../../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mockIsOffline }),
}));

import { useUserSettings } from '../useUserSettings';

describe('useUserSettings — pendingRef + flush effect (#323 C1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOffline = false;
    mockUpdateUserSettings.mockResolvedValue(undefined);
  });

  it('online: updateSetting llama service inmediato', async () => {
    mockIsOffline = false;
    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateSetting('profilePublic', true);
    });

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledWith('user1', { profilePublic: true });
    });
  });

  it('offline: updateSetting acumula en pendingRef sin llamar service', async () => {
    mockIsOffline = true;
    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateSetting('profilePublic', true);
      result.current.updateSetting('notifyLikes', false);
    });

    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
    // Optimistic state aplicado
    expect(result.current.settings.profilePublic).toBe(true);
    expect(result.current.settings.notifyLikes).toBe(false);
  });

  it('offline -> online: flush effect aplica el snapshot acumulado', async () => {
    mockIsOffline = true;
    const { result, rerender } = renderHook(() => useUserSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateSetting('profilePublic', true);
      result.current.updateSetting('notifyLikes', false);
    });
    expect(mockUpdateUserSettings).not.toHaveBeenCalled();

    // Volver online
    mockIsOffline = false;
    rerender();

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserSettings).toHaveBeenCalledWith('user1', {
        profilePublic: true,
        notifyLikes: false,
      });
    });
  });

  it('flushPendingSettings expuesto: invocacion manual aplica snapshot', async () => {
    mockIsOffline = true;
    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateSetting('analyticsEnabled', false);
    });

    // Llamar flush manualmente (sin await act — el await sale del wrap)
    await result.current.flushPendingSettings();

    expect(mockUpdateUserSettings).toHaveBeenCalledWith('user1', {
      analyticsEnabled: false,
    });
  });

  it('flushPendingSettings sin pending: no-op', async () => {
    const { result } = renderHook(() => useUserSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.flushPendingSettings();

    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
  });
});
