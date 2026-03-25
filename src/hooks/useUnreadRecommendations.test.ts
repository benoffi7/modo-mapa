import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCountUnread = vi.fn();

vi.mock('../services/recommendations', () => ({
  countUnreadRecommendations: (...args: unknown[]) => mockCountUnread(...args),
}));

let mockUser: { uid: string; isAnonymous?: boolean } | null = { uid: 'u1' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

import { useUnreadRecommendations } from './useUnreadRecommendations';

describe('useUnreadRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'u1' };
    mockCountUnread.mockResolvedValue(0);
  });

  it('fetches unread count for authenticated user', async () => {
    mockCountUnread.mockResolvedValue(3);
    const { result } = renderHook(() => useUnreadRecommendations());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unreadCount).toBe(3);
    expect(mockCountUnread).toHaveBeenCalledWith('u1');
  });

  it('returns 0 and stops loading for anonymous user', async () => {
    mockUser = { uid: 'anon1', isAnonymous: true };
    const { result } = renderHook(() => useUnreadRecommendations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unreadCount).toBe(0);
    expect(mockCountUnread).not.toHaveBeenCalled();
  });

  it('returns 0 and stops loading when no user', async () => {
    mockUser = null;
    const { result } = renderHook(() => useUnreadRecommendations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unreadCount).toBe(0);
    expect(mockCountUnread).not.toHaveBeenCalled();
  });

  it('falls back to 0 on error', async () => {
    mockCountUnread.mockRejectedValue(new Error('Network fail'));
    const { result } = renderHook(() => useUnreadRecommendations());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unreadCount).toBe(0);
  });
});
