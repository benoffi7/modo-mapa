import { initializeApp } from 'firebase-admin/app';

initializeApp();

// Triggers
export { onCommentCreated, onCommentDeleted } from './triggers/comments';
export { onCustomTagCreated, onCustomTagDeleted } from './triggers/customTags';
export { onFeedbackCreated } from './triggers/feedback';
export { onRatingWritten } from './triggers/ratings';
export { onFavoriteCreated, onFavoriteDeleted } from './triggers/favorites';
export { onUserCreated } from './triggers/users';

// Scheduled
export { dailyMetrics } from './scheduled/dailyMetrics';

// Admin
export { createBackup, listBackups, restoreBackup } from './admin/backups';
