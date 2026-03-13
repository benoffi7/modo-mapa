import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAsyncData } from './useAsyncData';
import { fetchUserSettings, updateUserSettings, DEFAULT_SETTINGS } from '../services/userSettings';
import { setAnalyticsEnabled } from '../utils/analytics';
import type { UserSettings } from '../types';

type SettingKey = keyof Omit<UserSettings, 'updatedAt'>;

export function useUserSettings() {
  const { user } = useAuth();
  const [optimistic, setOptimistic] = useState<Partial<Record<SettingKey, boolean>>>({});

  const fetcher = useCallback(async (): Promise<UserSettings> => {
    if (!user) return { ...DEFAULT_SETTINGS };
    return fetchUserSettings(user.uid);
  }, [user]);

  const { data, loading } = useAsyncData(fetcher);

  const settings: UserSettings = {
    ...(data ?? DEFAULT_SETTINGS),
    ...optimistic,
  };

  // Sync analytics enabled state with the SDK
  useEffect(() => {
    setAnalyticsEnabled(settings.analyticsEnabled);
  }, [settings.analyticsEnabled]);

  const updateSetting = useCallback(
    (key: SettingKey, value: boolean) => {
      if (!user) return;

      setOptimistic((prev) => ({ ...prev, [key]: value }));

      updateUserSettings(user.uid, { [key]: value }).catch(() => {
        // Revert on error
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      });
    },
    [user],
  );

  return { settings, loading, updateSetting };
}
