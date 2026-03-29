import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { useAuth } from '../context/AuthContext';
import { useSelection } from '../context/SelectionContext';
import { fetchMyCheckIns } from '../services/checkins';
import { allBusinesses } from './useBusinesses';
import { trackEvent } from '../utils/analytics';
import {
  RATING_PROMPT_MIN_HOURS,
  RATING_PROMPT_MAX_HOURS,
  RATING_PROMPT_MAX_PER_DAY,
} from '../constants/checkin';
import {
  STORAGE_KEY_RATING_PROMPT_DISMISSED,
  STORAGE_KEY_RATING_PROMPT_SHOWN_TODAY,
} from '../constants/storage';
import {
  EVT_RATING_PROMPT_SHOWN,
  EVT_RATING_PROMPT_CLICKED,
  EVT_RATING_PROMPT_DISMISSED,
  EVT_RATING_PROMPT_CONVERTED,
} from '../constants/analyticsEvents';

export interface RatingPromptData {
  businessId: string;
  businessName: string;
  checkInId: string;
  hoursSinceCheckIn: number;
}

export interface UseRatingPromptReturn {
  promptData: RatingPromptData | null;
  dismiss: () => void;
  navigateToBusiness: () => void;
}

function getDismissedIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RATING_PROMPT_DISMISSED);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDismissedId(checkInId: string): void {
  const ids = getDismissedIds();
  if (!ids.includes(checkInId)) {
    ids.push(checkInId);
    localStorage.setItem(STORAGE_KEY_RATING_PROMPT_DISMISSED, JSON.stringify(ids));
  }
}

function getShownTodayCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RATING_PROMPT_SHOWN_TODAY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { date: string; count: number };
    const today = new Date().toISOString().slice(0, 10);
    return data.date === today ? data.count : 0;
  } catch {
    return 0;
  }
}

function incrementShownToday(): void {
  const today = new Date().toISOString().slice(0, 10);
  const current = getShownTodayCount();
  localStorage.setItem(
    STORAGE_KEY_RATING_PROMPT_SHOWN_TODAY,
    JSON.stringify({ date: today, count: current + 1 }),
  );
}

/**
 * Hook that determines if a rating prompt should be shown for a recent check-in.
 * Finds check-ins in the 2-8h window that haven't been rated or dismissed.
 * Follows the pattern of useActivityReminder for event-driven re-evaluation.
 */
export function useRatingPrompt(): UseRatingPromptReturn {
  const { user } = useAuth();
  const { setSelectedBusiness } = useSelection();
  const [promptData, setPromptData] = useState<RatingPromptData | null>(null);

  // Refs for stable event handler
  const promptDataRef = useRef(promptData);
  useEffect(() => { promptDataRef.current = promptData; }, [promptData]);

  // Track analytics once per prompt display
  const analyticsTracked = useRef(false);

  // Track shown event when prompt first becomes visible
  useEffect(() => {
    if (promptData && !analyticsTracked.current) {
      analyticsTracked.current = true;
      incrementShownToday();
      trackEvent(EVT_RATING_PROMPT_SHOWN, {
        business_id: promptData.businessId,
        hours_since_checkin: Math.round(promptData.hoursSinceCheckIn),
      });
    }
  }, [promptData]);

  // Main eligibility evaluation
  useEffect(() => {
    if (!user) {
      setPromptData(null); // eslint-disable-line react-hooks/set-state-in-effect -- intentional reset when user changes
      return;
    }

    let cancelled = false;

    async function evaluate() {
      // Check daily limit first (cheap, no network)
      if (getShownTodayCount() >= RATING_PROMPT_MAX_PER_DAY) {
        return;
      }

      const dismissedIds = getDismissedIds();
      const allBizIds = new Set(allBusinesses.map((b) => b.id));

      let checkIns;
      try {
        checkIns = await fetchMyCheckIns(user!.uid, 20);
      } catch {
        return; // Silently fail if offline with no cache
      }

      if (cancelled) return;

      const now = Date.now();

      for (const checkIn of checkIns) {
        const hoursSince = (now - checkIn.createdAt.getTime()) / (1000 * 60 * 60);

        // Outside time window
        if (hoursSince < RATING_PROMPT_MIN_HOURS || hoursSince > RATING_PROMPT_MAX_HOURS) {
          continue;
        }

        // Already dismissed
        if (dismissedIds.includes(checkIn.id)) {
          continue;
        }

        // Business not in current dataset
        if (!allBizIds.has(checkIn.businessId)) {
          continue;
        }

        // Check if already rated
        try {
          const ratingDocId = `${user!.uid}__${checkIn.businessId}`;
          const ratingSnap = await getDoc(doc(db, COLLECTIONS.RATINGS, ratingDocId));
          if (cancelled) return;
          if (ratingSnap.exists()) {
            continue; // Already rated, try next
          }
        } catch {
          if (cancelled) return;
          continue; // Skip on error
        }

        // Found an eligible check-in
        setPromptData({
          businessId: checkIn.businessId,
          businessName: checkIn.businessName,
          checkInId: checkIn.id,
          hoursSinceCheckIn: hoursSince,
        });
        return;
      }

      // No eligible check-in found
      if (!cancelled) {
        setPromptData(null);
      }
    }

    evaluate();

    return () => { cancelled = true; };
  }, [user]);

  // Listen for anon-interaction (fired when user rates) to auto-hide or detect conversion
  useEffect(() => {
    const handler = async () => {
      const data = promptDataRef.current;
      if (!data || !user) return;

      try {
        const ratingDocId = `${user.uid}__${data.businessId}`;
        const ratingSnap = await getDoc(doc(db, COLLECTIONS.RATINGS, ratingDocId));
        if (ratingSnap.exists()) {
          trackEvent(EVT_RATING_PROMPT_CONVERTED, { business_id: data.businessId });
          setPromptData(null);
        }
      } catch {
        // Ignore errors during re-evaluation
      }
    };

    window.addEventListener('anon-interaction', handler);
    return () => window.removeEventListener('anon-interaction', handler);
  }, [user]);

  const dismiss = useCallback(() => {
    if (!promptData) return;
    addDismissedId(promptData.checkInId);
    trackEvent(EVT_RATING_PROMPT_DISMISSED, { business_id: promptData.businessId });
    setPromptData(null);
  }, [promptData]);

  const navigateToBusiness = useCallback(() => {
    if (!promptData) return;
    trackEvent(EVT_RATING_PROMPT_CLICKED, { business_id: promptData.businessId });
    addDismissedId(promptData.checkInId);

    const biz = allBusinesses.find((b) => b.id === promptData.businessId);
    if (biz) {
      setSelectedBusiness(biz);
    }

    setPromptData(null);
  }, [promptData, setSelectedBusiness]);

  return { promptData, dismiss, navigateToBusiness };
}
