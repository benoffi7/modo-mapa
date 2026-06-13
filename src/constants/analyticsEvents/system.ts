// Force update events (#191)
export const EVT_FORCE_UPDATE_TRIGGERED = 'force_update_triggered';
export const EVT_FORCE_UPDATE_LIMIT_REACHED = 'force_update_limit_reached';
/** Emitido una vez por sesion (primer check exitoso desde server/server-retry/empty) con la version activa del cliente. */
export const EVT_APP_VERSION_ACTIVE = 'app_version_active';

// Account deletion events (#192)
export const EVT_ACCOUNT_DELETED = 'account_deleted';

// Map error events (#304)
export const EVT_MAP_LOAD_FAILED = 'map_load_failed';
