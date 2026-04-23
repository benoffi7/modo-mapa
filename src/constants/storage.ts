export const STORAGE_KEY_COLOR_MODE = 'modo-mapa-color-mode';
export const STORAGE_KEY_VISITS = 'modo-mapa-visits';
export const STORAGE_KEY_ANALYTICS_CONSENT = 'analytics-consent';
export const STORAGE_KEY_ONBOARDING_CREATED_AT = 'onboarding_created_at';
export const STORAGE_KEY_ONBOARDING_COMPLETED = 'onboarding_completed';
export const STORAGE_KEY_HINT_POST_FIRST_RATING = 'hint_shown_post_first_rating';
export const STORAGE_KEY_HINT_POST_FIRST_COMMENT = 'hint_shown_post_first_comment';
export const STORAGE_KEY_ACCOUNT_BANNER_DISMISSED = 'account_banner_dismissed';
export const STORAGE_KEY_BENEFITS_SHOWN = 'benefits_screen_shown';
export const STORAGE_KEY_ACTIVITY_REMINDER_SHOWN = 'activity_reminder_shown';
export const STORAGE_KEY_ANON_RATING_COUNT = 'anon_rating_count';
export const STORAGE_KEY_VERIFICATION_NUDGE_DISMISSED = 'verification_nudge_dismissed';
export const STORAGE_KEY_ONBOARDING_DISMISSED = 'onboarding_dismissed';
export const STORAGE_KEY_ONBOARDING_RANKING_VIEWED = 'onboarding_ranking_viewed';
export const STORAGE_KEY_ONBOARDING_CELEBRATED = 'onboarding_celebrated';
export const STORAGE_KEY_ONBOARDING_EXPANDED = 'onboarding_expanded';
export const STORAGE_KEY_REMEMBERED_EMAIL = 'remembered_email';
export const STORAGE_KEY_FORCE_UPDATE_LAST_REFRESH = 'force_update_last_refresh';
export const STORAGE_KEY_FORCE_UPDATE_RELOAD_COUNT = 'force_update_reload_count';
/**
 * localStorage — timestamp (ms, `Date.now()`) del último check exitoso del
 * hook `useForceUpdate`. Lo lee el fallback PWA para decidir si el hook sigue
 * vivo antes de disparar el refresh pasivo.
 */
export const STORAGE_KEY_FORCE_UPDATE_LAST_CHECK = 'force_update_last_check';
/**
 * sessionStorage — flag de operacion in-flight (upload/submit critico).
 * Envuelto por `withBusyFlag` en `src/utils/busyFlag.ts`; refrescado por
 * heartbeat mientras la operacion progresa. Expira por `BUSY_FLAG_MAX_AGE_MS`.
 */
export const STORAGE_KEY_FORCE_UPDATE_BUSY = 'force_update_busy';
/**
 * sessionStorage — flag one-shot per-session que marca que el evento
 * `EVT_APP_VERSION_ACTIVE` ya fue emitido en esta sesión. Se setea sólo
 * después de una emisión exitosa; si el hook aún no emitió (p. ej. source
 * 'cache' o 'unknown'), el próximo tick todavía puede intentar.
 */
export const STORAGE_KEY_APP_VERSION_EVENT_EMITTED = 'app_version_event_emitted';
export const STORAGE_KEY_RATING_PROMPT_DISMISSED = 'rating_prompt_dismissed';
export const STORAGE_KEY_RATING_PROMPT_SHOWN_TODAY = 'rating_prompt_shown_today';
export const STORAGE_KEY_QUICK_ACTIONS = 'quick_actions_config';
export const STORAGE_KEY_DISMISS_LOCALITY_HINT = 'mm_dismiss_locality_hint';
export const STORAGE_KEY_DRAG_HANDLE_SEEN = 'dragHandleSeen';
