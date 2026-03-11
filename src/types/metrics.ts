export interface TopTagEntry {
  tagId: string;
  count: number;
}

export interface TopBusinessEntry {
  businessId: string;
  count: number;
}

export interface TopRatedEntry extends TopBusinessEntry {
  avgScore: number;
}

export interface PublicMetrics {
  date: string;
  ratingDistribution: Record<string, number>;
  topTags: TopTagEntry[];
  topFavorited: TopBusinessEntry[];
  topCommented: TopBusinessEntry[];
  topRated: TopRatedEntry[];
}
