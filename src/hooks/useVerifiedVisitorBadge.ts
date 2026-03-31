import { allBusinesses } from './useBusinesses';
import { distanceKm } from '../utils/distance';
import { VERIFICATION_BADGES } from '../constants/verificationBadges';
import type { CheckIn } from '../types';

/** Build a map of businessId -> { lat, lng } from static businesses data. */
export function buildBusinessCoordsMap(): Map<string, { lat: number; lng: number }> {
  const map = new Map<string, { lat: number; lng: number }>();
  for (const b of allBusinesses) {
    map.set(b.id, { lat: b.lat, lng: b.lng });
  }
  return map;
}

export function calcVerifiedVisitor(
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
