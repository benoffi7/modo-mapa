import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useAsyncData } from './useAsyncData';
import { fetchUserSettings, updateUserSettings, DEFAULT_SETTINGS } from '../services/userSettings';
import { setAnalyticsEnabled } from '../utils/analytics';
import { initPerfMetrics } from '../utils/perfMetrics';
import type { UserSettings, DigestFrequency } from '../types';
import { MSG_COMMON } from '../constants/messages';
import { logger } from '../utils/logger';

type BooleanSettingKey = 'profilePublic' | 'notificationsEnabled' | 'notifyLikes' | 'notifyPhotos' | 'notifyRankings' | 'notifyFeedback' | 'notifyReplies' | 'notifyFollowers' | 'notifyRecommendations' | 'analyticsEnabled';

export function useUserSettings() {
  const { user } = useAuth();
  const toast = useToast();
  const { isOffline } = useConnectivity();
  const [optimistic, setOptimistic] = useState<Partial<Record<BooleanSettingKey, boolean>>>({});
  const [digestOverride, setDigestOverride] = useState<DigestFrequency | null>(null);
  const [localityOverride, setLocalityOverride] = useState<{ locality: string; localityLat: number; localityLng: number } | null>(null);
  // #323 C1: pending settings acumulados offline; flushean en bulk al reconectar.
  const pendingSettingsRef = useRef<Partial<UserSettings> | null>(null);

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

  // #323 C1: aplicar el snapshot pendiente al server. Expuesto para coordinacion.
  const flushPendingSettings = useCallback(async () => {
    if (!user) return;
    const snapshot = pendingSettingsRef.current;
    if (!snapshot) return;
    pendingSettingsRef.current = null;
    try {
      await updateUserSettings(user.uid, snapshot);
    } catch (err) {
      logger.error('[useUserSettings] flushPendingSettings failed:', err);
      toast.warning(MSG_COMMON.settingUpdateError);
    }
  }, [user, toast]);

  const updateSetting = useCallback(
    (key: BooleanSettingKey, value: boolean) => {
      if (!user) return;

      setOptimistic((prev) => ({ ...prev, [key]: value }));

      // #323: offline → acumular en pendingRef, flush al reconectar.
      if (isOffline) {
        pendingSettingsRef.current = { ...(pendingSettingsRef.current ?? {}), [key]: value };
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
        pendingSettingsRef.current = { ...(pendingSettingsRef.current ?? {}), ...partial };
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
        pendingSettingsRef.current = { ...(pendingSettingsRef.current ?? {}), ...partial };
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
        pendingSettingsRef.current = { ...(pendingSettingsRef.current ?? {}), notificationDigest: value };
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

  // #323 C1: flush effect — cuando vuelve online y hay pending, aplicar el snapshot.
  useEffect(() => {
    let cancelled = false;
    if (!isOffline && user && pendingSettingsRef.current) {
      const snapshot = pendingSettingsRef.current;
      pendingSettingsRef.current = null;
      updateUserSettings(user.uid, snapshot).catch((err) => {
        if (cancelled) return;
        logger.error('[useUserSettings] flush failed:', err);
        toast.warning(MSG_COMMON.settingUpdateError);
      });
    }
    return () => { cancelled = true; };
  }, [isOffline, user, toast]);

  return { settings, loading, updateSetting, updateDigestFrequency, updateLocality, clearLocality, flushPendingSettings };
}
