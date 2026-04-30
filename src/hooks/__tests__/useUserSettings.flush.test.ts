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

import { useUserSettings, __resetPendingSettingsForTests } from '../useUserSettings';

describe('useUserSettings — pending state module-level + flush effect (#323 C1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOffline = false;
    mockUpdateUserSettings.mockResolvedValue(undefined);
    __resetPendingSettingsForTests();
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

  it('offline: updateSetting acumula en module-level state sin llamar service', async () => {
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

  it('pending sobrevive a unmount/remount: instancia A escribe offline, B (online) flushea', async () => {
    // Instancia A monta offline, acumula pending y desmonta antes de reconnect
    mockIsOffline = true;
    const a = renderHook(() => useUserSettings());
    await waitFor(() => expect(a.result.current.loading).toBe(false));

    act(() => {
      a.result.current.updateSetting('profilePublic', true);
      a.result.current.updateSetting('notifyLikes', false);
    });
    expect(mockUpdateUserSettings).not.toHaveBeenCalled();

    // Unmount A — el pendingRef per-instance se perdería; module-level sobrevive.
    a.unmount();

    // Instancia B monta online (otro componente: NotificationsProvider, GreetingHeader…)
    mockIsOffline = false;
    const b = renderHook(() => useUserSettings());
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    // Flush effect de B aplica el snapshot que A acumuló
    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserSettings).toHaveBeenCalledWith('user1', {
        profilePublic: true,
        notifyLikes: false,
      });
    });
  });
});
