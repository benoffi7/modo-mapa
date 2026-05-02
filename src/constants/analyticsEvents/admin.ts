// Admin config events
export const ADMIN_CONFIG_VIEWED = 'admin_config_viewed';
export const ADMIN_MODERATION_UPDATED = 'admin_moderation_updated';
export const ADMIN_ACTIVITY_FEED_DIAG = 'admin_activity_feed_diag';

// Admin metrics tools (#310 / #327) — soft migration to constants.
// Existing call sites for the three reset/inspect/delete events live as raw
// string literals; new call sites in #327 use these constants.
export const EVT_ADMIN_RATE_LIMIT_VIEWED = 'admin_rate_limit_viewed';
export const EVT_ADMIN_RATE_LIMIT_RESET = 'admin_rate_limit_reset';
export const EVT_ADMIN_LIST_ITEM_DELETED = 'admin_list_item_deleted';
export const EVT_ADMIN_LIST_ITEMS_INSPECTED = 'admin_list_items_inspected';
