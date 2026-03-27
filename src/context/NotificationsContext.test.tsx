import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetchUserNotifications = vi.fn();
const mockMarkNotificationRead = vi.fn();
const mockMarkAllNotificationsRead = vi.fn();
const mockGetUnreadCount = vi.fn();

vi.mock('../services/notifications', () => ({
  fetchUserNotifications: (...args: unknown[]) => mockFetchUserNotifications(...args),
  markNotificationRead: (...args: unknown[]) => mockMarkNotificationRead(...args),
  markAllNotificationsRead: (...args: unknown[]) => mockMarkAllNotificationsRead(...args),
  getUnreadCount: (...args: unknown[]) => mockGetUnreadCount(...args),
}));

vi.mock('../utils/logger', () => ({ logger: { error: vi.fn() } }));

vi.mock('../constants/timing', () => ({
  POLL_INTERVAL_MS: 60000,
}));

let mockUser: { uid: string } | null = { uid: 'user1' };
vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

import { NotificationsProvider, useNotifications } from './NotificationsContext';

function wrapper({ children }: { children: ReactNode }) {
  return <NotificationsProvider>{children}</NotificationsProvider>;
}

describe('NotificationsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { uid: 'user1' };
    mockFetchUserNotifications.mockResolvedValue([]);
    mockGetUnreadCount.mockResolvedValue(0);
    mockMarkNotificationRead.mockResolvedValue(undefined);
    mockMarkAllNotificationsRead.mockResolvedValue(undefined);
  });

  it('throws when useNotifications is used outside provider', () => {
    expect(() => {
      renderHook(() => useNotifications());
    }).toThrow('useNotifications must be used within NotificationsProvider');
  });

  it('loads notifications on mount when user exists', async () => {
    const notifs = [
      { id: 'n-1', read: false, message: 'Hello' },
      { id: 'n-2', read: true, message: 'Old' },
    ];
    mockFetchUserNotifications.mockResolvedValue(notifs);
    mockGetUnreadCount.mockResolvedValue(1);

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notifications).toEqual(notifs);
    expect(result.current.unreadCount).toBe(1);
    expect(mockFetchUserNotifications).toHaveBeenCalledWith('user1');
    expect(mockGetUnreadCount).toHaveBeenCalledWith('user1');
  });

  it('returns empty notifications when no user', async () => {
    mockUser = null;

    const { result } = renderHook(() => useNotifications(), { wrapper });

    // Give it time to settle
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(mockFetchUserNotifications).not.toHaveBeenCalled();
  });

  it('markRead updates notification and decrements count', async () => {
    const notifs = [
      { id: 'n-1', read: false, message: 'Hello' },
      { id: 'n-2', read: false, message: 'World' },
    ];
    mockFetchUserNotifications.mockResolvedValue(notifs);
    mockGetUnreadCount.mockResolvedValue(2);

    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.markRead('n-1');
    });

    expect(mockMarkNotificationRead).toHaveBeenCalledWith('n-1');
    expect(result.current.unreadCount).toBe(1);
    const updated = result.current.notifications.find((n) => n.id === 'n-1');
    expect(updated?.read).toBe(true);
  });

  it('markRead does not decrement below zero', async () => {
    mockFetchUserNotifications.mockResolvedValue([{ id: 'n-1', read: false }]);
    mockGetUnreadCount.mockResolvedValue(0);

    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.markRead('n-1');
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('markAllRead marks all notifications as read', async () => {
    const notifs = [
      { id: 'n-1', read: false },
      { id: 'n-2', read: false },
    ];
    mockFetchUserNotifications.mockResolvedValue(notifs);
    mockGetUnreadCount.mockResolvedValue(2);

    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(mockMarkAllNotificationsRead).toHaveBeenCalledWith('user1');
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  it('markAllRead does nothing when no user', async () => {
    mockUser = null;

    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(mockMarkAllNotificationsRead).not.toHaveBeenCalled();
  });

  it('refresh reloads notifications', async () => {
    mockFetchUserNotifications.mockResolvedValue([]);
    mockGetUnreadCount.mockResolvedValue(0);

    const { result } = renderHook(() => useNotifications(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockFetchUserNotifications.mockResolvedValue([{ id: 'n-new', read: false }]);
    mockGetUnreadCount.mockResolvedValue(1);

    act(() => { result.current.refresh(); });

    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    expect(result.current.unreadCount).toBe(1);
  });

  it('handles fetch error gracefully', async () => {
    mockFetchUserNotifications.mockRejectedValue(new Error('Network error'));
    mockGetUnreadCount.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Should not crash, notifications stay empty
    expect(result.current.notifications).toEqual([]);
  });

  it('sets loading while fetching', async () => {
    let resolveFetch!: (value: unknown[]) => void;
    mockFetchUserNotifications.mockImplementation(() => new Promise((r) => { resolveFetch = r; }));
    mockGetUnreadCount.mockResolvedValue(0);

    const { result } = renderHook(() => useNotifications(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => { resolveFetch([]); });

    expect(result.current.loading).toBe(false);
  });
});
