import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { incrementBusinessCount, updateRatingAggregates } from './aggregates';
import { incrementCounter } from './counters';
import { USER_OWNED_COLLECTIONS } from '../shared/userOwnedCollections';
import type { UserOwnedCollection } from '../shared/userOwnedCollections';

const BATCH_SIZE = 500;
const CONCURRENCY = 5;

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
): Promise<void> {
  const snap = await db.collection(collectionName).where(field, '==', uid).get();
  if (snap.empty) return;
  await batchDeleteDocs(db, snap.docs.map((d) => d.ref));
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
      const needsPreQuery = entry.subcollections || entry.hasStorage || entry.cascade;
      if (needsPreQuery) {
        const snap = await db.collection(entry.collection).where(entry.field!, '==', uid).get();
        if (!snap.empty) {
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
          if (entry.hasStorage) {
            for (const doc of snap.docs) {
              const data = doc.data();
              if (data.storagePath) storagePaths.push(data.storagePath);
              if (data.thumbnailPath) storagePaths.push(data.thumbnailPath);
            }
          }
          if (entry.cascade) {
            for (const doc of snap.docs) {
              for (const cascadeCol of entry.cascade) {
                await deleteByQuery(db, cascadeCol, 'listId', doc.id);
              }
            }
          }
          await batchDeleteDocs(db, snap.docs.map((d) => d.ref));
        }
      } else {
        await deleteByQuery(db, entry.collection, entry.field!, uid);
      }
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

async function correctAggregates(db: Firestore, uid: string): Promise<void> {
  const [ratingsSnap, commentsSnap, favoritesSnap, commentLikesSnap, followsAsFollower, followsAsFollowed] =
    await Promise.all([
      db.collection('ratings').where('userId', '==', uid).get(),
      db.collection('comments').where('userId', '==', uid).get(),
      db.collection('favorites').where('userId', '==', uid).get(),
      db.collection('commentLikes').where('userId', '==', uid).get(),
      db.collection('follows').where('followerId', '==', uid).get(),
      db.collection('follows').where('followedId', '==', uid).get(),
    ]);

  // Global counters
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

  // Per-business aggregates
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

  // Comment like counts
  for (const doc of commentLikesSnap.docs) {
    const data = doc.data();
    if (data.commentId) {
      await db.doc(`comments/${data.commentId}`).update({
        likeCount: FieldValue.increment(-1),
      }).catch(() => {});
    }
  }

  // Follower/following counts
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
}

/**
 * Deletes all user-owned data from Firestore and Storage.
 * Shared by deleteUserAccount (email users) and cleanAnonymousData (anonymous users).
 */
export async function deleteAllUserData(db: Firestore, uid: string): Promise<void> {
  const storagePaths: string[] = [];

  // Correct aggregates before deletion
  await correctAggregates(db, uid);

  // Process cascade collections first
  const cascadeEntries = USER_OWNED_COLLECTIONS.filter((e) => e.cascade);
  const otherEntries = USER_OWNED_COLLECTIONS.filter((e) => !e.cascade);

  for (const entry of cascadeEntries) {
    await processCollection(db, entry, uid, storagePaths);
  }

  // Process remaining in parallel
  for (let i = 0; i < otherEntries.length; i += CONCURRENCY) {
    const chunk = otherEntries.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map((entry) => processCollection(db, entry, uid, storagePaths)));
  }

  // Storage cleanup (best-effort)
  try {
    const bucket = getStorage().bucket();
    await Promise.all([
      bucket.deleteFiles({ prefix: `feedback-media/${uid}/` }).catch(() => {}),
      ...storagePaths.map((p) => bucket.file(p).delete().catch(() => {})),
    ]);
  } catch {
    // best-effort
  }
}
