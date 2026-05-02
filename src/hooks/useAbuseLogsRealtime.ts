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

/**
 * Subscribes to realtime `abuseLogs`. When `enabled` is `false` the hook
 * tears down any active subscription and resets all state — used by
 * `AbuseAlerts` to pause the listener while the admin is on the
 * "Rate Limits" subtab so we don't pay for reads we won't render. When
 * `enabled` flips back to `true` the effect re-runs and `initialIds` is
 * reseeded from the first snapshot post-resume, so existing docs are not
 * counted as "new" alerts (the toast is gated on `newCount > 0`).
 */
export function useAbuseLogsRealtime(
  maxDocs = 200,
  enabled = true,
): UseAbuseLogsRealtimeReturn {
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
    if (!enabled) {
      // Pause: clear state and skip the subscription. When enabled flips
      // back to true the effect re-runs and a fresh subscription is created
      // (initialIds.current === null forces the next first-snapshot to
      // re-seed without counting docs as "new").
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pause: external state sync requires reset
      setLogs(null);
      setLoading(false);
      setError(false);
      setNewCount(0);
      initialIds.current = null;
      return;
    }

    setLoading(true);

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
  }, [maxDocs, enabled]);

  return { logs, loading, error, newCount, resetNewCount };
}
