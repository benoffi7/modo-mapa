import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../utils/analytics';
import { EVT_ACTIVITY_REMINDER_SHOWN } from '../constants/analyticsEvents';
import {
  STORAGE_KEY_ACTIVITY_REMINDER_SHOWN,
  STORAGE_KEY_ANON_RATING_COUNT,
  STORAGE_KEY_ACCOUNT_BANNER_DISMISSED,
} from '../constants/storage';

const RATING_THRESHOLD = 5;

/**
 * Increments the anonymous rating counter and dispatches a custom event
 * so that AccountBanner and ActivityReminder can re-evaluate.
 */
export function incrementAnonRatingCount(): void {
  const current = parseInt(localStorage.getItem(STORAGE_KEY_ANON_RATING_COUNT) ?? '0', 10);
  localStorage.setItem(STORAGE_KEY_ANON_RATING_COUNT, String(current + 1));
  window.dispatchEvent(new Event('anon-interaction'));
}

function shouldShowReminder(authMethod: string): boolean {
  if (authMethod !== 'anonymous') return false;
  if (localStorage.getItem(STORAGE_KEY_ACTIVITY_REMINDER_SHOWN) === 'true') return false;
  if (localStorage.getItem(STORAGE_KEY_ACCOUNT_BANNER_DISMISSED) !== 'true') return false;
  const count = parseInt(localStorage.getItem(STORAGE_KEY_ANON_RATING_COUNT) ?? '0', 10);
  return count >= RATING_THRESHOLD;
}

/**
 * Returns whether the activity reminder should be shown.
 * Re-evaluates on each 'anon-interaction' event (fired after rating).
 * Uses refs for stable event listener registration (no churn).
 */
export function useActivityReminder(): { showReminder: boolean; dismissReminder: () => void } {
  const { authMethod } = useAuth();
  const [showReminder, setShowReminder] = useState(() => shouldShowReminder(authMethod));

  // Refs for stable event handler — avoids re-registering listener on state changes
  const showReminderRef = useRef(showReminder);
  useEffect(() => { showReminderRef.current = showReminder; }, [showReminder]);
  const authMethodRef = useRef(authMethod);
  useEffect(() => { authMethodRef.current = authMethod; }, [authMethod]);

  // Track analytics once per hook lifetime to avoid duplicates on StrictMode remount
  const analyticsTracked = useRef(false);

  // Fire analytics when reminder first becomes visible
  useEffect(() => {
    if (showReminder && !analyticsTracked.current) {
      analyticsTracked.current = true;
      localStorage.setItem(STORAGE_KEY_ACTIVITY_REMINDER_SHOWN, 'true');
      const count = parseInt(localStorage.getItem(STORAGE_KEY_ANON_RATING_COUNT) ?? '0', 10);
      trackEvent(EVT_ACTIVITY_REMINDER_SHOWN, { ratings_count: count });
    }
  }, [showReminder]);

  // Stable event listener — registered once, reads from refs
  useEffect(() => {
    const handler = () => {
      if (!showReminderRef.current && shouldShowReminder(authMethodRef.current)) {
        setShowReminder(true);
      }
    };
    window.addEventListener('anon-interaction', handler);
    return () => window.removeEventListener('anon-interaction', handler);
  }, []);

  const dismissReminder = () => {
    setShowReminder(false);
  };

  return { showReminder, dismissReminder };
}
