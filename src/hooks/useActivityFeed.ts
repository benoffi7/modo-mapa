import { useMemo } from 'react';
import type { QueryConstraint } from 'firebase/firestore';
import { usePaginatedQuery } from './usePaginatedQuery';
import { getActivityFeedCollection } from '../services/activityFeed';
import type { ActivityFeedItem } from '../types';

const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

export function useActivityFeed(userId: string | undefined) {
  const collectionRef = useMemo(
    () => (userId ? getActivityFeedCollection(userId) : null),
    [userId],
  );

  const result = usePaginatedQuery<ActivityFeedItem>(
    collectionRef,
    EMPTY_CONSTRAINTS,
    'createdAt',
    20,
    userId,
  );

  return result;
}
