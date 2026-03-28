import { useCallback } from 'react';
import type { Business } from '../types';
import { useVisitHistory } from './useVisitHistory';
import { useSortLocation } from './useSortLocation';
import { useToast } from '../context/ToastContext';
import { MSG_ONBOARDING } from '../constants/messages';
import { allBusinesses } from './useBusinesses';
import { distanceKm } from '../utils/distance';
import { trackEvent } from '../utils/analytics';

interface UseSurpriseMeParams {
  onSelect: (business: Business) => void;
  onClose: () => void;
}

interface UseSurpriseMeReturn {
  handleSurprise: () => void;
}

export function useSurpriseMe({ onSelect, onClose }: UseSurpriseMeParams): UseSurpriseMeReturn {
  const { visits } = useVisitHistory();
  const sortLocation = useSortLocation();
  const toast = useToast();

  const handleSurprise = useCallback(() => {
    const visitedIds = new Set(visits.map((v) => v.businessId));
    let candidates = allBusinesses.filter((b) => !visitedIds.has(b.id));

    // Prefer nearby (within 5km) using GPS → locality → office fallback
    if (candidates.length > 0) {
      const nearby = candidates.filter(
        (b) => distanceKm(sortLocation.lat, sortLocation.lng, b.lat, b.lng) <= 5,
      );
      if (nearby.length > 0) candidates = nearby;
    }

    const pool = candidates.length > 0 ? candidates : allBusinesses;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    onSelect(pick);
    onClose();
    if (candidates.length === 0) {
      toast.info(MSG_ONBOARDING.surpriseAllVisited);
    } else {
      toast.success(MSG_ONBOARDING.surpriseSuccess(pick.name));
    }
    trackEvent('surprise_me', { business_id: pick.id });
  }, [sortLocation, visits, onClose, onSelect, toast]);

  return { handleSurprise };
}
