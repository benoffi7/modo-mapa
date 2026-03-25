/**
 * Generic hook for fetching async data with loading/error states.
 *
 * Eliminates the duplicated loading/error/ignore pattern found across
 * all admin panel components.
 */
import { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

interface UseAsyncDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}

export function useAsyncData<T>(fetcher: () => Promise<T>): UseAsyncDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let ignore = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount/dependency change
    setLoading(true);
    setError(false);

    fetcher()
      .then((result) => {
        if (ignore) return;
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        if (ignore) return;
        if (import.meta.env.DEV) logger.error('useAsyncData error:', err);
        setError(true);
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [fetcher, tick]);

  return { data, loading, error, refetch };
}
