import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// #323 Cycle 3: el hook ahora registra onAuthStateChanged a module-level para
// limpiar pendingTagsByUser en logout. Necesitamos mockear firebase/auth + config.
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: () => () => {},
}));
vi.mock('../config/firebase', () => ({ auth: {} }));

const mockFetchUserSettings = vi.fn();
const mockUpdateUserSettings = vi.fn();
const mockTrackEvent = vi.fn();

vi.mock('../services/userSettings', () => ({
  fetchUserSettings: (...args: unknown[]) => mockFetchUserSettings(...args),
  updateUserSettings: (...args: unknown[]) => mockUpdateUserSettings(...args),
}));

vi.mock('../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock('../utils/logger', () => ({ logger: { error: vi.fn() } }));

let mockUser: { uid: string } | null = { uid: 'user1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../context/ConnectivityContext', () => ({
  useConnectivity: () => ({ isOffline: false }),
}));

import { useFollowedTags } from './useFollowedTags';
import { MAX_FOLLOWED_TAGS } from '../constants/interests';
import { EVT_TAG_FOLLOWED, EVT_TAG_UNFOLLOWED } from '../constants/analyticsEvents';

describe('useFollowedTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'user1' };
    mockFetchUserSettings.mockResolvedValue({ followedTags: ['barato', 'delivery'] });
    mockUpdateUserSettings.mockResolvedValue(undefined);
  });

  it('loads followed tags from user settings', async () => {
    const { result } = renderHook(() => useFollowedTags());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tags).toEqual(['barato', 'delivery']);
    expect(mockFetchUserSettings).toHaveBeenCalledWith('user1');
  });

  it('returns empty tags and no loading when user is null', async () => {
    mockUser = null;
    const { result } = renderHook(() => useFollowedTags());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tags).toEqual([]);
    expect(mockFetchUserSettings).not.toHaveBeenCalled();
  });

  it('followTag adds tag optimistically and persists', async () => {
    const { result } = renderHook(() => useFollowedTags());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.followTag('rapido', 'home');
    });

    expect(result.current.tags).toContain('rapido');
    expect(mockTrackEvent).toHaveBeenCalledWith(EVT_TAG_FOLLOWED, { tag: 'rapido', source: 'home' });
    expect(mockUpdateUserSettings).toHaveBeenCalledWith('user1', expect.objectContaining({
      followedTags: ['barato', 'delivery', 'rapido'],
    }));
  });

  it('unfollowTag removes tag optimistically and persists', async () => {
    const { result } = renderHook(() => useFollowedTags());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.unfollowTag('barato', 'search');
    });

    expect(result.current.tags).not.toContain('barato');
    expect(mockTrackEvent).toHaveBeenCalledWith(EVT_TAG_UNFOLLOWED, { tag: 'barato', source: 'search' });
    expect(mockUpdateUserSettings).toHaveBeenCalledWith('user1', expect.objectContaining({
      followedTags: ['delivery'],
    }));
  });

  it('does not follow a tag that is already followed', async () => {
    const { result } = renderHook(() => useFollowedTags());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.followTag('barato');
    });

    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
  });

  it('does not unfollow a tag that is not followed', async () => {
    const { result } = renderHook(() => useFollowedTags());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.unfollowTag('rapido');
    });

    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
  });

  it('does not follow when MAX_FOLLOWED_TAGS is reached', async () => {
    const maxTags = Array.from({ length: MAX_FOLLOWED_TAGS }, (_, i) => `tag_${i}`);
    mockFetchUserSettings.mockResolvedValue({ followedTags: maxTags });
    const { result } = renderHook(() => useFollowedTags());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.followTag('extra_tag');
    });

    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
    expect(result.current.tags).toHaveLength(MAX_FOLLOWED_TAGS);
  });

  it('followTag is a no-op when user is null', async () => {
    mockUser = null;
    const { result } = renderHook(() => useFollowedTags());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.followTag('barato');
    });

    expect(mockUpdateUserSettings).not.toHaveBeenCalled();
  });

  it('isFollowed returns correct boolean', async () => {
    const { result } = renderHook(() => useFollowedTags());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isFollowed('barato')).toBe(true);
    expect(result.current.isFollowed('rapido')).toBe(false);
  });

  it('isValidTag validates against VALID_TAG_IDS', async () => {
    const { result } = renderHook(() => useFollowedTags());

    expect(result.current.isValidTag('barato')).toBe(true);
    expect(result.current.isValidTag('nonexistent_tag')).toBe(false);
  });

  it('returns empty tags when settings have no followedTags field', async () => {
    mockFetchUserSettings.mockResolvedValue({});
    const { result } = renderHook(() => useFollowedTags());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tags).toEqual([]);
  });

  // Verification that useFollowedTags.ts has no eslint-disable comments
  // is enforced by the lint step (Phase 4), not by a runtime test.
});
