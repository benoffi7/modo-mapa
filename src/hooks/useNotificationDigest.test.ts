import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppNotification, NotificationType } from '../types';

let mockNotifications: AppNotification[] = [];
let mockNotificationsLoading = false;

vi.mock('./useNotifications', () => ({
  useNotifications: () => ({ notifications: mockNotifications, loading: mockNotificationsLoading }),
}));

import { useNotificationDigest } from './useNotificationDigest';
import { DIGEST_MAX_GROUPS } from '../constants/notifications';

function makeNotification(
  id: string,
  type: NotificationType,
  read: boolean,
  createdAt: Date,
): AppNotification {
  return {
    id,
    userId: 'user1',
    type,
    message: `Notification ${id}`,
    read,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + 86400000),
  };
}

describe('useNotificationDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationsLoading = false;
    mockNotifications = [];
  });

  it('groups unread notifications by type', () => {
    mockNotifications = [
      makeNotification('n1', 'like', false, new Date('2026-03-28')),
      makeNotification('n2', 'like', false, new Date('2026-03-29')),
      makeNotification('n3', 'new_follower', false, new Date('2026-03-30')),
    ];

    const { result } = renderHook(() => useNotificationDigest());

    expect(result.current.groups).toHaveLength(2);
    expect(result.current.hasActivity).toBe(true);

    const likeGroup = result.current.groups.find((g) => g.type === 'like');
    expect(likeGroup).toBeDefined();
    expect(likeGroup!.count).toBe(2);
    expect(likeGroup!.label).toContain('2');
    expect(likeGroup!.label).toContain('me gusta en tus calificaciones'); // plural

    const followerGroup = result.current.groups.find((g) => g.type === 'new_follower');
    expect(followerGroup).toBeDefined();
    expect(followerGroup!.count).toBe(1);
    expect(followerGroup!.label).toContain('nuevo seguidor'); // singular
  });

  it('ignores read notifications', () => {
    mockNotifications = [
      makeNotification('n1', 'like', true, new Date('2026-03-28')),
      makeNotification('n2', 'like', false, new Date('2026-03-29')),
    ];

    const { result } = renderHook(() => useNotificationDigest());

    const likeGroup = result.current.groups.find((g) => g.type === 'like');
    expect(likeGroup!.count).toBe(1);
  });

  it('returns empty groups and hasActivity=false when all read', () => {
    mockNotifications = [
      makeNotification('n1', 'like', true, new Date('2026-03-28')),
    ];

    const { result } = renderHook(() => useNotificationDigest());

    expect(result.current.groups).toEqual([]);
    expect(result.current.hasActivity).toBe(false);
  });

  it('returns empty groups when there are no notifications', () => {
    mockNotifications = [];

    const { result } = renderHook(() => useNotificationDigest());

    expect(result.current.groups).toEqual([]);
    expect(result.current.hasActivity).toBe(false);
  });

  it('sorts groups by latest notification date descending', () => {
    mockNotifications = [
      makeNotification('n1', 'like', false, new Date('2026-03-25')),
      makeNotification('n2', 'new_follower', false, new Date('2026-03-30')),
      makeNotification('n3', 'ranking', false, new Date('2026-03-28')),
    ];

    const { result } = renderHook(() => useNotificationDigest());

    expect(result.current.groups[0].type).toBe('new_follower');
    expect(result.current.groups[1].type).toBe('ranking');
    expect(result.current.groups[2].type).toBe('like');
  });

  it('limits groups to DIGEST_MAX_GROUPS', () => {
    const types: NotificationType[] = [
      'like', 'new_follower', 'ranking', 'comment_reply', 'recommendation',
    ];
    mockNotifications = types.map((type, i) =>
      makeNotification(`n${i}`, type, false, new Date(`2026-03-${20 + i}`)),
    );

    const { result } = renderHook(() => useNotificationDigest());

    expect(result.current.groups).toHaveLength(DIGEST_MAX_GROUPS);
    // Should be the 3 most recent
    expect(result.current.groups.map((g) => g.type)).toEqual([
      'recommendation', 'comment_reply', 'ranking',
    ]);
  });

  it('uses singular label for count of 1', () => {
    mockNotifications = [
      makeNotification('n1', 'ranking', false, new Date('2026-03-30')),
    ];

    const { result } = renderHook(() => useNotificationDigest());

    expect(result.current.groups[0].label).toBe('1 cambio en el ranking');
  });

  it('latestAt reflects the most recent notification in the group', () => {
    const older = new Date('2026-03-25');
    const newer = new Date('2026-03-30');
    mockNotifications = [
      makeNotification('n1', 'like', false, older),
      makeNotification('n2', 'like', false, newer),
    ];

    const { result } = renderHook(() => useNotificationDigest());

    expect(result.current.groups[0].latestAt).toEqual(newer);
  });

  it('passes loading state from useNotifications', () => {
    mockNotificationsLoading = true;
    const { result } = renderHook(() => useNotificationDigest());

    expect(result.current.loading).toBe(true);
  });
});
