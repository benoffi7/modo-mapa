import { useEffect, useState } from 'react';
import { fetchDailyMetrics } from '../services/metrics';
import type { PublicMetrics } from '../types/metrics';
import { logger } from '../utils/logger';

interface UsePublicMetricsReturn {
  metrics: PublicMetrics | null;
  loading: boolean;
  error: boolean;
}

export function usePublicMetrics(): UsePublicMetricsReturn {
  const [metrics, setMetrics] = useState<PublicMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;
    const today = new Date().toISOString().slice(0, 10);

    fetchDailyMetrics(today)
      .then((result) => {
        if (ignore) return;
        setMetrics(result);
        setLoading(false);
      })
      .catch((err) => {
        logger.error('[usePublicMetrics] fetch failed:', err);
        if (ignore) return;
        setError(true);
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  return { metrics, loading, error };
}
