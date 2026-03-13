import { useCallback } from 'react';
import { useAsyncData } from './useAsyncData';
import { fetchUserProfile } from '../services/userProfile';
import type { UserProfileData } from '../services/userProfile';

export function useUserProfile(userId: string | null) {
  const fetcher = useCallback(async (): Promise<UserProfileData | null> => {
    if (!userId) return null;
    return fetchUserProfile(userId);
  }, [userId]);

  const { data, loading, error } = useAsyncData(fetcher);

  return {
    profile: data,
    loading: userId !== null && loading,
    error,
  };
}
