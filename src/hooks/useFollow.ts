import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { MSG_SOCIAL } from '../constants/messages';
import { useConnectivity } from './useConnectivity';
import { isFollowing as checkIsFollowing, followUser, unfollowUser } from '../services/follows';
import { withOfflineSupport } from '../services/offlineInterceptor';
import { logger } from '../utils/logger';

export function useFollow(targetUserId: string | undefined) {
  const { user } = useAuth();
  const toast = useToast();
  const { isOffline } = useConnectivity();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const userId = user?.uid;
  const isSelf = userId === targetUserId;

  useEffect(() => {
    if (!userId || !targetUserId || isSelf) {
      setFollowing(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    checkIsFollowing(userId, targetUserId).then((val) => {
      if (!cancelled) {
        setFollowing(val);
        setLoading(false);
      }
    }).catch((err) => {
      if (import.meta.env.DEV) logger.error('isFollowing check failed:', err);
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [userId, targetUserId, isSelf]);

  const toggle = useCallback(async () => {
    if (!userId || !targetUserId || isSelf || toggling) return;

    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setToggling(true);

    try {
      if (wasFollowing) {
        await withOfflineSupport(
          isOffline, 'follow_remove',
          { userId, businessId: targetUserId },
          { followedId: targetUserId },
          () => unfollowUser(userId, targetUserId),
          toast,
        );
      } else {
        await withOfflineSupport(
          isOffline, 'follow_add',
          { userId, businessId: targetUserId },
          { followedId: targetUserId },
          () => followUser(userId, targetUserId),
          toast,
        );
      }
    } catch (err) {
      setFollowing(wasFollowing);
      if (import.meta.env.DEV) logger.error('Follow toggle failed:', err);
      toast.error(err instanceof Error ? err.message : MSG_SOCIAL.followError);
    } finally {
      setToggling(false);
    }
  }, [userId, targetUserId, isSelf, toggling, following, isOffline, toast]);

  return { following, loading, toggling, toggle, isSelf };
}
