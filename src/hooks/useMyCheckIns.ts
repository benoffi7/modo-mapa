import { useState, useEffect, useCallback } from 'react';
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
  refresh: () => Promise<void>;
}

export function useMyCheckIns(): UseMyCheckInsReturn {
  const { user } = useAuth();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await fetchMyCheckIns(user.uid);
      setCheckIns(data);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = {
    totalCheckIns: checkIns.length,
    uniqueBusinesses: new Set(checkIns.map((c) => c.businessId)).size,
  };

  return { checkIns, stats, isLoading, refresh: load };
}
