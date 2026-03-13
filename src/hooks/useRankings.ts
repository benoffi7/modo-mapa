import { useState, useCallback } from 'react';
import { useAsyncData } from './useAsyncData';
import { fetchRanking, getCurrentPeriodKey } from '../services/rankings';
import type { UserRanking } from '../types';

type PeriodType = 'weekly' | 'monthly' | 'yearly';

interface UseRankingsReturn {
  ranking: UserRanking | null;
  loading: boolean;
  error: boolean;
  periodType: PeriodType;
  setPeriodType: (type: PeriodType) => void;
}

export function useRankings(): UseRankingsReturn {
  const [periodType, setPeriodType] = useState<PeriodType>('weekly');

  const fetcher = useCallback(
    () => fetchRanking(getCurrentPeriodKey(periodType)),
    [periodType],
  );

  const { data, loading, error } = useAsyncData(fetcher);

  return { ranking: data, loading, error, periodType, setPeriodType };
}
