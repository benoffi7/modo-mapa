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

export interface DailyMetrics {
  date: string;
  ratingDistribution: Record<string, number>;
  topFavorited: Array<{ businessId: string; count: number }>;
  topCommented: Array<{ businessId: string; count: number }>;
  topRated: Array<{ businessId: string; avgScore: number; count: number }>;
  topTags: Array<{ tagId: string; count: number }>;
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
