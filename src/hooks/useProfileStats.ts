import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMyCheckIns } from './useMyCheckIns';
import { fetchUserRatingsCount } from '../services/ratings';
import { fetchUserFavoritesCount } from '../services/favorites';
import { fetchFollowersCount } from '../services/follows';

interface ProfileStats {
  places: number;
  reviews: number;
  followers: number;
  favorites: number;
}

export function useProfileStats(): ProfileStats {
  const { user } = useAuth();
  const { stats: checkInStats } = useMyCheckIns();
  const [counts, setCounts] = useState({ reviews: 0, followers: 0, favorites: 0 });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const uid = user.uid;

    Promise.all([
      fetchUserRatingsCount(uid),
      fetchUserFavoritesCount(uid),
      fetchFollowersCount(uid),
    ]).then(([reviews, favorites, followers]) => {
      if (!cancelled) setCounts({ reviews, favorites, followers });
    });
    return () => { cancelled = true; };
  }, [user]);

  return {
    places: checkInStats.uniqueBusinesses,
    ...counts,
  };
}
