/**
 * Firestore service for the `follows` collection.
 *
 * All Firestore reads/writes for follows go through this module so
 * components never import Firestore SDK directly.
 */
import {
  collection, doc, setDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, limit, startAfter, serverTimestamp,
} from 'firebase/firestore';
import type { CollectionReference, QueryDocumentSnapshot, QueryConstraint } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/collections';
import { followConverter } from '../config/converters';
import { invalidateQueryCache } from './queryCache';
import { trackEvent } from '../utils/analytics';
import { EVT_FOLLOW, EVT_UNFOLLOW } from '../constants/analyticsEvents';
import type { Follow } from '../types';

const MAX_FOLLOWS = 200;
const PAGE_SIZE = 20;

export function getFollowsCollection(): CollectionReference<Follow> {
  return collection(db, COLLECTIONS.FOLLOWS).withConverter(followConverter) as CollectionReference<Follow>;
}

function docId(followerId: string, followedId: string): string {
  return `${followerId}__${followedId}`;
}

export async function followUser(followerId: string, followedId: string): Promise<void> {
  if (!followerId || !followedId) throw new Error('followerId and followedId are required');
  if (followerId === followedId) throw new Error('Cannot follow yourself');

  // Check max follows limit client-side
  const followingSnap = await getDocs(
    query(collection(db, COLLECTIONS.FOLLOWS), where('followerId', '==', followerId)),
  );
  if (followingSnap.size >= MAX_FOLLOWS) {
    throw new Error('Has alcanzado el limite de 200 usuarios seguidos');
  }

  await setDoc(doc(db, COLLECTIONS.FOLLOWS, docId(followerId, followedId)), {
    followerId,
    followedId,
    createdAt: serverTimestamp(),
  });
  invalidateQueryCache(COLLECTIONS.FOLLOWS, followerId);
  trackEvent(EVT_FOLLOW, { followed_id: followedId });
}

export async function unfollowUser(followerId: string, followedId: string): Promise<void> {
  if (!followerId || !followedId) throw new Error('followerId and followedId are required');
  await deleteDoc(doc(db, COLLECTIONS.FOLLOWS, docId(followerId, followedId)));
  invalidateQueryCache(COLLECTIONS.FOLLOWS, followerId);
  trackEvent(EVT_UNFOLLOW, { followed_id: followedId });
}

export async function isFollowing(followerId: string, followedId: string): Promise<boolean> {
  if (!followerId || !followedId) return false;
  const snap = await getDoc(doc(db, COLLECTIONS.FOLLOWS, docId(followerId, followedId)));
  return snap.exists();
}

export async function fetchFollowing(
  userId: string,
  pageSize = PAGE_SIZE,
  afterDoc?: QueryDocumentSnapshot,
): Promise<{ docs: QueryDocumentSnapshot<Follow>[]; hasMore: boolean }> {
  const constraints: QueryConstraint[] = [
    where('followerId', '==', userId),
    orderBy('createdAt', 'desc'),
  ];
  if (afterDoc) constraints.push(startAfter(afterDoc));
  constraints.push(limit(pageSize + 1));

  const snap = await getDocs(query(getFollowsCollection(), ...constraints));
  const hasMore = snap.docs.length > pageSize;
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
  return { docs, hasMore };
}

export async function fetchFollowers(
  userId: string,
  pageSize = PAGE_SIZE,
  afterDoc?: QueryDocumentSnapshot,
): Promise<{ docs: QueryDocumentSnapshot<Follow>[]; hasMore: boolean }> {
  const constraints: QueryConstraint[] = [
    where('followedId', '==', userId),
    orderBy('createdAt', 'desc'),
  ];
  if (afterDoc) constraints.push(startAfter(afterDoc));
  constraints.push(limit(pageSize + 1));

  const snap = await getDocs(query(getFollowsCollection(), ...constraints));
  const hasMore = snap.docs.length > pageSize;
  const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
  return { docs, hasMore };
}

// searchUsers moved to src/services/users.ts
