import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (#323 C2) ---

// #323 Cycle 3: capturamos el callback de onAuthStateChanged.
type AuthCallback = (user: { uid: string } | null) => void;
const authCallbacks = vi.hoisted(() => ({ list: [] as AuthCallback[] }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: AuthCallback) => {
    authCallbacks.list.push(cb);
    return () => {};
  },
}));
vi.mock('../config/firebase', () => ({ auth: {} }));

const mockUpdateUserSettings = vi.hoisted(() => vi.fn());
const mockFetchUserSettings = vi.hoisted(() => vi.fn());

vi.mock('../services/userSettings', () => ({
  fetchUserSettings: mockFetchUserSettings,
  updateUserSettings: mockUpdateUserSettings,
}));

vi.mock('../utils/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../utils/logger', () => ({ logger: { error: vi.fn() } }));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user1' } }),
}));

let mockIsOffline = false;
vi.mock('../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mockIsOffline }),
}));

import { useFollowedTags, __resetPendingTagsForTests } from './useFollowedTags';

describe('useFollowedTags — pending state module-level + flush effect (#323 C2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOffline = false;
    mockUpdateUserSettings.mockResolvedValue(undefined);
    mockFetchUserSettings.mockResolvedValue({ followedTags: ['barato'] });
    __resetPendingTagsForTests();
  });

  it('offline: followTag acumula snapshot sin llamar service', async () => {
    mockIsOffline = true;
    const { result } = renderHook(() => useFollowedTags());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.followTag('delivery', 'home');
    });

    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
    expect(result.current.tags).toContain('delivery');
  });

  it('offline -> online: flush effect aplica snapshot acumulado', async () => {
    mockIsOffline = true;
    const { result, rerender } = renderHook(() => useFollowedTags());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.followTag('delivery', 'home');
    });
    expect(mockUpdateUserSettings).not.toHaveBeenCalled();

    mockIsOffline = false;
    rerender();

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserSettings).toHaveBeenCalledWith('user1', expect.objectContaining({
        followedTags: ['barato', 'delivery'],
      }));
    });
  });

  it('pending sobrevive a unmount/remount: instancia A escribe offline, B (online) flushea', async () => {
    // Escenario real: BusinessSheet cierra (SwipeableDrawer desmonta) antes del reconnect.
    mockIsOffline = true;
    const a = renderHook(() => useFollowedTags());
    await waitFor(() => expect(a.result.current.loading).toBe(false));

    act(() => {
      a.result.current.followTag('delivery', 'business');
    });
    expect(mockUpdateUserSettings).not.toHaveBeenCalled();

    a.unmount();

    // Instancia B monta online (HomeScreen feed siempre vivo, p.ej.).
    mockIsOffline = false;
    const b = renderHook(() => useFollowedTags());
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserSettings).toHaveBeenCalledWith('user1', expect.objectContaining({
        followedTags: ['barato', 'delivery'],
      }));
    });
  });

  it('logout: snapshot del UID anterior se limpia al cambiar de cuenta (#323 C3 BLOCKER)', async () => {
    mockIsOffline = true;
    const a = renderHook(() => useFollowedTags());
    await waitFor(() => expect(a.result.current.loading).toBe(false));

    act(() => {
      a.result.current.followTag('delivery', 'home');
    });

    // auth(A) inicial
    act(() => {
      authCallbacks.list.forEach((cb) => cb({ uid: 'user1' }));
    });

    // Logout
    act(() => {
      authCallbacks.list.forEach((cb) => cb(null));
    });

    a.unmount();

    // A vuelve online; snapshot debe estar limpio
    mockIsOffline = false;
    const b = renderHook(() => useFollowedTags());
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
  });

  it('offline: unfollowTag también persiste a module-level y sobrevive unmount', async () => {
    mockIsOffline = true;
    const a = renderHook(() => useFollowedTags());
    await waitFor(() => expect(a.result.current.loading).toBe(false));

    act(() => {
      a.result.current.unfollowTag('barato', 'business');
    });
    expect(mockUpdateUserSettings).not.toHaveBeenCalled();

    a.unmount();

    mockIsOffline = false;
    const b = renderHook(() => useFollowedTags());
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledWith('user1', expect.objectContaining({
        followedTags: [],
      }));
    });
  });
});
