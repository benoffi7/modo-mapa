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

// Scheduled
export { dailyMetrics } from './scheduled/dailyMetrics';

// Admin
export { createBackup, listBackups, restoreBackup, deleteBackup } from './admin/backups';
