import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/MapContext';
import { createCheckIn, fetchCheckInsForBusiness } from '../services/checkins';
import { CHECKIN_COOLDOWN_HOURS, CHECKIN_PROXIMITY_RADIUS_M } from '../constants/checkin';
import { distanceKm } from '../utils/distance';
import { trackEvent } from '../utils/analytics';

export interface UseCheckInReturn {
  hasCheckedInRecently: boolean;
  isNearby: boolean;
  canCheckIn: boolean;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  performCheckIn: () => Promise<void>;
}

export function useCheckIn(
  businessId: string,
  businessName: string,
  businessLocation?: { lat: number; lng: number },
): UseCheckInReturn {
  const { user } = useAuth();
  const { userLocation } = useFilters();

  const [hasCheckedInRecently, setHasCheckedInRecently] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const isNearby = (() => {
    if (!userLocation || !businessLocation) return true;
    const km = distanceKm(
      userLocation.lat, userLocation.lng,
      businessLocation.lat, businessLocation.lng,
    );
    return km * 1000 <= CHECKIN_PROXIMITY_RADIUS_M;
  })();

  useEffect(() => {
    if (!user || !businessId) return;
    let cancelled = false;

    fetchCheckInsForBusiness(businessId, user.uid).then((checkIns) => {
      if (cancelled) return;
      if (checkIns.length > 0) {
        const latest = checkIns[0];
        const hoursSince = (Date.now() - latest.createdAt.getTime()) / (1000 * 60 * 60);
        setHasCheckedInRecently(hoursSince < CHECKIN_COOLDOWN_HOURS);
        if (hoursSince < CHECKIN_COOLDOWN_HOURS) {
          setStatus('success');
        }
      }
    });

    return () => { cancelled = true; };
  }, [user, businessId]);

  const canCheckIn = !hasCheckedInRecently && status !== 'loading';

  const performCheckIn = useCallback(async () => {
    if (!user) return;
    if (hasCheckedInRecently) {
      trackEvent('checkin_cooldown_blocked', { business_id: businessId });
      return;
    }

    if (!isNearby) {
      trackEvent('checkin_proximity_warning', {
        business_id: businessId,
        distance: userLocation && businessLocation
          ? String(Math.round(distanceKm(userLocation.lat, userLocation.lng, businessLocation.lat, businessLocation.lng) * 1000))
          : 'unknown',
      });
    }

    setStatus('loading');
    setError(null);

    try {
      await createCheckIn(
        user.uid,
        businessId,
        businessName,
        userLocation ?? undefined,
      );
      setStatus('success');
      setHasCheckedInRecently(true);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Error al registrar visita');
    }
  }, [user, businessId, businessName, userLocation, businessLocation, hasCheckedInRecently, isNearby]);

  return { hasCheckedInRecently, isNearby, canCheckIn, status, error, performCheckIn };
}
