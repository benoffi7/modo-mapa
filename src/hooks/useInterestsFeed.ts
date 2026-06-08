import { useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useFollowedTags } from './useFollowedTags';
import { allBusinesses } from './useBusinesses';
import { updateUserSettings } from '../services/userSettings';
import { INTERESTS_MAX_BUSINESSES_PER_TAG } from '../constants/interests';
import { logger } from '../utils/logger';
import { createPendingByUserStore } from '../utils/createPendingByUserStore';
import type { InterestFeedGroup } from '../types';

// #323 / #335: pendingState a nivel módulo via factory unificado — sobrevive al
// unmount del consumer y limpia el snapshot del UID anterior en logout/switch
// (listener `onAuthStateChanged` compartido). Solo guardamos el último timestamp
// (last-write-wins). Sin la limpieza, un markSeen stale de A se aplicaría cuando
// A vuelva a loguearse online, adelantando incorrectamente followedTagsLastSeenAt.
const pendingSeenByUser = createPendingByUserStore<Date>();

/** Test-only: limpia el estado modular entre tests. No exportar a producción. */
export function __resetPendingSeenForTests() {
  pendingSeenByUser.__reset();
}

/**
 * Builds an interest feed grouped by followed tag.
 * Filters allBusinesses client-side (O(n*m) with n businesses, m tags).
 */
export function useInterestsFeed() {
  const { user } = useAuth();
  const { isOffline } = useConnectivity();
  const { tags, loading } = useFollowedTags();

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
      pendingSeenByUser.set(user.uid, now);
      return;
    }
    updateUserSettings(user.uid, {
      followedTagsLastSeenAt: now,
    }).catch((err) => {
      logger.error('[useInterestsFeed] markSeen failed:', err);
    });
  }, [user, isOffline]);

  // #323: flush al reconectar — sobrevive al unmount del consumer
  // gracias a que pendingSeenByUser vive a nivel módulo.
  useEffect(() => {
    let cancelled = false;
    if (!isOffline && user) {
      const snapshot = pendingSeenByUser.take(user.uid);
      if (!snapshot) return;
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
