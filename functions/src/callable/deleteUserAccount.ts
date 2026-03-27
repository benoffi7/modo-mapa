import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { logger } from 'firebase-functions';
import { ENFORCE_APP_CHECK, getDb } from '../helpers/env';
import { incrementBusinessCount, updateRatingAggregates } from '../utils/aggregates';
import { incrementCounter } from '../utils/counters';
import { USER_OWNED_COLLECTIONS } from '../shared/userOwnedCollections';
import type { UserOwnedCollection } from '../shared/userOwnedCollections';

const BATCH_SIZE = 500;
const RATE_LIMIT_SECONDS = 60;

async function batchDeleteDocs(db: Firestore, refs: FirebaseFirestore.DocumentReference[]): Promise<void> {
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = refs.slice(i, i + BATCH_SIZE);
    for (const ref of chunk) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

async function deleteByQuery(
  db: Firestore,
  collectionName: string,
  field: string,
  uid: string,
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const snap = await db.collection(collectionName).where(field, '==', uid).get();
  if (snap.empty) return [];
  await batchDeleteDocs(db, snap.docs.map((d) => d.ref));
  return snap.docs;
}

async function processCollection(
  db: Firestore,
  entry: UserOwnedCollection,
  uid: string,
  storagePaths: string[],
): Promise<void> {
  switch (entry.type) {
    case 'doc-by-uid': {
      const docRef = db.doc(`${entry.collection}/${uid}`);
      const snap = await docRef.get();
      if (snap.exists) await docRef.delete();
      break;
    }

    case 'query': {
      // Single query for pre-processing (subcollections, storage, cascade)
      const needsPreQuery = entry.subcollections || entry.hasStorage || entry.cascade;
      if (needsPreQuery) {
        const snap = await db.collection(entry.collection).where(entry.field!, '==', uid).get();
        if (!snap.empty) {
          // Handle subcollections before deleting parent docs
          if (entry.subcollections) {
            for (const doc of snap.docs) {
              for (const sub of entry.subcollections) {
                const subSnap = await doc.ref.collection(sub).get();
                if (!subSnap.empty) {
                  await batchDeleteDocs(db, subSnap.docs.map((d) => d.ref));
                }
              }
            }
          }

          // Collect storage paths before deletion
          if (entry.hasStorage) {
            for (const doc of snap.docs) {
              const data = doc.data();
              if (data.storagePath) storagePaths.push(data.storagePath);
              if (data.thumbnailPath) storagePaths.push(data.thumbnailPath);
            }
          }

          // Handle cascade (e.g. delete listItems when sharedLists are deleted)
          if (entry.cascade) {
            for (const doc of snap.docs) {
              for (const cascadeCol of entry.cascade) {
                await deleteByQuery(db, cascadeCol, 'listId', doc.id);
              }
            }
          }

          // Delete the docs we already fetched
          await batchDeleteDocs(db, snap.docs.map((d) => d.ref));
        }
      } else {
        // Simple query-delete (no pre-processing needed)
        await deleteByQuery(db, entry.collection, entry.field!, uid);
      }

      // Delete biField docs (bidirectional relations)
      if (entry.biField) {
        await deleteByQuery(db, entry.collection, entry.biField, uid);
      }
      break;
    }

    case 'subcollection': {
      const path = entry.path!.replace('{uid}', uid);
      const snap = await db.collection(path).get();
      if (!snap.empty) {
        await batchDeleteDocs(db, snap.docs.map((d) => d.ref));
      }
      break;
    }
  }
}

export const deleteUserAccount = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    if (!request.auth.token.email) {
      throw new HttpsError('permission-denied', 'Anonymous accounts cannot be deleted via this endpoint');
    }

    const uid = request.auth.uid;
    const { databaseId } = (request.data as { databaseId?: string }) ?? {};
    const db = getDb(databaseId);

    // Rate limit: 1 per minute
    const rateLimitRef = db.doc(`_rateLimits/delete_${uid}`);
    const rateLimitSnap = await rateLimitRef.get();
    if (rateLimitSnap.exists) {
      const lastAttempt = rateLimitSnap.data()?.lastAttempt?.toDate?.();
      if (lastAttempt && Date.now() - lastAttempt.getTime() < RATE_LIMIT_SECONDS * 1000) {
        throw new HttpsError('resource-exhausted', 'Please wait before retrying');
      }
    }
    await rateLimitRef.set({ lastAttempt: FieldValue.serverTimestamp(), userId: uid });

    // Collect storage paths for cleanup
    const storagePaths: string[] = [];

    // --- Aggregate corrections (before deletion) ---
    // Count docs per business so we can decrement counters after deletion
    const [ratingsSnap, commentsSnap, favoritesSnap, commentLikesSnap, followsAsFollower, followsAsFollowed] =
      await Promise.all([
        db.collection('ratings').where('userId', '==', uid).get(),
        db.collection('comments').where('userId', '==', uid).get(),
        db.collection('favorites').where('userId', '==', uid).get(),
        db.collection('commentLikes').where('userId', '==', uid).get(),
        db.collection('follows').where('followerId', '==', uid).get(),
        db.collection('follows').where('followedId', '==', uid).get(),
      ]);

    // Decrement global counters
    const counterDeltas: Record<string, number> = {};
    if (!ratingsSnap.empty) counterDeltas.ratings = -ratingsSnap.size;
    if (!commentsSnap.empty) counterDeltas.comments = -commentsSnap.size;
    if (!favoritesSnap.empty) counterDeltas.favorites = -favoritesSnap.size;
    if (!commentLikesSnap.empty) counterDeltas.commentLikes = -commentLikesSnap.size;
    const totalFollowDocs = followsAsFollower.size + followsAsFollowed.size;
    if (totalFollowDocs > 0) counterDeltas.follows = -totalFollowDocs;

    for (const [field, delta] of Object.entries(counterDeltas)) {
      await incrementCounter(db, field, delta);
    }

    // Decrement per-business aggregates (ratings, comments, favorites)
    for (const doc of ratingsSnap.docs) {
      const data = doc.data();
      if (data.businessId && data.score) {
        await updateRatingAggregates(db, data.businessId, 'remove', data.score);
      }
    }
    for (const doc of commentsSnap.docs) {
      const data = doc.data();
      if (data.businessId && !data.parentId) {
        await incrementBusinessCount(db, 'businessComments', data.businessId, -1);
      }
    }
    for (const doc of favoritesSnap.docs) {
      const data = doc.data();
      if (data.businessId) {
        await incrementBusinessCount(db, 'businessFavorites', data.businessId, -1);
      }
    }

    // Decrement comment like counts on affected comments
    for (const doc of commentLikesSnap.docs) {
      const data = doc.data();
      if (data.commentId) {
        await db.doc(`comments/${data.commentId}`).update({
          likeCount: FieldValue.increment(-1),
        }).catch(() => {}); // comment may already be deleted
      }
    }

    // Decrement follower/following counts on affected users
    for (const doc of followsAsFollower.docs) {
      const followedId = doc.data().followedId;
      if (followedId) {
        await db.doc(`users/${followedId}`).update({
          followersCount: FieldValue.increment(-1),
        }).catch(() => {});
      }
    }
    for (const doc of followsAsFollowed.docs) {
      const followerId = doc.data().followerId;
      if (followerId) {
        await db.doc(`users/${followerId}`).update({
          followingCount: FieldValue.increment(-1),
        }).catch(() => {});
      }
    }

    // --- Delete all user-owned collections ---
    // Process cascade collections first (they delete from other collections)
    const cascadeEntries = USER_OWNED_COLLECTIONS.filter((e) => e.cascade);
    const otherEntries = USER_OWNED_COLLECTIONS.filter((e) => !e.cascade);

    for (const entry of cascadeEntries) {
      await processCollection(db, entry, uid, storagePaths);
    }

    // Process remaining collections in parallel (max 5 concurrent)
    const CONCURRENCY = 5;
    for (let i = 0; i < otherEntries.length; i += CONCURRENCY) {
      const chunk = otherEntries.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map((entry) => processCollection(db, entry, uid, storagePaths)));
    }

    // Delete storage files (best-effort, parallel)
    try {
      const bucket = getStorage().bucket();
      await Promise.all([
        bucket.deleteFiles({ prefix: `feedback-media/${uid}/` }).catch(() => {}),
        // Menu photos are stored under menus/{businessId}/ (not by uid prefix).
        // Individual paths are collected via hasStorage and deleted below.
        ...storagePaths.map((p) => bucket.file(p).delete().catch(() => {})),
      ]);
    } catch {
      // Storage cleanup is best-effort
    }

    // Delete Firebase Auth user
    try {
      await getAuth().deleteUser(uid);
    } catch (error: unknown) {
      // Ignore if user already deleted
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    const uidHash = createHash('sha256').update(uid).digest('hex').slice(0, 12);
    logger.info('account_deleted', { uidHash, timestamp: new Date().toISOString() });

    return { success: true };
  },
);
