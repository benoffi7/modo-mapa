/** Maximo de acciones en cola */
export const OFFLINE_QUEUE_MAX_ITEMS = 50;

/** Edad maxima de acciones en cola (7 dias) */
export const OFFLINE_QUEUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Maximo de reintentos por accion */
export const OFFLINE_MAX_RETRIES = 3;

/** Base del backoff exponencial en ms */
export const OFFLINE_BACKOFF_BASE_MS = 1000;

/** Nombre de la base de datos IndexedDB */
export const OFFLINE_DB_NAME = 'modo-mapa-offline';

/** Version del schema IndexedDB */
export const OFFLINE_DB_VERSION = 1;

/** Nombre del object store */
export const OFFLINE_STORE_NAME = 'pendingActions';

/** URL para verificacion de conectividad real */
export const CONNECTIVITY_CHECK_URL = '/favicon.ico';

/** Timeout para verificacion de conectividad (ms) */
export const CONNECTIVITY_CHECK_TIMEOUT_MS = 5000;
