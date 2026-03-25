import { useMemo } from 'react';
import { usePaginatedQuery } from './usePaginatedQuery';
import { getActivityFeedCollection } from '../services/activityFeed';
import type { ActivityFeedItem } from '../types';

export function useActivityFeed(userId: string | undefined) {
  const collectionRef = useMemo(
    () => (userId ? getActivityFeedCollection(userId) : null),
    [userId],
  );

  const result = usePaginatedQuery<ActivityFeedItem>(
    collectionRef,
    [],
    'createdAt',
    20,
    userId,
  );

  return result;
}
