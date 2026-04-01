import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import {
  fetchUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from '../services/notifications';
import { POLL_INTERVAL_MS } from '../constants/timing';
import type { AppNotification, DigestFrequency } from '../types';
import { useUserSettings } from '../hooks/useUserSettings';
import { MSG_COMMON } from '../constants/messages';
import { logger } from '../utils/logger';

const EMPTY_NOTIFICATIONS: AppNotification[] = [];

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { settings } = useUserSettings();
  const toast = useToast();
  const digestFrequency: DigestFrequency = settings.notificationDigest ?? 'realtime';
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
      if (import.meta.env.DEV) logger.error('Error loading notifications:', err);
    }
  }, []);

  const loadCountOnly = useCallback(async (userId: string) => {
    try {
      const count = await getUnreadCount(userId);
      setUnreadCount(count);
    } catch (err) {
      logger.warn('[NotificationsContext] loadCountOnly failed:', err);
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

    // Only poll when digest frequency is 'realtime'; daily/weekly load once on mount
    if (digestFrequency === 'realtime') {
      const currentUid = uid;
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          loadCountOnly(currentUid);
        }
      }, POLL_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [uid, digestFrequency, loadNotifications, loadCountOnly]);

  const markRead = useCallback(async (notificationId: string) => {
    // optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationRead(notificationId);
    } catch (err) {
      logger.warn('[NotificationsContext] markRead failed:', err);
      // revert
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: false } : n)),
      );
      setUnreadCount((prev) => prev + 1);
      toast.error(MSG_COMMON.markReadError);
    }
  }, [toast]);

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    const prevNotifications = notifications;
    const prevCount = unreadCount;
    // optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(uid);
    } catch (err) {
      logger.warn('[NotificationsContext] markAllRead failed:', err);
      // revert
      setNotifications(prevNotifications);
      setUnreadCount(prevCount);
      toast.error(MSG_COMMON.markAllReadError);
    }
  }, [uid, notifications, unreadCount, toast]);

  const refresh = useCallback(() => {
    if (uid) loadNotifications(uid);
  }, [uid, loadNotifications]);

  const effectiveNotifications = uid ? notifications : EMPTY_NOTIFICATIONS;
  const effectiveUnreadCount = uid ? unreadCount : 0;

  const value = useMemo(() => ({
    notifications: effectiveNotifications,
    unreadCount: effectiveUnreadCount,
    loading,
    markRead,
    markAllRead,
    refresh,
  }), [effectiveNotifications, effectiveUnreadCount, loading, markRead, markAllRead, refresh]);

  return (
    <NotificationsContext value={value}>
      {children}
    </NotificationsContext>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
