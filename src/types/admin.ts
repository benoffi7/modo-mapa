import type { PublicMetrics } from './metrics';

export interface AdminCounters {
  comments: number;
  ratings: number;
  favorites: number;
  feedback: number;
  users: number;
  customTags: number;
  userTags: number;
  commentLikes: number;
  checkins: number;
  follows: number;
  recommendations: number;
  priceLevels: number;
  dailyReads: number;
  dailyWrites: number;
  dailyDeletes: number;
}

export interface DailyMetrics extends PublicMetrics {
  dailyReads: number;
  dailyWrites: number;
  dailyDeletes: number;
  writesByCollection: Record<string, number>;
  readsByCollection: Record<string, number>;
  deletesByCollection: Record<string, number>;
  activeUsers: number;
  newAccounts?: number;
}

export interface AuthUserInfo {
  uid: string;
  displayName: string | null;
  authMethod: 'anonymous' | 'email';
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthStats {
  byMethod: { anonymous: number; email: number };
  emailVerification: { verified: number; unverified: number };
  users: AuthUserInfo[];
}

export interface SettingsAggregates {
  totalSettings: number;
  publicProfiles: number;
  notificationsEnabled: number;
  analyticsEnabled: number;
}

export type AbuseSeverity = 'low' | 'medium' | 'high';

export interface AbuseLog {
  id: string;
  userId: string;
  type: 'rate_limit' | 'flagged' | 'top_writers' | 'recipient_flood' | 'anon_flood' | 'ip_rate_limit' | 'config_edit' | 'deletion_failure';
  collection: string;
  detail: string;
  timestamp: Date;
  reviewed?: boolean | undefined;
  dismissed?: boolean | undefined;
  reviewedAt?: Date | undefined;
  severity?: AbuseSeverity | undefined;
}

export interface DeletionAuditLogEntry {
  id: string;
  uidHash: string;
  type: 'account_delete' | 'anonymous_clean';
  status: 'success' | 'partial_failure' | 'failure';
  collectionsProcessed: number;
  collectionsFailed: string[];
  storageFilesDeleted: number;
  storageFilesFailed: number;
  aggregatesCorrected: boolean;
  durationMs: number;
  triggeredBy: 'user';
  timestamp: Date;
}

export interface StorageStats {
  totalBytes: number;
  fileCount: number;
  updatedAt: string;
}

export interface GA4EventCount {
  eventName: string;
  date: string;
  eventCount: number;
}

export interface AnalyticsReportResponse {
  events: GA4EventCount[];
  cachedAt: string;
  fromCache: boolean;
}

export type HealthStatus = 'ok' | 'warning' | 'error';

export interface CronRunStatus {
  cronName: string;
  lastRunAt: Date | null;
  result: 'success' | 'error' | null;
  detail?: string | undefined;
  durationMs?: number | undefined;
}

export interface NotificationTypeBreakdown {
  type: string;
  total: number;
  read: number;
  readRate: number;
}

export interface NotificationDetails {
  total: number;
  read: number;
  unread: number;
  byType: NotificationTypeBreakdown[];
}

export interface ListStats {
  totalLists: number;
  publicLists: number;
  privateLists: number;
  collaborativeLists: number;
  totalItems: number;
  avgItemsPerList: number;
}

export interface Special {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  type: 'featured_list' | 'trending' | 'custom_link';
  referenceId: string;
  order: number;
  active: boolean;
}

export interface AchievementCondition {
  metric: string;
  threshold: number;
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: string;
  condition: AchievementCondition;
  order: number;
  active: boolean;
}

/** Generic config document — key/value pairs with unknown structure */
export interface ConfigDocument {
  id: string;
  data: Record<string, unknown>;
}

/** Typed moderation config */
export interface ModerationConfig {
  bannedWords: string[];
}

/** Activity feed diagnostic item (returned by callable) */
export interface ActivityFeedDiagItem {
  id: string;
  actorId: string;
  actorName: string;
  type: 'rating' | 'comment' | 'favorite';
  businessId: string;
  businessName: string;
  referenceId: string;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
}

export interface ActivityFeedDiagResponse {
  items: ActivityFeedDiagItem[];
  total: number;
}

export type ModerationAction = 'delete' | 'hide';

export type ModerationTargetCollection = 'comments' | 'ratings' | 'customTags';

export interface ModerationLog {
  id: string;
  adminId: string;
  action: ModerationAction;
  targetCollection: ModerationTargetCollection;
  targetDocId: string;
  targetUserId: string;
  reason?: string | undefined;
  snapshot: Record<string, unknown>;
  timestamp: Date;
}
