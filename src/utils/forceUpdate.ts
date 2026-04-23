import {
  FORCE_UPDATE_COOLDOWN_MS,
  MAX_FORCE_UPDATE_RELOADS,
} from '../constants/timing';
import {
  STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH,
  STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
} from '../constants/storage';

/**
 * Returns true if a hard refresh occurred recently (within the cooldown window).
 * Used to prevent reload loops: if we just reloaded, we should not reload again
 * until the cooldown expires.
 */
export function isCooldownActive(): boolean {
  try {
    const last = localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH);
    if (!last) return false;
    return Date.now() - Number(last) < FORCE_UPDATE_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Reads the reload counter from localStorage.
 * Returns `{ count: 0, firstAt: 0 }` as default when the key is absent,
 * the JSON is malformed, or the fields are not numbers.
 */
export function getReloadCount(): { count: number; firstAt: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT);
    if (!raw) return { count: 0, firstAt: 0 };
    const parsed = JSON.parse(raw) as { count?: number; firstAt?: number };
    if (typeof parsed.count === 'number' && typeof parsed.firstAt === 'number') {
      return { count: parsed.count, firstAt: parsed.firstAt };
    }
    return { count: 0, firstAt: 0 };
  } catch {
    return { count: 0, firstAt: 0 };
  }
}

/**
 * Increments the reload counter in localStorage.
 * Resets the counter (starting a new window) if the previous window has expired.
 * No-op (silent) if localStorage is unavailable.
 */
export function incrementReloadCount(): void {
  try {
    const current = getReloadCount();
    const now = Date.now();

    // Reset if the window has expired
    if (current.firstAt > 0 && now - current.firstAt >= FORCE_UPDATE_COOLDOWN_MS) {
      localStorage.setItem(
        STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
        JSON.stringify({ count: 1, firstAt: now }),
      );
      return;
    }

    localStorage.setItem(
      STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT,
      JSON.stringify({
        count: current.count + 1,
        firstAt: current.firstAt || now,
      }),
    );
  } catch {
    // localStorage may be unavailable
  }
}

/**
 * Returns true if the reload count has reached or exceeded the limit
 * within the current cooldown window.
 * Returns false if the window has already expired (counter will reset on next increment).
 */
export function isReloadLimitReached(): boolean {
  const { count, firstAt } = getReloadCount();
  if (firstAt > 0 && Date.now() - firstAt >= FORCE_UPDATE_COOLDOWN_MS) {
    return false; // Window expired, counter will be reset on next increment
  }
  return count >= MAX_FORCE_UPDATE_RELOADS;
}
