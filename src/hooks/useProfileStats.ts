import { useState, useEffect } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { useAuth } from '../context/AuthContext';
import { useMyCheckIns } from './useMyCheckIns';
import { getCountOfflineSafe } from '../utils/getCountOfflineSafe';

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
    const uid = user.uid;

    Promise.all([
      getCountOfflineSafe(query(collection(db, COLLECTIONS.RATINGS), where('userId', '==', uid))),
      getCountOfflineSafe(query(collection(db, COLLECTIONS.FAVORITES), where('userId', '==', uid))),
      getCountOfflineSafe(query(collection(db, COLLECTIONS.FOLLOWS), where('followedId', '==', uid))),
    ]).then(([r, f, fl]) => setCounts({ reviews: r, favorites: f, followers: fl }));
  }, [user]);

  return {
    places: checkInStats.uniqueBusinesses,
    ...counts,
  };
}
