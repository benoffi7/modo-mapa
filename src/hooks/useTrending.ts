import { useCallback } from 'react';
import { useAsyncData } from './useAsyncData';
import { fetchTrending } from '../services/trending';
import type { TrendingData } from '../types';

/** Global in-memory cache — trending data changes once per day */
let cachedData: TrendingData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function fetchWithCache(): Promise<TrendingData | null> {
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedData;
  }
  const data = await fetchTrending();
  cachedData = data;
  cacheTimestamp = Date.now();
  return data;
}

export function useTrending() {
  const fetcher = useCallback(() => fetchWithCache(), []);
  return useAsyncData<TrendingData | null>(fetcher);
}
