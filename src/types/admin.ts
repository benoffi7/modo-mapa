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

export interface NotificationStats {
  total: number;
  read: number;
  unread: number;
  byType: Record<string, number>;
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
  type: 'rate_limit' | 'flagged' | 'top_writers';
  collection: string;
  detail: string;
  timestamp: Date;
  reviewed?: boolean | undefined;
  dismissed?: boolean | undefined;
  reviewedAt?: Date | undefined;
  severity?: AbuseSeverity | undefined;
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
