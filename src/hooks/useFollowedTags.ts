import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useAsyncData } from './useAsyncData';
import { fetchUserSettings, updateUserSettings } from '../services/userSettings';
import { MAX_FOLLOWED_TAGS } from '../constants/interests';
import { VALID_TAG_IDS } from '../constants/tags';
import { trackEvent } from '../utils/analytics';
import { EVT_TAG_FOLLOWED, EVT_TAG_UNFOLLOWED } from '../constants/analyticsEvents';
import { logger } from '../utils/logger';
import type { UserSettings } from '../types';

/**
 * Optimistic tags state that auto-resets when the server settings version changes.
 * Each time settings changes identity, pending is cleared so server truth wins.
 */
function useOptimisticTags(settings: UserSettings | null) {
  const [state, setState] = useState<{
    pending: string[] | null;
    settingsVersion: UserSettings | null;
  }>({ pending: null, settingsVersion: settings });

  // If settings identity changed, discard optimistic state (React-safe pattern:
  // derive state from props during render without effects or refs).
  const pending =
    settings !== state.settingsVersion ? null : state.pending;

  const setPending = useCallback(
    (next: string[] | null) =>
      setState((prev) => ({ ...prev, pending: next })),
    [],
  );

  // Keep settingsVersion in sync so the comparison above works on subsequent renders.
  if (settings !== state.settingsVersion) {
    setState({ pending: null, settingsVersion: settings });
  }

  return [pending, setPending] as const;
}

/**
 * CRUD hook for followed tags. Reads from userSettings and persists
 * follow/unfollow changes via updateUserSettings.
 */
export function useFollowedTags() {
  const { user } = useAuth();
  const { isOffline } = useConnectivity();
  // #323 C2: snapshot pendiente cuando offline; flush al reconectar.
  const pendingTagsRef = useRef<string[] | null>(null);

  const fetcher = useCallback(async (): Promise<UserSettings | null> => {
    if (!user) return null;
    return fetchUserSettings(user.uid);
  }, [user]);

  const { data: settings } = useAsyncData(fetcher);

  const [optimisticTags, setOptimisticTags] = useOptimisticTags(settings);

  const serverTags = useMemo(
    () => settings?.followedTags ?? [],
    [settings?.followedTags],
  );
  const tags = optimisticTags ?? serverTags;

  const followTag = useCallback(
    (tag: string, source: 'home' | 'business' | 'search' | 'profile' = 'home') => {
      if (!user) return;
      const current = optimisticTags ?? serverTags;
      if (current.length >= MAX_FOLLOWED_TAGS) return;
      if (current.includes(tag)) return;

      const next = [...current, tag];
      setOptimisticTags(next);

      trackEvent(EVT_TAG_FOLLOWED, { tag, source });

      // #323: offline → acumular snapshot, flush al reconectar.
      if (isOffline) {
        pendingTagsRef.current = next;
        return;
      }

      updateUserSettings(user.uid, {
        followedTags: next,
        followedTagsUpdatedAt: new Date(),
      }).catch((err) => {
        logger.error('[useFollowedTags] followTag failed:', err);
        setOptimisticTags(null);
      });
    },
    [user, isOffline, optimisticTags, serverTags, setOptimisticTags],
  );

  const unfollowTag = useCallback(
    (tag: string, source: 'home' | 'business' | 'search' | 'profile' = 'home') => {
      if (!user) return;
      const current = optimisticTags ?? serverTags;
      if (!current.includes(tag)) return;

      const next = current.filter((t) => t !== tag);
      setOptimisticTags(next);

      trackEvent(EVT_TAG_UNFOLLOWED, { tag, source });

      if (isOffline) {
        pendingTagsRef.current = next;
        return;
      }

      updateUserSettings(user.uid, {
        followedTags: next,
        followedTagsUpdatedAt: new Date(),
      }).catch((err) => {
        logger.error('[useFollowedTags] unfollowTag failed:', err);
        setOptimisticTags(null);
      });
    },
    [user, isOffline, optimisticTags, serverTags, setOptimisticTags],
  );

  // #323 C2: flush snapshot al reconectar
  useEffect(() => {
    let cancelled = false;
    if (!isOffline && user && pendingTagsRef.current) {
      const snapshot = pendingTagsRef.current;
      pendingTagsRef.current = null;
      updateUserSettings(user.uid, {
        followedTags: snapshot,
        followedTagsUpdatedAt: new Date(),
      }).catch((err) => {
        if (cancelled) return;
        logger.error('[useFollowedTags] flush failed:', err);
      });
    }
    return () => { cancelled = true; };
  }, [isOffline, user]);

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
