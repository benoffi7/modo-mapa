import { PREDEFINED_TAGS } from '../constants/tags';
import type { Business, TrendingBusiness } from './business';
import type { LocationSource } from './navigation';

export type PredefinedTagId = (typeof PREDEFINED_TAGS)[number]['id'];

export interface InterestFeedItem {
  business: Business;
  matchingTags: string[];
  isNew: boolean;
}

export interface InterestFeedGroup {
  tag: string;
  businesses: InterestFeedItem[];
  newCount: number;
}

export type SuggestionReason = 'category' | 'tags' | 'nearby';

export interface SuggestedBusiness {
  business: Business;
  score: number;
  reasons: SuggestionReason[];
}

export interface LocalTrendingResult {
  businesses: TrendingBusiness[];
  source: LocationSource;
  localityName: string | null;
  radiusKm: number;
}
