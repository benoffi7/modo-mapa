import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAsyncData } from './useAsyncData';
import { fetchUserSettings, updateUserSettings } from '../services/userSettings';
import { MAX_FOLLOWED_TAGS } from '../constants/interests';
import { VALID_TAG_IDS } from '../constants/tags';
import { trackEvent } from '../utils/analytics';
import { logger } from '../utils/logger';
import type { UserSettings } from '../types';

/**
 * CRUD hook for followed tags. Reads from userSettings and persists
 * follow/unfollow changes via updateUserSettings.
 */
export function useFollowedTags() {
  const { user } = useAuth();
  const [optimisticTags, setOptimisticTags] = useState<string[] | null>(null);

  const fetcher = useCallback(async (): Promise<UserSettings | null> => {
    if (!user) return null;
    return fetchUserSettings(user.uid);
  }, [user]);

  const { data: settings } = useAsyncData(fetcher);

  const serverTags = settings?.followedTags ?? [];
  const tags = optimisticTags ?? serverTags;

  // Sync optimistic state when server data arrives
  useEffect(() => {
    if (optimisticTags !== null && settings) {
      setOptimisticTags(null);
    }
    // Only reset when settings change, not on every optimistic update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const followTag = useCallback(
    (tag: string, source: 'home' | 'business' | 'search' | 'profile' = 'home') => {
      if (!user) return;
      const current = optimisticTags ?? serverTags;
      if (current.length >= MAX_FOLLOWED_TAGS) return;
      if (current.includes(tag)) return;

      const next = [...current, tag];
      setOptimisticTags(next);

      trackEvent('tag_followed', { tag, source });

      updateUserSettings(user.uid, {
        followedTags: next,
        followedTagsUpdatedAt: new Date(),
      }).catch((err) => {
        logger.error('[useFollowedTags] followTag failed:', err);
        setOptimisticTags(null);
      });
    },
    [user, optimisticTags, serverTags],
  );

  const unfollowTag = useCallback(
    (tag: string, source: 'home' | 'business' | 'search' | 'profile' = 'home') => {
      if (!user) return;
      const current = optimisticTags ?? serverTags;
      if (!current.includes(tag)) return;

      const next = current.filter((t) => t !== tag);
      setOptimisticTags(next);

      trackEvent('tag_unfollowed', { tag, source });

      updateUserSettings(user.uid, {
        followedTags: next,
        followedTagsUpdatedAt: new Date(),
      }).catch((err) => {
        logger.error('[useFollowedTags] unfollowTag failed:', err);
        setOptimisticTags(null);
      });
    },
    [user, optimisticTags, serverTags],
  );

  const isFollowed = useCallback(
    (tag: string) => tags.includes(tag),
    [tags],
  );

  const isValidTag = useCallback(
    (tag: string) => VALID_TAG_IDS.includes(tag),
    [],
  );

  return { tags, followTag, unfollowTag, isFollowed, isValidTag, loading: !settings && !!user };
}
