/**
 * Generic hook for fetching async data with loading/error states.
 *
 * Eliminates the duplicated loading/error/ignore pattern found across
 * all admin panel components.
 */
import { useState, useEffect } from 'react';

interface UseAsyncDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

export function useAsyncData<T>(fetcher: () => Promise<T>): UseAsyncDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
        console.error('useAsyncData error:', err);
        setError(true);
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [fetcher]);

  return { data, loading, error };
}
