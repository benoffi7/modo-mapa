/** Notification polling interval */
export const POLL_INTERVAL_MS = 60_000; // 60s

/** Auto-dismiss duration for snackbar messages */
export const AUTO_DISMISS_MS = 5_000; // 5s

/** Threshold for "stale" menu photos */
export const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

/** Delay before showing onboarding hint to new users (4 hours) */
export const ONBOARDING_HINT_DELAY_MS = 4 * 60 * 60 * 1000;

/** Interval between force-update version checks (30 minutes) */
export const FORCE_UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** Minimum time between forced refreshes to prevent loops (5 minutes) */
export const FORCE_UPDATE_COOLDOWN_MS = 5 * 60 * 1000;

/** Maximum number of forced refreshes allowed within the cooldown window */
export const MAX_FORCE_UPDATE_RELOADS = 3;
