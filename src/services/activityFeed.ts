/**
 * Firestore service for the `activityFeed/{userId}/items` subcollection.
 */
import { collection } from 'firebase/firestore';
import type { CollectionReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { activityFeedItemConverter } from '../config/converters';
import type { ActivityFeedItem } from '../types';

export function getActivityFeedCollection(userId: string): CollectionReference<ActivityFeedItem> {
  return collection(db, COLLECTIONS.ACTIVITY_FEED, userId, 'items')
    .withConverter(activityFeedItemConverter) as CollectionReference<ActivityFeedItem>;
}
