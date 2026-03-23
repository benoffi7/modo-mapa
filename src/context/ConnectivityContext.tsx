import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import type { OfflineAction } from '../types/offline';
import * as offlineQueue from '../services/offlineQueue';
import { processQueue } from '../services/syncEngine';
import { useToast } from './ToastContext';
import { trackEvent } from '../utils/analytics';
import {
  EVT_OFFLINE_SYNC_COMPLETED,
  EVT_OFFLINE_SYNC_FAILED,
  EVT_OFFLINE_ACTION_DISCARDED,
} from '../constants/analyticsEvents';
import { CONNECTIVITY_CHECK_URL, CONNECTIVITY_CHECK_TIMEOUT_MS } from '../constants/offline';

interface ConnectivityContextValue {
  isOffline: boolean;
  isSyncing: boolean;
  pendingActionsCount: number;
  pendingActions: OfflineAction[];
  discardAction: (actionId: string) => Promise<void>;
  retryFailed: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

async function checkRealConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTIVITY_CHECK_TIMEOUT_MS);
    await fetch(CONNECTIVITY_CHECK_URL, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingActions, setPendingActions] = useState<OfflineAction[]>([]);
  const toast = useToast();
  const isOfflineRef = useRef(isOffline);
  useEffect(() => { isOfflineRef.current = isOffline; }, [isOffline]);

  const refreshActions = useCallback(() => {
    offlineQueue.getAll().then(
      (actions) => setPendingActions(actions),
      () => { /* IndexedDB not available — degrade gracefully */ },
    );
  }, []);

  // Subscribe to queue changes
  useEffect(() => {
    refreshActions();
    return offlineQueue.subscribe(refreshActions);
  }, [refreshActions]);

  const doSync = useCallback(async () => {
    setIsSyncing(true);

    const queueCount = await offlineQueue.count();
    if (queueCount > 0) {
      toast.info(`Sincronizando ${queueCount} ${queueCount === 1 ? 'accion' : 'acciones'}...`);
    }

    await processQueue(
      () => {},
      (action, error) => {
        trackEvent(EVT_OFFLINE_SYNC_FAILED, {
          action_type: action.type,
          retry_count: action.retryCount,
          error: error.message,
        });
      },
      (syncedCount, failedCount) => {
        if (syncedCount > 0) {
          toast.success(`${syncedCount} ${syncedCount === 1 ? 'accion sincronizada' : 'acciones sincronizadas'}`);
        }
        if (failedCount > 0) {
          toast.warning(`${failedCount} ${failedCount === 1 ? 'accion fallo' : 'acciones fallaron'}`);
        }
        if (syncedCount > 0 || failedCount > 0) {
          trackEvent(EVT_OFFLINE_SYNC_COMPLETED, {
            synced_count: syncedCount,
            failed_count: failedCount,
          });
        }
      },
    );

    setIsSyncing(false);
  }, [toast]);

  // Listen to online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      const reallyOnline = await checkRealConnectivity();
      if (reallyOnline) {
        setIsOffline(false);
        doSync();
      }
    };

    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [doSync]);

  // Use ref-based lookup to avoid re-render cascade from pendingActions dependency
  const pendingActionsRef = useRef(pendingActions);
  useEffect(() => { pendingActionsRef.current = pendingActions; }, [pendingActions]);

  const discardAction = useCallback(async (actionId: string) => {
    const action = pendingActionsRef.current.find((a) => a.id === actionId);
    await offlineQueue.remove(actionId);
    if (action) {
      trackEvent(EVT_OFFLINE_ACTION_DISCARDED, {
        action_type: action.type,
        business_id: action.businessId,
      });
    }
  }, []);

  const retryFailed = useCallback(async () => {
    const all = await offlineQueue.getAll();
    const failedIds = all.filter((a) => a.status === 'failed').map((a) => a.id);
    await offlineQueue.bulkUpdateStatus(failedIds, 'pending', 0);
    if (!isOfflineRef.current) {
      doSync();
    }
  }, [doSync]);

  const value = useMemo<ConnectivityContextValue>(() => ({
    isOffline,
    isSyncing,
    pendingActionsCount: pendingActions.length,
    pendingActions,
    discardAction,
    retryFailed,
  }), [isOffline, isSyncing, pendingActions, discardAction, retryFailed]);

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity(): ConnectivityContextValue {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider');
  }
  return context;
}
