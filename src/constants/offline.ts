/** Máximo de acciones en cola */
export const OFFLINE_QUEUE_MAX_ITEMS = 50;

/** Edad máxima de acciones en cola (7 días) */
export const OFFLINE_QUEUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Máximo de reintentos por acción */
export const OFFLINE_MAX_RETRIES = 3;

/** Base del backoff exponencial en ms */
export const OFFLINE_BACKOFF_BASE_MS = 1000;

/** Nombre de la base de datos IndexedDB */
export const OFFLINE_DB_NAME = 'modo-mapa-offline';

/** Versión del schema IndexedDB */
export const OFFLINE_DB_VERSION = 1;

/** Nombre del object store */
export const OFFLINE_STORE_NAME = 'pendingActions';

/** URL para verificación de conectividad real */
export const CONNECTIVITY_CHECK_URL = '/favicon.ico';

/** Timeout para verificación de conectividad (ms) */
export const CONNECTIVITY_CHECK_TIMEOUT_MS = 5000;
