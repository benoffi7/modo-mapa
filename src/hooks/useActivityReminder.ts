import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../utils/analytics';
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
 */
export function useActivityReminder(): { showReminder: boolean; dismissReminder: () => void } {
  const { authMethod } = useAuth();
  const [showReminder, setShowReminder] = useState(() => {
    const show = shouldShowReminder(authMethod);
    if (show) {
      localStorage.setItem(STORAGE_KEY_ACTIVITY_REMINDER_SHOWN, 'true');
      const count = parseInt(localStorage.getItem(STORAGE_KEY_ANON_RATING_COUNT) ?? '0', 10);
      trackEvent('activity_reminder_shown', { ratings_count: count });
    }
    return show;
  });

  const handleInteraction = useCallback(() => {
    if (!showReminder && shouldShowReminder(authMethod)) {
      setShowReminder(true);
      localStorage.setItem(STORAGE_KEY_ACTIVITY_REMINDER_SHOWN, 'true');
      const count = parseInt(localStorage.getItem(STORAGE_KEY_ANON_RATING_COUNT) ?? '0', 10);
      trackEvent('activity_reminder_shown', { ratings_count: count });
    }
  }, [showReminder, authMethod]);

  useEffect(() => {
    window.addEventListener('anon-interaction', handleInteraction);
    return () => window.removeEventListener('anon-interaction', handleInteraction);
  }, [handleInteraction]);

  const dismissReminder = () => {
    setShowReminder(false);
  };

  return { showReminder, dismissReminder };
}
