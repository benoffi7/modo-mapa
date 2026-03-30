export interface UserRankingEntry {
  userId: string;
  displayName: string;
  score: number;
  breakdown: {
    comments: number;
    ratings: number;
    likes: number;
    tags: number;
    favorites: number;
    photos: number;
  };
  /** Consecutive days with activity (computed by Cloud Function, optional) */
  streak?: number;
}

export interface UserRanking {
  period: string;
  startDate: Date;
  endDate: Date;
  rankings: UserRankingEntry[];
  totalParticipants: number;
}
