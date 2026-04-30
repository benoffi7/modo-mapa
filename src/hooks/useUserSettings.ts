import { useState, useCallback, useEffect, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useAsyncData } from './useAsyncData';
import { fetchUserSettings, updateUserSettings, DEFAULT_SETTINGS } from '../services/userSettings';
import { auth } from '../config/firebase';
import { setAnalyticsEnabled } from '../utils/analytics';
import { initPerfMetrics } from '../utils/perfMetrics';
import type { UserSettings, DigestFrequency } from '../types';
import { MSG_COMMON } from '../constants/messages';
import { logger } from '../utils/logger';

type BooleanSettingKey = 'profilePublic' | 'notificationsEnabled' | 'notifyLikes' | 'notifyPhotos' | 'notifyRankings' | 'notifyFeedback' | 'notifyReplies' | 'notifyFollowers' | 'notifyRecommendations' | 'analyticsEnabled';

// #323: pendingState a nivel módulo — sobrevive al unmount del consumer.
// Per-uid map: distintos usuarios autenticados no comparten snapshot.
// Cualquier instancia del hook que esté montada al reconectar dispara el flush
// (NotificationsProvider, GreetingHeader, MapView mantienen al menos una viva).
const pendingByUser = new Map<string, Partial<UserSettings>>();

// #323 Cycle 3 BLOCKER: limpiar snapshot del UID anterior al logout / switch de cuenta.
// Sin esto, en multi-cuenta same-browser un snapshot stale de A pisa lo que A
// configuró desde otro device cuando A vuelve a loguearse y reconecta.
let _previousUid: string | null = null;
onAuthStateChanged(auth, (firebaseUser) => {
  const newUid = firebaseUser?.uid ?? null;
  if (_previousUid && _previousUid !== newUid) {
    pendingByUser.delete(_previousUid);
  }
  _previousUid = newUid;
});

/** Test-only: limpia el estado modular entre tests. No exportar a producción. */
export function __resetPendingSettingsForTests() {
  pendingByUser.clear();
  _previousUid = null;
}

export function useUserSettings() {
  const { user } = useAuth();
  const toast = useToast();
  const { isOffline } = useConnectivity();
  const [optimistic, setOptimistic] = useState<Partial<Record<BooleanSettingKey, boolean>>>({});
  const [digestOverride, setDigestOverride] = useState<DigestFrequency | null>(null);
  const [localityOverride, setLocalityOverride] = useState<{ locality: string; localityLat: number; localityLng: number } | null>(null);

  const fetcher = useCallback(async (): Promise<UserSettings> => {
    if (!user) return { ...DEFAULT_SETTINGS };
    return fetchUserSettings(user.uid);
  }, [user]);

  const { data, loading } = useAsyncData(fetcher);

  const settings = useMemo<UserSettings>(() => ({
    ...(data ?? DEFAULT_SETTINGS),
    ...optimistic,
    ...(digestOverride != null ? { notificationDigest: digestOverride } : {}),
    ...(localityOverride ?? {}),
  }), [data, optimistic, digestOverride, localityOverride]);

  // Sync analytics enabled state with the SDK
  useEffect(() => {
    setAnalyticsEnabled(settings.analyticsEnabled);
  }, [settings.analyticsEnabled]);

  // Initialize performance metrics once user and settings are ready
  useEffect(() => {
    if (user) {
      initPerfMetrics(user.uid, settings.analyticsEnabled);
    }
  }, [user, settings.analyticsEnabled]);

  const updateSetting = useCallback(
    (key: BooleanSettingKey, value: boolean) => {
      if (!user) return;

      setOptimistic((prev) => ({ ...prev, [key]: value }));

      // #323: offline → acumular en pendingByUser (module-level), flush al reconectar.
      if (isOffline) {
        const prev = pendingByUser.get(user.uid) ?? {};
        pendingByUser.set(user.uid, { ...prev, [key]: value });
        return;
      }

      updateUserSettings(user.uid, { [key]: value }).catch((err) => {
        logger.error('[useUserSettings] updateUserSettings failed:', err);
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        toast.warning(MSG_COMMON.settingUpdateError);
      });
    },
    [user, isOffline, toast],
  );

  const updateLocality = useCallback(
    (locality: string, lat: number, lng: number) => {
      if (!user) return;
      setLocalityOverride({ locality, localityLat: lat, localityLng: lng });

      const partial = { locality, localityLat: lat, localityLng: lng };
      if (isOffline) {
        const prev = pendingByUser.get(user.uid) ?? {};
        pendingByUser.set(user.uid, { ...prev, ...partial });
        return;
      }

      updateUserSettings(user.uid, partial).catch((err) => {
        logger.error('[useUserSettings] updateLocality failed:', err);
        setLocalityOverride(null);
        toast.warning(MSG_COMMON.settingUpdateError);
      });
    },
    [user, isOffline, toast],
  );

  const clearLocality = useCallback(
    () => {
      if (!user) return;
      setLocalityOverride({ locality: '', localityLat: 0, localityLng: 0 });

      const partial = { locality: '', localityLat: 0, localityLng: 0 };
      if (isOffline) {
        const prev = pendingByUser.get(user.uid) ?? {};
        pendingByUser.set(user.uid, { ...prev, ...partial });
        return;
      }

      updateUserSettings(user.uid, partial).catch((err) => {
        logger.error('[useUserSettings] clearLocality failed:', err);
        setLocalityOverride(null);
        toast.warning(MSG_COMMON.settingUpdateError);
      });
    },
    [user, isOffline, toast],
  );

  const updateDigestFrequency = useCallback(
    (value: DigestFrequency) => {
      if (!user) return;
      setDigestOverride(value);

      if (isOffline) {
        const prev = pendingByUser.get(user.uid) ?? {};
        pendingByUser.set(user.uid, { ...prev, notificationDigest: value });
        return;
      }

      updateUserSettings(user.uid, { notificationDigest: value }).catch((err) => {
        logger.error('[useUserSettings] updateDigestFrequency failed:', err);
        setDigestOverride(null);
        toast.warning(MSG_COMMON.settingUpdateError);
      });
    },
    [user, isOffline, toast],
  );

  // #323: flush effect — cuando vuelve online y hay pending, aplicar el snapshot.
  // El estado vive en pendingByUser (módulo-level) → cualquier instancia montada lo flushea,
  // incluso si la instancia que originó la escritura ya se desmontó.
  useEffect(() => {
    let cancelled = false;
    if (!isOffline && user) {
      const snapshot = pendingByUser.get(user.uid);
      if (!snapshot) return;
      pendingByUser.delete(user.uid);
      updateUserSettings(user.uid, snapshot).catch((err) => {
        if (cancelled) return;
        logger.error('[useUserSettings] flush failed:', err);
        toast.warning(MSG_COMMON.settingUpdateError);
      });
    }
    return () => { cancelled = true; };
  }, [isOffline, user, toast]);

  return { settings, loading, updateSetting, updateDigestFrequency, updateLocality, clearLocality };
}
