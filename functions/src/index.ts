import { initializeApp } from 'firebase-admin/app';
import { initSentry } from './utils/sentry';

initializeApp();
initSentry();

// Triggers
export { onCommentCreated, onCommentUpdated, onCommentDeleted } from './triggers/comments';
export { onCommentLikeCreated, onCommentLikeDeleted } from './triggers/commentLikes';
export { onCustomTagCreated, onCustomTagDeleted } from './triggers/customTags';
export { onFeedbackCreated } from './triggers/feedback';
export { onRatingWritten } from './triggers/ratings';
export { onFavoriteCreated, onFavoriteDeleted } from './triggers/favorites';
export { onUserCreated } from './triggers/users';
export { onMenuPhotoCreated } from './triggers/menuPhotos';
export { onListItemCreated } from './triggers/listItems';
export { onSharedListCreated } from './triggers/sharedLists';
export { onPriceLevelCreated, onPriceLevelUpdated } from './triggers/priceLevels';
export { onCheckInCreated, onCheckInDeleted } from './triggers/checkins';
export { onFollowCreated, onFollowDeleted } from './triggers/follows';
export { onUserSettingsWritten } from './triggers/userSettings';
export { onRecommendationCreated } from './triggers/recommendations';
export { onBeforeUserCreated } from './triggers/authBlocking';
export { onUserTagCreated, onUserTagDeleted } from './triggers/userTags';

// Scheduled
export { dailyMetrics } from './scheduled/dailyMetrics';
export { cleanupRejectedPhotos } from './scheduled/cleanupPhotos';
export { computeWeeklyRanking, computeMonthlyRanking, computeAlltimeRanking } from './scheduled/rankings';
export { cleanupExpiredNotifications } from './scheduled/cleanupNotifications';
export { generateFeaturedLists } from './scheduled/featuredLists';
export { computeTrendingBusinesses } from './scheduled/trending';
export { cleanupActivityFeed } from './scheduled/cleanupActivityFeed';

// Admin
export { createBackup, listBackups, restoreBackup, deleteBackup } from './admin/backups';
export { approveMenuPhoto, rejectMenuPhoto, deleteMenuPhoto, reportMenuPhoto } from './admin/menuPhotos';
export { respondToFeedback, resolveFeedback, createGithubIssueFromFeedback } from './admin/feedback';
export { getAuthStats } from './admin/authStats';
export { setAdminClaim, removeAdminClaim } from './admin/claims';
export { getStorageStats } from './admin/storageStats';
export { writePerfMetrics } from './admin/perfMetrics';
export { getAnalyticsReport } from './admin/analyticsReport';
export { toggleFeaturedList, getPublicLists, getFeaturedLists } from './admin/featuredLists';
export { moderateComment, moderateRating, moderateCustomTag } from './admin/moderation';
export { updateModerationConfig } from './admin/moderationConfig';
export { getActivityFeedDiag } from './admin/activityFeedDiag';
export { fetchDeletionAuditLogs } from './admin/deletionAuditLogs';
export { adminListRateLimits, adminResetRateLimit } from './admin/rateLimits';
export { adminDeleteListItem } from './admin/listItems';

// Callable
export { inviteListEditor } from './callable/inviteListEditor';
export { removeListEditor } from './callable/removeListEditor';
export { deleteUserAccount } from './callable/deleteUserAccount';
export { cleanAnonymousData } from './callable/cleanAnonymousData';
