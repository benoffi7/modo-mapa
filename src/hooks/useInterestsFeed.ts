import { useMemo, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useFollowedTags } from './useFollowedTags';
import { allBusinesses } from './useBusinesses';
import { updateUserSettings } from '../services/userSettings';
import { INTERESTS_MAX_BUSINESSES_PER_TAG } from '../constants/interests';
import { logger } from '../utils/logger';
import type { InterestFeedGroup } from '../types';

/**
 * Builds an interest feed grouped by followed tag.
 * Filters allBusinesses client-side (O(n*m) with n businesses, m tags).
 */
export function useInterestsFeed() {
  const { user } = useAuth();
  const { isOffline } = useConnectivity();
  const { tags, loading } = useFollowedTags();
  // #323 C2: snapshot pendiente cuando offline; flush al reconectar.
  const pendingSeenRef = useRef<Date | null>(null);

  const groups = useMemo<InterestFeedGroup[]>(() => {
    if (tags.length === 0) return [];

    return tags.map((tag) => {
      const matching = allBusinesses
        .filter((b) => b.tags.includes(tag))
        .slice(0, INTERESTS_MAX_BUSINESSES_PER_TAG)
        .map((business) => ({
          business,
          matchingTags: [tag],
          isNew: false, // v1: no lastSeenAt tracking yet
        }));

      return {
        tag,
        businesses: matching,
        newCount: 0,
      };
    }).filter((g) => g.businesses.length > 0);
  }, [tags]);

  const totalNew = useMemo(
    () => groups.reduce((sum, g) => sum + g.newCount, 0),
    [groups],
  );

  const markSeen = useCallback(() => {
    if (!user) return;
    const now = new Date();
    if (isOffline) {
      pendingSeenRef.current = now;
      return;
    }
    updateUserSettings(user.uid, {
      followedTagsLastSeenAt: now,
    }).catch((err) => {
      logger.error('[useInterestsFeed] markSeen failed:', err);
    });
  }, [user, isOffline]);

  // #323 C2: flush al reconectar
  useEffect(() => {
    let cancelled = false;
    if (!isOffline && user && pendingSeenRef.current) {
      const snapshot = pendingSeenRef.current;
      pendingSeenRef.current = null;
      updateUserSettings(user.uid, {
        followedTagsLastSeenAt: snapshot,
      }).catch((err) => {
        if (cancelled) return;
        logger.error('[useInterestsFeed] flush markSeen failed:', err);
      });
    }
    return () => { cancelled = true; };
  }, [isOffline, user]);

  return { groups, totalNew, markSeen, loading };
}
