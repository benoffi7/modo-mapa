import { useState, useCallback, useMemo } from 'react';
import { useAsyncData } from './useAsyncData';
import { fetchRanking, getCurrentPeriodKey, getPreviousPeriodKey } from '../services/rankings';
import type { UserRanking } from '../types';

type PeriodType = 'weekly' | 'monthly' | 'yearly' | 'alltime';

/** Maps userId → position change vs previous period (positive = moved up) */
export type PositionChangeMap = Map<string, number>;

interface UseRankingsReturn {
  ranking: UserRanking | null;
  loading: boolean;
  error: boolean;
  periodType: PeriodType;
  setPeriodType: (type: PeriodType) => void;
  refetch: () => void;
  positionChanges: PositionChangeMap;
}

export function useRankings(): UseRankingsReturn {
  const [periodType, setPeriodType] = useState<PeriodType>('weekly');

  const fetcher = useCallback(
    () => fetchRanking(getCurrentPeriodKey(periodType)),
    [periodType],
  );

  const prevFetcher = useCallback(() => {
    const prevKey = getPreviousPeriodKey(periodType);
    return prevKey ? fetchRanking(prevKey) : Promise.resolve(null);
  }, [periodType]);

  const { data, loading, error, refetch } = useAsyncData(fetcher);
  const { data: prevRanking } = useAsyncData(prevFetcher);

  const positionChanges = useMemo<PositionChangeMap>(() => {
    const map = new Map<string, number>();
    if (!data?.rankings || !prevRanking?.rankings) return map;

    const prevPositions = new Map<string, number>();
    prevRanking.rankings.forEach((e, i) => prevPositions.set(e.userId, i + 1));

    data.rankings.forEach((e, i) => {
      const currentPos = i + 1;
      const prevPos = prevPositions.get(e.userId);
      if (prevPos != null) {
        // positive = moved up (lower position number)
        map.set(e.userId, prevPos - currentPos);
      }
    });

    return map;
  }, [data, prevRanking]);

  return { ranking: data, loading, error, periodType, setPeriodType, refetch, positionChanges };
}
