import { fetchRatingsByBusinessIds } from '../services/ratings';
import { VERIFICATION_BADGES } from '../constants/verificationBadges';
import { logger } from '../utils/logger';
import type { Rating } from '../types';

export async function calcTrustedReviewer(
  userRatings: Rating[],
): Promise<{ current: number; target: number }> {
  const target = VERIFICATION_BADGES.trusted_reviewer.target;
  if (userRatings.length === 0) return { current: 0, target };

  // Get unique business IDs the user has rated
  const businessIds = [...new Set(userRatings.map((r) => r.businessId))];

  // Fetch all ratings for those businesses
  let allRatings: Rating[];
  try {
    allRatings = await fetchRatingsByBusinessIds(businessIds);
  } catch (err) {
    logger.warn('[calcTrustedReviewer] Failed to fetch ratings:', err);
    return { current: 0, target };
  }

  // Group by businessId and compute averages
  const avgMap = new Map<string, number>();
  const sums = new Map<string, { sum: number; count: number }>();
  for (const r of allRatings) {
    const entry = sums.get(r.businessId) ?? { sum: 0, count: 0 };
    entry.sum += r.score;
    entry.count += 1;
    sums.set(r.businessId, entry);
  }
  for (const [bId, { sum, count }] of sums) {
    avgMap.set(bId, sum / count);
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
