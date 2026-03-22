import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchMyCheckIns } from '../services/checkins';
import type { CheckIn } from '../types';

export interface UseMyCheckInsReturn {
  checkIns: CheckIn[];
  stats: {
    totalCheckIns: number;
    uniqueBusinesses: number;
  };
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useMyCheckIns(): UseMyCheckInsReturn {
  const { user } = useAuth();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMyCheckIns(user.uid);
      setCheckIns(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar visitas');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => ({
    totalCheckIns: checkIns.length,
    uniqueBusinesses: new Set(checkIns.map((c) => c.businessId)).size,
  }), [checkIns]);

  return { checkIns, stats, isLoading, error, refresh: load };
}
