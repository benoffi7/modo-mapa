import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { countUnreadRecommendations } from '../services/recommendations';

export function useUnreadRecommendations() {
  const { user } = useAuth();
  const isAuth = !!user && !user.isAnonymous;
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(isAuth);

  useEffect(() => {
    if (!user || user.isAnonymous) return;

    let cancelled = false;
    countUnreadRecommendations(user.uid)
      .then((count) => { if (!cancelled) setUnreadCount(count); })
      .catch(() => { if (!cancelled) setUnreadCount(0); })  
      .finally(() => { if (!cancelled) setLoading(false); });  
    return () => { cancelled = true; };
  }, [user]);

  return { unreadCount, loading };
}
