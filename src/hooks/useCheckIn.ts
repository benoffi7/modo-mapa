import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FiltersContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useToast } from '../context/ToastContext';
import { createCheckIn, deleteCheckIn, fetchCheckInsForBusiness } from '../services/checkins';
import { withOfflineSupport } from '../services/offlineInterceptor';
import { CHECKIN_COOLDOWN_HOURS, CHECKIN_PROXIMITY_RADIUS_M } from '../constants/checkin';
import { distanceKm } from '../utils/distance';
import { trackEvent } from '../utils/analytics';

export interface UseCheckInReturn {
  hasCheckedInRecently: boolean;
  isNearby: boolean;
  canCheckIn: boolean;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  /** ID del check-in reciente (para poder eliminarlo) */
  recentCheckInId: string | null;
  performCheckIn: () => Promise<void>;
  undoCheckIn: () => Promise<void>;
}

export function useCheckIn(
  businessId: string,
  businessName: string,
  businessLocation?: { lat: number; lng: number },
): UseCheckInReturn {
  const { user } = useAuth();
  const { userLocation } = useFilters();
  const { isOffline } = useConnectivity();
  const toast = useToast();

  const [hasCheckedInRecently, setHasCheckedInRecently] = useState(false);
  const [recentCheckInId, setRecentCheckInId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const isNearby = useMemo(() => {
    if (!userLocation || !businessLocation) return true;
    const km = distanceKm(
      userLocation.lat, userLocation.lng,
      businessLocation.lat, businessLocation.lng,
    );
    return km * 1000 <= CHECKIN_PROXIMITY_RADIUS_M;
  }, [userLocation, businessLocation]);

  useEffect(() => {
    if (!user || !businessId) return;
    let cancelled = false;

    fetchCheckInsForBusiness(businessId, user.uid).then((checkIns) => {
      if (cancelled) return;
      if (checkIns.length > 0) {
        const latest = checkIns[0];
        const hoursSince = (Date.now() - latest.createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursSince < CHECKIN_COOLDOWN_HOURS) {
          setHasCheckedInRecently(true);
          setRecentCheckInId(latest.id);
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
      const id = await withOfflineSupport(
        isOffline,
        'checkin_create',
        { userId: user.uid, businessId, businessName },
        { businessName, location: userLocation ?? undefined },
        () => createCheckIn(user.uid, businessId, businessName, userLocation ?? undefined),
        toast,
      );
      setStatus('success');
      setHasCheckedInRecently(true);
      if (id) setRecentCheckInId(id);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Error al registrar visita');
    }
  }, [user, businessId, businessName, userLocation, businessLocation, hasCheckedInRecently, isNearby, isOffline, toast]);

  const undoCheckIn = useCallback(async () => {
    if (!user || !recentCheckInId) return;

    setStatus('loading');
    setError(null);

    try {
      await withOfflineSupport(
        isOffline,
        'checkin_delete',
        { userId: user.uid, businessId },
        { checkInId: recentCheckInId },
        () => deleteCheckIn(user.uid, recentCheckInId),
        toast,
      );
      setStatus('idle');
      setHasCheckedInRecently(false);
      setRecentCheckInId(null);
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Error al desmarcar visita');
    }
  }, [user, recentCheckInId, businessId, isOffline, toast]);

  return { hasCheckedInRecently, isNearby, canCheckIn, status, error, recentCheckInId, performCheckIn, undoCheckIn };
}
