import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from '../services/notifications';
import type { AppNotification } from '../types';

const POLL_INTERVAL_MS = 60_000;
const EMPTY_NOTIFICATIONS: AppNotification[] = [];

interface UseNotificationsReturn {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [notifications, setNotifications] = useState<AppNotification[]>(EMPTY_NOTIFICATIONS);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadNotifications = useCallback(async (userId: string) => {
    try {
      const [notifs, count] = await Promise.all([
        fetchUserNotifications(userId),
        getUnreadCount(userId),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error loading notifications:', err);
    }
  }, []);

  const loadCountOnly = useCallback(async (userId: string) => {
    try {
      const count = await getUnreadCount(userId);
      setUnreadCount(count);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!uid) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount/dependency change
    setLoading(true);
    loadNotifications(uid).finally(() => setLoading(false));

    const currentUid = uid;
    intervalRef.current = setInterval(() => loadCountOnly(currentUid), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [uid, loadNotifications, loadCountOnly]);

  const markRead = useCallback(async (notificationId: string) => {
    await markNotificationRead(notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    await markAllNotificationsRead(uid);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [uid]);

  const refresh = useCallback(() => {
    if (uid) loadNotifications(uid);
  }, [uid, loadNotifications]);

  // When user is null, return empty state without storing it
  const effectiveNotifications = uid ? notifications : EMPTY_NOTIFICATIONS;
  const effectiveUnreadCount = uid ? unreadCount : 0;

  return useMemo(() => ({
    notifications: effectiveNotifications,
    unreadCount: effectiveUnreadCount,
    loading,
    markRead,
    markAllRead,
    refresh,
  }), [effectiveNotifications, effectiveUnreadCount, loading, markRead, markAllRead, refresh]);
}
