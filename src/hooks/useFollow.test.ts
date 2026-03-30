import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFollowUser = vi.fn();
const mockUnfollowUser = vi.fn();
const mockIsFollowing = vi.fn();
const mockWithOfflineSupport = vi.fn();
const mockToastError = vi.fn();

vi.mock('../services/follows', () => ({
  isFollowing: (...args: unknown[]) => mockIsFollowing(...args),
  followUser: (...args: unknown[]) => mockFollowUser(...args),
  unfollowUser: (...args: unknown[]) => mockUnfollowUser(...args),
}));

vi.mock('../services/offlineInterceptor', () => ({
  withOfflineSupport: (...args: unknown[]) => mockWithOfflineSupport(...args),
}));

vi.mock('../utils/logger', () => ({ logger: { error: vi.fn() } }));

let mockUser: { uid: string } | null = { uid: 'currentUser' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ error: mockToastError }),
}));

let mockIsOffline = false;
vi.mock('./useConnectivity', () => ({
  useConnectivity: () => ({ isOffline: mockIsOffline }),
}));

import { useFollow } from './useFollow';

describe('useFollow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'currentUser' };
    mockIsOffline = false;
    mockIsFollowing.mockResolvedValue(false);
    mockWithOfflineSupport.mockImplementation(
      (_offline: boolean, _action: string, _key: object, _meta: object, fn: () => Promise<void>) => fn(),
    );
    mockFollowUser.mockResolvedValue(undefined);
    mockUnfollowUser.mockResolvedValue(undefined);
  });

  it('loads initial following state', async () => {
    mockIsFollowing.mockResolvedValue(true);
    const { result } = renderHook(() => useFollow('targetUser'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.following).toBe(true);
  });

  it('sets isSelf=true and skips fetch when target is current user', async () => {
    const { result } = renderHook(() => useFollow('currentUser'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isSelf).toBe(true);
    expect(result.current.following).toBe(false);
    expect(mockIsFollowing).not.toHaveBeenCalled();
  });

  it('handles undefined targetUserId', async () => {
    const { result } = renderHook(() => useFollow(undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.following).toBe(false);
    expect(mockIsFollowing).not.toHaveBeenCalled();
  });

  it('handles no authenticated user', async () => {
    mockUser = null;
    const { result } = renderHook(() => useFollow('targetUser'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.following).toBe(false);
    expect(mockIsFollowing).not.toHaveBeenCalled();
  });

  it('optimistically toggles to follow', async () => {
    mockIsFollowing.mockResolvedValue(false);
    const { result } = renderHook(() => useFollow('targetUser'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.toggle(); });

    expect(result.current.following).toBe(true);
    expect(mockFollowUser).toHaveBeenCalledWith('currentUser', 'targetUser');
  });

  it('optimistically toggles to unfollow', async () => {
    mockIsFollowing.mockResolvedValue(true);
    const { result } = renderHook(() => useFollow('targetUser'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.following).toBe(true);

    await act(async () => { await result.current.toggle(); });

    expect(result.current.following).toBe(false);
    expect(mockUnfollowUser).toHaveBeenCalledWith('currentUser', 'targetUser');
  });

  it('rolls back on error and shows toast', async () => {
    mockIsFollowing.mockResolvedValue(false);
    mockWithOfflineSupport.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFollow('targetUser'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.toggle(); });

    expect(result.current.following).toBe(false); // rolled back
    expect(mockToastError).toHaveBeenCalledWith('Network error');
  });

  it('shows generic error message for non-Error throws', async () => {
    mockIsFollowing.mockResolvedValue(false);
    mockWithOfflineSupport.mockRejectedValue('string error');

    const { result } = renderHook(() => useFollow('targetUser'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.toggle(); });

    expect(result.current.following).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith('No se pudo actualizar el seguimiento');
  });

  it('prevents toggle when isSelf', async () => {
    const { result } = renderHook(() => useFollow('currentUser'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.toggle(); });

    expect(mockWithOfflineSupport).not.toHaveBeenCalled();
  });

  it('prevents double toggle while toggling', async () => {
    let resolveFollow!: () => void;
    mockWithOfflineSupport.mockImplementation(
      () => new Promise<void>((resolve) => { resolveFollow = resolve; }),
    );
    mockIsFollowing.mockResolvedValue(false);

    const { result } = renderHook(() => useFollow('targetUser'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Start first toggle
    let firstToggle: Promise<void>;
    act(() => { firstToggle = result.current.toggle(); });

    expect(result.current.toggling).toBe(true);

    // Try second toggle while first is in progress
    await act(async () => { await result.current.toggle(); });

    // Only one call should have been made
    expect(mockWithOfflineSupport).toHaveBeenCalledTimes(1);

    // Resolve first toggle
    await act(async () => {
      resolveFollow();
      await firstToggle!;
    });

    expect(result.current.toggling).toBe(false);
  });
});
