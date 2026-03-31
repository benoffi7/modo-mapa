import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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
  const [optimistic, setOptimistic] = useState<Partial<Record<BooleanSettingKey, boolean>>>({});
  const [digestOverride, setDigestOverride] = useState<DigestFrequency | null>(null);
  const [localityOverride, setLocalityOverride] = useState<{ locality: string; localityLat: number; localityLng: number } | null>(null);

  const fetcher = useCallback(async (): Promise<UserSettings> => {
    if (!user) return { ...DEFAULT_SETTINGS };
    return fetchUserSettings(user.uid);
  }, [user]);

  const { data, loading } = useAsyncData(fetcher);

  const settings: UserSettings = {
    ...(data ?? DEFAULT_SETTINGS),
    ...optimistic,
    ...(digestOverride != null ? { notificationDigest: digestOverride } : {}),
    ...(localityOverride ?? {}),
  };

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
    [user, toast],
  );

  const updateLocality = useCallback(
    (locality: string, lat: number, lng: number) => {
      if (!user) return;
      setLocalityOverride({ locality, localityLat: lat, localityLng: lng });
      updateUserSettings(user.uid, { locality, localityLat: lat, localityLng: lng }).catch((err) => {
        logger.error('[useUserSettings] updateLocality failed:', err);
        setLocalityOverride(null);
      });
    },
    [user],
  );

  const clearLocality = useCallback(
    () => {
      if (!user) return;
      setLocalityOverride({ locality: '', localityLat: 0, localityLng: 0 });
      updateUserSettings(user.uid, { locality: '', localityLat: 0, localityLng: 0 }).catch((err) => {
        logger.error('[useUserSettings] clearLocality failed:', err);
        setLocalityOverride(null);
      });
    },
    [user],
  );

  const updateDigestFrequency = useCallback(
    (value: DigestFrequency) => {
      if (!user) return;
      setDigestOverride(value);
      updateUserSettings(user.uid, { notificationDigest: value }).catch((err) => {
        logger.error('[useUserSettings] updateDigestFrequency failed:', err);
        setDigestOverride(null);
      });
    },
    [user],
  );

  return { settings, loading, updateSetting, updateDigestFrequency, updateLocality, clearLocality };
}
