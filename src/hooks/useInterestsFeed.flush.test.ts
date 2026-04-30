import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (#323 C2) ---

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
