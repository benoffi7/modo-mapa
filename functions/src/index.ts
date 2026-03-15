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
export { onPriceLevelCreated, onPriceLevelUpdated } from './triggers/priceLevels';

// Scheduled
export { dailyMetrics } from './scheduled/dailyMetrics';
export { cleanupRejectedPhotos } from './scheduled/cleanupPhotos';
export { computeWeeklyRanking, computeMonthlyRanking, computeAlltimeRanking } from './scheduled/rankings';
export { cleanupExpiredNotifications } from './scheduled/cleanupNotifications';

// Admin
export { createBackup, listBackups, restoreBackup, deleteBackup } from './admin/backups';
export { approveMenuPhoto, rejectMenuPhoto, deleteMenuPhoto, reportMenuPhoto } from './admin/menuPhotos';
export { respondToFeedback, resolveFeedback, createGithubIssueFromFeedback } from './admin/feedback';
export { getAuthStats } from './admin/authStats';
export { setAdminClaim, removeAdminClaim } from './admin/claims';
export { getStorageStats } from './admin/storageStats';
