import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../utils/analytics';
import {
  STORAGE_KEY_ACTIVITY_REMINDER_SHOWN,
  STORAGE_KEY_ANON_RATING_COUNT,
  STORAGE_KEY_ACCOUNT_BANNER_DISMISSED,
} from '../constants/storage';

const RATING_THRESHOLD = 5;

/**
 * Increments the anonymous rating counter (call after each rating by an anon user).
 */
export function incrementAnonRatingCount(): void {
  const current = parseInt(localStorage.getItem(STORAGE_KEY_ANON_RATING_COUNT) ?? '0', 10);
  localStorage.setItem(STORAGE_KEY_ANON_RATING_COUNT, String(current + 1));
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
 * Only triggers once, after the banner was dismissed and the user hit the rating threshold.
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

  const dismissReminder = () => {
    setShowReminder(false);
  };

  return { showReminder, dismissReminder };
}
