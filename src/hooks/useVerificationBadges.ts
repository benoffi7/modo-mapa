import { useState, useEffect, useCallback } from 'react';
import { fetchUserRatings } from '../services/ratings';
import { fetchUserCheckIns } from '../services/checkins';
import { calcLocalGuide } from './useLocalGuideBadge';
import { calcVerifiedVisitor } from './useVerifiedVisitorBadge';
import { calcTrustedReviewer } from './useTrustedReviewerBadge';
import { VERIFICATION_BADGES, VERIFICATION_CACHE_KEY, VERIFICATION_CACHE_TTL } from '../constants/verificationBadges';
import { trackEvent } from '../utils/analytics';
import { logger } from '../utils/logger';
import type { VerificationBadge, VerificationBadgeId } from '../types';

interface CacheEntry {
  badges: VerificationBadge[];
  timestamp: number;
}

function getCached(userId: string): VerificationBadge[] | null {
  try {
    const raw = localStorage.getItem(`${VERIFICATION_CACHE_KEY}_${userId}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > VERIFICATION_CACHE_TTL) return null;
    return entry.badges;
  } catch {
    return null;
  }
}

function setCache(userId: string, badges: VerificationBadge[]): void {
  try {
    const entry: CacheEntry = { badges, timestamp: Date.now() };
    localStorage.setItem(`${VERIFICATION_CACHE_KEY}_${userId}`, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function buildBadge(
  id: VerificationBadgeId,
  current: number,
  target: number,
): VerificationBadge {
  const def = VERIFICATION_BADGES[id];
  const progress = Math.min(100, Math.round((current / target) * 100));
  return {
    id,
    name: def.name,
    description: def.description,
    icon: def.icon,
    earned: current >= target,
    progress,
    current,
    target,
  };
}

export interface UseVerificationBadgesReturn {
  badges: VerificationBadge[];
  loading: boolean;
}

export function useVerificationBadges(
  userId: string | undefined,
  userLocality?: string | undefined,
): UseVerificationBadgesReturn {
  const [badges, setBadges] = useState<VerificationBadge[]>([]);
  const [loading, setLoading] = useState(false);

  const compute = useCallback(async (uid: string) => {
    // Check cache first
    const cached = getCached(uid);
    if (cached) {
      setBadges(cached);
      return;
    }

    setLoading(true);
    try {
      // Fetch data via service layer
      const [userRatings, userCheckIns] = await Promise.all([
        fetchUserRatings(uid),
        fetchUserCheckIns(uid),
      ]);

      // Calculate each badge using dedicated calculators
      const localGuide = calcLocalGuide(userRatings, userLocality);
      const verifiedVisitor = calcVerifiedVisitor(userCheckIns);
      const trustedReviewer = await calcTrustedReviewer(userRatings);

      const result: VerificationBadge[] = [
        buildBadge('local_guide', localGuide.current, localGuide.target),
        buildBadge('verified_visitor', verifiedVisitor.current, verifiedVisitor.target),
        buildBadge('trusted_reviewer', trustedReviewer.current, trustedReviewer.target),
      ];

      // Track newly earned badges
      for (const badge of result) {
        if (badge.earned) {
          trackEvent('verification_badge_earned', { badge_id: badge.id, user_id: uid });
        }
      }

      setBadges(result);
      setCache(uid, result);
    } catch (err) {
      logger.error('[useVerificationBadges] compute failed:', err);
      setBadges([]);
    } finally {
      setLoading(false);
    }
  }, [userLocality]);

  useEffect(() => {
    if (!userId) {
      setBadges([]);
      return;
    }
    compute(userId);
  }, [userId, compute]);

  return { badges, loading };
}
