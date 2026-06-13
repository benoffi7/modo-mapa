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

let mockTags: string[] = [];
let mockTagsLoading = false;

vi.mock('./useFollowedTags', () => ({
  useFollowedTags: () => ({ tags: mockTags, loading: mockTagsLoading }),
}));

vi.mock('../services/userSettings', () => ({
  updateUserSettings: mockUpdateUserSettings,
}));

vi.mock('../utils/logger', () => ({ logger: { error: vi.fn() } }));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user1' } }),
}));

let mockIsOffline = false;
vi.mock('../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: mockIsOffline }),
}));

vi.mock('./useBusinesses', () => ({
  get allBusinesses() {
    return [];
  },
}));

import { useInterestsFeed, __resetPendingSeenForTests } from './useInterestsFeed';

describe('useInterestsFeed — pending markSeen module-level + flush (#323 C2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOffline = false;
    mockTags = ['barato'];
    mockTagsLoading = false;
    mockUpdateUserSettings.mockResolvedValue(undefined);
    __resetPendingSeenForTests();
  });

  it('offline: markSeen acumula snapshot sin llamar service', () => {
    mockIsOffline = true;
    const { result } = renderHook(() => useInterestsFeed());

    act(() => {
      result.current.markSeen();
    });

    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
  });

  it('offline -> online: flush effect aplica el snapshot acumulado', async () => {
    mockIsOffline = true;
    const { result, rerender } = renderHook(() => useInterestsFeed());

    act(() => {
      result.current.markSeen();
    });
    expect(mockUpdateUserSettings).not.toHaveBeenCalled();

    mockIsOffline = false;
    rerender();

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserSettings).toHaveBeenCalledWith('user1', expect.objectContaining({
        followedTagsLastSeenAt: expect.any(Date),
      }));
    });
  });

  it('logout: snapshot del UID anterior se limpia al cambiar de cuenta (#323 C3 BLOCKER)', async () => {
    mockIsOffline = true;
    const a = renderHook(() => useInterestsFeed());

    act(() => {
      a.result.current.markSeen();
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
    const b = renderHook(() => useInterestsFeed());

    // Esperamos que NO se llame updateUserSettings (snapshot fue limpiado)
    await new Promise((r) => setTimeout(r, 10));
    expect(mockUpdateUserSettings).not.toHaveBeenCalled();

    b.unmount();
  });

  it('pending sobrevive a unmount/remount: instancia A markSeen offline, B (online) flushea', async () => {
    mockIsOffline = true;
    const a = renderHook(() => useInterestsFeed());

    act(() => {
      a.result.current.markSeen();
    });
    expect(mockUpdateUserSettings).not.toHaveBeenCalled();

    a.unmount();

    mockIsOffline = false;
    const b = renderHook(() => useInterestsFeed());

    await waitFor(() => {
      expect(mockUpdateUserSettings).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserSettings).toHaveBeenCalledWith('user1', expect.objectContaining({
        followedTagsLastSeenAt: expect.any(Date),
      }));
    });

    b.unmount();
  });
});
