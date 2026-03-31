/**
 * Admin services — barrel re-export.
 *
 * Split into domain modules for maintainability:
 *   counters.ts — fetchCounters, fetchDailyMetrics
 *   activity.ts — fetchRecent* (comments, ratings, favorites, tags, likes, price levels, checkins)
 *   users.ts    — fetchUsersPanelData, fetchCommentStats, fetchAuthStats, fetchSettingsAggregates
 *   social.ts   — fetchRecentFollows, fetchRecentRecommendations, fetchFollowStats, fetchRecommendationStats
 *   content.ts  — feedback, photos, abuse, rankings, trending, notifications, lists, perf, storage, analytics
 */
export { fetchCounters, fetchDailyMetrics } from './counters';
export {
  fetchRecentComments,
  fetchRecentRatings,
  fetchRecentFavorites,
  fetchRecentUserTags,
  fetchRecentCustomTags,
  fetchAllCustomTags,
  fetchRecentCommentLikes,
  fetchRecentPriceLevels,
  fetchRecentCheckins,
} from './activity';
export { fetchUsersPanelData, fetchCommentStats, fetchAuthStats, fetchSettingsAggregates } from './users';
export { fetchRecentFollows, fetchRecentRecommendations, fetchFollowStats, fetchRecommendationStats } from './social';
export {
  fetchRecentFeedback,
  fetchPendingPhotos,
  fetchAllPhotos,
  fetchAbuseLogs,
  reviewAbuseLog,
  dismissAbuseLog,
  fetchLatestRanking,
  fetchTrendingCurrent,
  fetchNotificationDetails,
  fetchListStats,
  fetchTopLists,
  fetchPerfMetrics,
  fetchStorageStats,
  fetchAnalyticsReport,
} from './content';
export {
  moderateComment,
  moderateRating,
  moderateCustomTag,
  fetchModerationLogs,
} from './moderation';
