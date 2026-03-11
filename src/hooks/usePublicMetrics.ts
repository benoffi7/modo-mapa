import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { dailyMetricsConverter } from '../config/adminConverters';
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

    getDoc(doc(db, COLLECTIONS.DAILY_METRICS, today).withConverter(dailyMetricsConverter))
      .then((snap) => {
        if (ignore) return;
        if (snap.exists()) {
          const data = snap.data();
          setMetrics({
            date: data.date,
            ratingDistribution: data.ratingDistribution,
            topTags: data.topTags,
            topFavorited: data.topFavorited,
            topCommented: data.topCommented,
            topRated: data.topRated,
          });
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
