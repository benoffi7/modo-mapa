import { BUSINESS_CACHE_TTL_MS } from '../constants/cache';
import type { Rating, Comment, UserTag, CustomTag, MenuPhoto, PriceLevel } from '../types';

export interface BusinessCacheEntry {
  isFavorite: boolean;
  ratings: Rating[];
  comments: Comment[];
  userTags: UserTag[];
  customTags: CustomTag[];
  userCommentLikes: Set<string>;
  priceLevels: PriceLevel[];
  menuPhoto: MenuPhoto | null;
  timestamp: number;
}

const cache = new Map<string, BusinessCacheEntry>();

export function getBusinessCache(businessId: string): BusinessCacheEntry | null {
  const entry = cache.get(businessId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > BUSINESS_CACHE_TTL_MS) {
    cache.delete(businessId);
    return null;
  }
  return entry;
}

export function setBusinessCache(businessId: string, data: Omit<BusinessCacheEntry, 'timestamp'>): void {
  cache.set(businessId, { ...data, timestamp: Date.now() });
}

export function invalidateBusinessCache(businessId: string): void {
  cache.delete(businessId);
}

export function patchBusinessCache(
  businessId: string,
  patch: Partial<Omit<BusinessCacheEntry, 'timestamp'>>,
): void {
  const entry = cache.get(businessId);
  if (!entry) return;
  cache.set(businessId, { ...entry, ...patch, timestamp: Date.now() });
}

/** Clear all cached business data (used during account deletion). */
export function clearAllBusinessCache(): void {
  cache.clear();
}
