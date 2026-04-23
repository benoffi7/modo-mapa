import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { captureException } from '../utils/sentry';
import { assertAdmin } from '../helpers/assertAdmin';
import { ENFORCE_APP_CHECK_ADMIN, getDb } from '../helpers/env';

// ── Types ─────────────────────────────────────────────────────────────

interface GA4EventCount {
  eventName: string;
  date: string; // "YYYYMMDD"
  eventCount: number;
}

interface AnalyticsReportResponse {
  events: GA4EventCount[];
  cachedAt: string; // ISO timestamp
  fromCache: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────

const GA4_EVENT_NAMES = [
  // Auth
  'account_created',
  'email_sign_in',
  'sign_out',
  'password_changed',
  // Check-in
  'checkin_created',
  'checkin_deleted',
  'checkin_cooldown_blocked',
  'checkin_proximity_warning',
  // Verification badges
  'verification_badge_earned',
  'verification_badge_viewed',
  'verification_badge_tooltip',
  // Core actions
  'comment_submit',
  'comment_like',
  'rating_submit',
  'criteria_rating_submit',
  'favorite_toggle',
  'feedback_submit',
  'price_level_vote',
  'tag_vote',
  'custom_tag_create',
  // Existing
  'surprise_me',
  'list_created',
  'list_item_added',
  'list_item_removed',
  'list_deleted',
  'list_icon_changed',
  'business_search',
  'business_filter_price',
  'business_filter_tag',
  'business_share',
  'menu_photo_upload',
  'dark_mode_toggle',
  'business_view',
  'business_detail_opened',
  'business_detail_tab_changed',
  'business_detail_cta_clicked',
  'question_created',
  'question_viewed',
  // Search
  'search_view_toggled',
  'search_list_item_clicked',
  // Onboarding
  'onboarding_banner_shown',
  'onboarding_banner_clicked',
  'onboarding_banner_dismissed',
  'benefits_screen_shown',
  'benefits_screen_continue',
  'activity_reminder_shown',
  'activity_reminder_clicked',
  'verification_nudge_shown',
  'verification_nudge_resend',
  'verification_nudge_dismissed',
  // Trending
  'trending_viewed',
  'trending_business_clicked',
  'trending_near_viewed',
  'trending_near_tapped',
  'trending_near_configure_tapped',
  'rankings_zone_filter',
  // Home engagement
  'special_tapped',
  'for_you_tapped',
  'quick_action_tapped',
  'quick_actions_edited',
  'recent_search_tapped',
  // Interests
  'tag_followed',
  'tag_unfollowed',
  'interests_section_viewed',
  'interests_business_tapped',
  'interests_cta_tapped',
  'interests_suggested_tapped',
  // Digest
  'digest_section_viewed',
  'digest_item_tapped',
  'digest_cta_tapped',
  'digest_frequency_changed',
  // Offline
  'offline_action_queued',
  'offline_sync_completed',
  'offline_sync_failed',
  'offline_action_discarded',
  // Business
  'business_directions',
  'rating_prompt_shown',
  'rating_prompt_clicked',
  'rating_prompt_dismissed',
  'rating_prompt_converted',
  'business_sheet_phase1_ms',
  'business_sheet_phase2_ms',
  'business_sheet_cache_hit',
  // Social
  'follow',
  'unfollow',
  'feed_viewed',
  'feed_item_clicked',
  'recommendation_sent',
  'recommendation_opened',
  'recommendation_list_viewed',
  // System
  'force_update_triggered',
  'force_update_limit_reached',
  'account_deleted',
  'perf_vitals_captured',
  // GA4 auto-events (for volume context)
  'page_view',
  'screen_view',
  // Navigation
  'tab_switched',
  'sub_tab_switched',
  'business_sheet_tab_changed',
  // Admin tools (#310)
  'admin_config_viewed',
  'admin_moderation_updated',
  'admin_activity_feed_diag',
  'admin_list_items_inspected',
  'admin_rate_limit_reset',
  'admin_list_item_deleted',
] as const;

const CACHE_TTL_MS = 3_600_000; // 1 hour
const CACHE_DOC_PATH = 'config/analyticsCache';

// ── Cloud Function ────────────────────────────────────────────────────

export const getAnalyticsReport = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK_ADMIN, secrets: ['GA4_PROPERTY_ID'] },
  async (request: CallableRequest): Promise<AnalyticsReportResponse> => {
    assertAdmin(request.auth);

    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) {
      throw new HttpsError('failed-precondition', 'GA4_PROPERTY_ID not configured');
    }

    const db = getDb();

    // Check cache
    const cacheRef = db.doc(CACHE_DOC_PATH);
    const cacheSnap = await cacheRef.get();

    if (cacheSnap.exists) {
      const cached = cacheSnap.data() as { events: GA4EventCount[]; cachedAt: string };
      const cachedTime = new Date(cached.cachedAt).getTime();
      if (Date.now() - cachedTime < CACHE_TTL_MS) {
        return { events: cached.events, cachedAt: cached.cachedAt, fromCache: true };
      }
    }

    // Cache miss or expired — query GA4 Data API
    try {
      const analyticsClient = new BetaAnalyticsDataClient();

      const [response] = await analyticsClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'eventName' }, { name: 'date' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: {
            fieldName: 'eventName',
            inListFilter: {
              values: [...GA4_EVENT_NAMES],
            },
          },
        },
      });

      const events: GA4EventCount[] = (response.rows ?? []).map((row) => ({
        eventName: row.dimensionValues?.[0]?.value ?? '',
        date: row.dimensionValues?.[1]?.value ?? '',
        eventCount: Number(row.metricValues?.[0]?.value ?? 0),
      }));

      const cachedAt = new Date().toISOString();

      await cacheRef.set({ events, cachedAt }, { merge: true });

      return { events, cachedAt, fromCache: false };
    } catch (err) {
      captureException(err);
      logger.error('Error fetching GA4 analytics report', { error: String(err) });
      throw new HttpsError('unavailable', 'Error obteniendo reporte de analytics de GA4');
    }
  },
);
