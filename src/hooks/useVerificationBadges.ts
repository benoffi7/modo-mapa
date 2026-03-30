import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { ratingConverter } from '../config/converters';
import { checkinConverter } from '../config/converters';
import { allBusinesses } from './useBusinesses';
import { distanceKm } from '../utils/distance';
import { VERIFICATION_BADGES, VERIFICATION_CACHE_KEY, VERIFICATION_CACHE_TTL } from '../constants/verificationBadges';
import { trackEvent } from '../utils/analytics';
import { logger } from '../utils/logger';
import type { VerificationBadge, VerificationBadgeId, Rating, CheckIn } from '../types';

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

/** Extract locality from a business address (last segment after comma). */
function extractLocality(address: string): string {
  const parts = address.split(',');
  return (parts[parts.length - 1] || '').trim().toLowerCase();
}

/** Build a map of businessId -> locality from static businesses data. */
function buildBusinessLocalityMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of allBusinesses) {
    map.set(b.id, extractLocality(b.address));
  }
  return map;
}

/** Build a map of businessId -> { lat, lng } from static businesses data. */
function buildBusinessCoordsMap(): Map<string, { lat: number; lng: number }> {
  const map = new Map<string, { lat: number; lng: number }>();
  for (const b of allBusinesses) {
    map.set(b.id, { lat: b.lat, lng: b.lng });
  }
  return map;
}

function calcLocalGuide(
  userRatings: Rating[],
  userLocality: string | undefined,
): { current: number; target: number } {
  const target = VERIFICATION_BADGES.local_guide.target;
  if (!userLocality) return { current: 0, target };

  const localityMap = buildBusinessLocalityMap();
  const normalizedLocality = userLocality.toLowerCase().trim();

  let count = 0;
  for (const r of userRatings) {
    const bizLocality = localityMap.get(r.businessId);
    if (bizLocality === normalizedLocality) count++;
  }
  return { current: count, target };
}

function calcVerifiedVisitor(
  userCheckIns: CheckIn[],
): { current: number; target: number } {
  const target = VERIFICATION_BADGES.verified_visitor.target;
  const coordsMap = buildBusinessCoordsMap();

  let count = 0;
  for (const ci of userCheckIns) {
    if (!ci.location) continue;
    const bizCoords = coordsMap.get(ci.businessId);
    if (!bizCoords) continue;
    const dist = distanceKm(ci.location.lat, ci.location.lng, bizCoords.lat, bizCoords.lng);
    if (dist < 0.1) count++; // < 100m
  }
  return { current: count, target };
}

async function calcTrustedReviewer(
  userRatings: Rating[],
): Promise<{ current: number; target: number }> {
  const target = VERIFICATION_BADGES.trusted_reviewer.target;
  if (userRatings.length === 0) return { current: 0, target };

  // Get unique business IDs the user has rated
  const businessIds = [...new Set(userRatings.map((r) => r.businessId))];

  // Fetch all ratings for those businesses in batches of 10 (Firestore 'in' limit)
  const avgMap = new Map<string, number>();
  const BATCH_SIZE = 10;

  for (let i = 0; i < businessIds.length; i += BATCH_SIZE) {
    const batch = businessIds.slice(i, i + BATCH_SIZE);
    try {
      const snap = await getDocs(
        query(
          collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
          where('businessId', 'in', batch),
        ),
      );
      // Group by businessId and compute averages
      const sums = new Map<string, { sum: number; count: number }>();
      for (const d of snap.docs) {
        const r = d.data();
        const entry = sums.get(r.businessId) ?? { sum: 0, count: 0 };
        entry.sum += r.score;
        entry.count += 1;
        sums.set(r.businessId, entry);
      }
      for (const [bId, { sum, count }] of sums) {
        avgMap.set(bId, sum / count);
      }
    } catch (err) {
      logger.warn('[useVerificationBadges] Failed to fetch ratings batch:', err);
    }
  }

  // Count how many of the user's ratings are within +-0.5 of the business average
  let consistentCount = 0;
  for (const r of userRatings) {
    const avg = avgMap.get(r.businessId);
    if (avg != null && Math.abs(r.score - avg) <= 0.5) {
      consistentCount++;
    }
  }

  const percentage = userRatings.length > 0
    ? Math.round((consistentCount / userRatings.length) * 100)
    : 0;

  return { current: percentage, target };
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
      // Fetch user's ratings
      const ratingsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.RATINGS).withConverter(ratingConverter),
          where('userId', '==', uid),
        ),
      );
      const userRatings = ratingsSnap.docs.map((d) => d.data());

      // Fetch user's check-ins
      const checkInsSnap = await getDocs(
        query(
          collection(db, COLLECTIONS.CHECKINS).withConverter(checkinConverter),
          where('userId', '==', uid),
        ),
      );
      const userCheckIns = checkInsSnap.docs.map((d) => d.data());

      // Calculate each badge
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
