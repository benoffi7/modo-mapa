/** Notification polling interval */
export const POLL_INTERVAL_MS = 300_000; // 5 min (reduced from 60s for #203)

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

/**
 * Grace window del fallback PWA: si el hook de force-update no corrió un check
 * exitoso dentro de este tiempo, se lo considera "muerto" y el fallback pasivo
 * puede disparar el refresh del Service Worker. 60 min = 2x el intervalo del hook.
 */
export const PWA_FALLBACK_GRACE_MS = 60 * 60 * 1000;

/**
 * Edad máxima del busy-flag antes de considerarlo stale. Cubre uploads medianos
 * en redes lentas (3G) sin retener el flag indefinidamente si un callsite olvida
 * limpiarlo. 180s (3 min) ampara la observación de Sofía sobre uploads >90s.
 */
export const BUSY_FLAG_MAX_AGE_MS = 3 * 60 * 1000;

/**
 * Heartbeat para uploads largos: los callsites con onProgress refrescan
 * `startedAt` del busy-flag cada 30s para evitar que caduque mid-upload.
 */
export const BUSY_FLAG_HEARTBEAT_MS = 30 * 1000;

/**
 * Backoff entre reintentos de `fetchAppVersionConfig` cuando Firestore responde
 * `unavailable` o `deadline-exceeded`. Dos reintentos: 500ms y 1500ms.
 */
export const FORCE_UPDATE_FETCH_RETRY_DELAYS_MS = [500, 1500];
