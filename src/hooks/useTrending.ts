import { useCallback } from 'react';
import { useAsyncData } from './useAsyncData';
import { fetchTrending } from '../services/trending';
import type { TrendingData } from '../types';

export function useTrending() {
  const fetcher = useCallback(() => fetchTrending(), []);
  return useAsyncData<TrendingData | null>(fetcher);
}
