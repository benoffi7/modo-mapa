/** Business data cache TTL (useBusinessDataCache) */
export const BUSINESS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

/** Paginated query first-page cache TTL (usePaginatedQuery) */
export const QUERY_CACHE_TTL_MS = 2 * 60 * 1000; // 2 min

/** Profile visibility cache TTL (useProfileVisibility) */
export const PROFILE_CACHE_TTL_MS = 60_000; // 60s

/** IndexedDB read cache for offline support (#197) */
export const READ_CACHE_DB_NAME = 'modo-mapa-read-cache';
export const READ_CACHE_DB_VERSION = 1;
export const READ_CACHE_STORE_NAME = 'businessCache';
export const READ_CACHE_MAX_ENTRIES = 20;
export const READ_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
