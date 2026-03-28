// Onboarding conversion events (#157)
export const EVT_ONBOARDING_BANNER_SHOWN = 'onboarding_banner_shown';
export const EVT_ONBOARDING_BANNER_CLICKED = 'onboarding_banner_clicked';
export const EVT_ONBOARDING_BANNER_DISMISSED = 'onboarding_banner_dismissed';
export const EVT_BENEFITS_SCREEN_SHOWN = 'benefits_screen_shown';
export const EVT_BENEFITS_SCREEN_CONTINUE = 'benefits_screen_continue';
export const EVT_ACTIVITY_REMINDER_SHOWN = 'activity_reminder_shown';
export const EVT_ACTIVITY_REMINDER_CLICKED = 'activity_reminder_clicked';
export const EVT_VERIFICATION_NUDGE_SHOWN = 'verification_nudge_shown';
export const EVT_VERIFICATION_NUDGE_RESEND = 'verification_nudge_resend';
export const EVT_VERIFICATION_NUDGE_DISMISSED = 'verification_nudge_dismissed';

// Trending events (#140)
export const EVT_TRENDING_VIEWED = 'trending_viewed';
export const EVT_TRENDING_BUSINESS_CLICKED = 'trending_business_clicked';

// Offline queue events (#136)
export const EVT_OFFLINE_ACTION_QUEUED = 'offline_action_queued';
export const EVT_OFFLINE_SYNC_COMPLETED = 'offline_sync_completed';
export const EVT_OFFLINE_SYNC_FAILED = 'offline_sync_failed';
export const EVT_OFFLINE_ACTION_DISCARDED = 'offline_action_discarded';

// Follows events (#129)
export const EVT_FOLLOW = 'follow';
export const EVT_UNFOLLOW = 'unfollow';
export const EVT_FEED_VIEWED = 'feed_viewed';
export const EVT_FEED_ITEM_CLICKED = 'feed_item_clicked';

// Tab navigation events (#158)
export const EVT_TAB_SWITCHED = 'tab_switched';
export const EVT_SUB_TAB_SWITCHED = 'sub_tab_switched';

// Business Sheet events
export const EVT_BUSINESS_SHEET_TAB_CHANGED = 'business_sheet_tab_changed';

// Recommendations events (#135)
export const EVT_RECOMMENDATION_SENT = 'recommendation_sent';
export const EVT_RECOMMENDATION_OPENED = 'recommendation_opened';
export const EVT_RECOMMENDATION_LIST_VIEWED = 'recommendation_list_viewed';

// Force update events (#191)
export const EVT_FORCE_UPDATE_TRIGGERED = 'force_update_triggered';
export const EVT_FORCE_UPDATE_LIMIT_REACHED = 'force_update_limit_reached';

// Account deletion events (#192)
export const EVT_ACCOUNT_DELETED = 'account_deleted';

// Rating prompt post check-in events (#199)
export const EVT_RATING_PROMPT_SHOWN = 'rating_prompt_shown';
export const EVT_RATING_PROMPT_CLICKED = 'rating_prompt_clicked';
export const EVT_RATING_PROMPT_DISMISSED = 'rating_prompt_dismissed';
export const EVT_RATING_PROMPT_CONVERTED = 'rating_prompt_converted';

// BusinessSheet performance events (#198)
export const EVT_BUSINESS_SHEET_PHASE1_MS = 'business_sheet_phase1_ms';
export const EVT_BUSINESS_SHEET_PHASE2_MS = 'business_sheet_phase2_ms';
export const EVT_BUSINESS_SHEET_CACHE_HIT = 'business_sheet_cache_hit';
