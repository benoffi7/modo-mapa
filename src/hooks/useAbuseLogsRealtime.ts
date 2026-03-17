import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { abuseLogConverter } from '../config/adminConverters';
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
    const q = query(
      collection(db, COLLECTIONS.ABUSE_LOGS).withConverter(abuseLogConverter),
      orderBy('timestamp', 'desc'),
      limit(maxDocs),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (initialIds.current === null) {
          // First snapshot: store all IDs, no new count
          initialIds.current = new Set(snapshot.docs.map((d) => d.id));
          setNewCount(0);
        } else {
          // Subsequent snapshots: count truly new docs
          const added = snapshot.docChanges()
            .filter((change) => change.type === 'added' && !initialIds.current!.has(change.doc.id));
          if (added.length > 0) {
            setNewCount((prev) => prev + added.length);
          }
        }
        setLogs(snapshot.docs.map((d) => d.data()));
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
