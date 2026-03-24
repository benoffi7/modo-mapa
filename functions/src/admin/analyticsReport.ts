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
  'surprise_me',
  'list_created',
  'list_item_added',
  'business_search',
  'business_share',
  'menu_photo_upload',
  'dark_mode_toggle',
  'side_menu_section',
  'business_view',
  'business_filter_tag',
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
