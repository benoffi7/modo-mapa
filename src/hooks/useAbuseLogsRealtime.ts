import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToAbuseLogs } from '../services/abuseLogs';
import type { AbuseLog } from '../types/admin';

interface UseAbuseLogsRealtimeReturn {
  logs: AbuseLog[] | null;
  loading: boolean;
  error: boolean;
  newCount: number;
  resetNewCount: () => void;
}

export function useAbuseLogsRealtime(maxDocs = 200): UseAbuseLogsRealtimeReturn {
  const [logs, setLogs] = useState<AbuseLog[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const initialIds = useRef<Set<string> | null>(null);

  const resetNewCount = useCallback(() => {
    setNewCount(0);
    if (logs) {
      initialIds.current = new Set(logs.map((l) => l.id));
    }
  }, [logs]);

  useEffect(() => {
    const unsubscribe = subscribeToAbuseLogs(
      maxDocs,
      (newLogs, changes) => {
        if (initialIds.current === null) {
          // First snapshot: store all IDs, no new count
          initialIds.current = new Set(newLogs.map((l) => l.id));
          setNewCount(0);
        } else {
          // Subsequent snapshots: count truly new docs
          const added = changes.filter(
            (change) => change.type === 'added' && !initialIds.current!.has(change.id),
          );
          if (added.length > 0) {
            setNewCount((prev) => prev + added.length);
          }
        }
        setLogs(newLogs);
        setLoading(false);
        setError(false);
      },
      () => {
        setError(true);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [maxDocs]);

  return { logs, loading, error, newCount, resetNewCount };
}
