import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { publicMetricsConverter } from '../config/metricsConverter';
import { COLLECTIONS } from '../config/collections';
import type { PublicMetrics } from '../types/metrics';

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

    getDoc(doc(db, COLLECTIONS.DAILY_METRICS, today).withConverter(publicMetricsConverter))
      .then((snap) => {
        if (ignore) return;
        if (snap.exists()) {
          setMetrics(snap.data());
        }
        setLoading(false);
      })
      .catch(() => {
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
