import type { PublicMetrics } from './metrics';

export interface AdminCounters {
  comments: number;
  ratings: number;
  favorites: number;
  feedback: number;
  users: number;
  customTags: number;
  userTags: number;
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
}

export interface AbuseLog {
  id: string;
  userId: string;
  type: 'rate_limit' | 'flagged' | 'top_writers';
  collection: string;
  detail: string;
  timestamp: Date;
}
