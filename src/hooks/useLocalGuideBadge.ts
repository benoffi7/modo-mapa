import { allBusinesses } from './useBusinesses';
import { VERIFICATION_BADGES } from '../constants/verificationBadges';
import type { Rating } from '../types';

/** Extract locality from a business address (last segment after comma). */
export function extractLocality(address: string): string {
  const parts = address.split(',');
  return (parts[parts.length - 1] || '').trim().toLowerCase();
}

/** Build a map of businessId -> locality from static businesses data. */
export function buildBusinessLocalityMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const b of allBusinesses) {
    map.set(b.id, extractLocality(b.address));
  }
  return map;
}

export function calcLocalGuide(
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
