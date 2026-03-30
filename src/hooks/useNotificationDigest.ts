import { useMemo } from 'react';
import { useNotifications } from './useNotifications';
import { DIGEST_LABELS, DIGEST_MAX_GROUPS } from '../constants/notifications';
import type { DigestGroup, NotificationType } from '../types';

interface UseNotificationDigestResult {
  groups: DigestGroup[];
  hasActivity: boolean;
  loading: boolean;
}

export function useNotificationDigest(): UseNotificationDigestResult {
  const { notifications, loading } = useNotifications();

  const groups = useMemo(() => {
    const unread = notifications.filter((n) => !n.read);

    // Group by type
    const grouped = new Map<NotificationType, typeof unread>();
    for (const n of unread) {
      const existing = grouped.get(n.type);
      if (existing) {
        existing.push(n);
      } else {
        grouped.set(n.type, [n]);
      }
    }

    // Build DigestGroup for each type
    const result: DigestGroup[] = [];
    for (const [type, items] of grouped) {
      const meta = DIGEST_LABELS[type];
      const count = items.length;
      const latestAt = items.reduce(
        (max, n) => (n.createdAt > max ? n.createdAt : max),
        items[0].createdAt,
      );
      result.push({
        type,
        count,
        label: `${count} ${count === 1 ? meta.singular : meta.plural}`,
        icon: meta.icon,
        latestAt,
        notifications: items,
      });
    }

    // Sort by latest first, take max groups
    result.sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());
    return result.slice(0, DIGEST_MAX_GROUPS);
  }, [notifications]);

  return {
    groups,
    hasActivity: groups.length > 0,
    loading,
  };
}
