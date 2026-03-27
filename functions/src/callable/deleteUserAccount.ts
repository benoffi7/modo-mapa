import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { createHash } from 'crypto';
import { logger } from 'firebase-functions';
import { ENFORCE_APP_CHECK, getDb } from '../helpers/env';
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
      // Handle subcollections before deleting parent docs
      if (entry.subcollections) {
        const snap = await db.collection(entry.collection).where(entry.field!, '==', uid).get();
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
        const snap = await db.collection(entry.collection).where(entry.field!, '==', uid).get();
        for (const doc of snap.docs) {
          const data = doc.data();
          if (data.storagePath) storagePaths.push(data.storagePath);
          if (data.thumbnailPath) storagePaths.push(data.thumbnailPath);
        }
      }

      // Handle cascade (e.g. delete listItems when sharedLists are deleted)
      if (entry.cascade) {
        const snap = await db.collection(entry.collection).where(entry.field!, '==', uid).get();
        for (const doc of snap.docs) {
          for (const cascadeCol of entry.cascade) {
            await deleteByQuery(db, cascadeCol, 'listId', doc.id);
          }
        }
      }

      // Delete primary docs
      await deleteByQuery(db, entry.collection, entry.field!, uid);

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

    // Process all user-owned collections
    for (const entry of USER_OWNED_COLLECTIONS) {
      await processCollection(db, entry, uid, storagePaths);
    }

    // Delete storage files by prefix
    try {
      const bucket = getStorage().bucket();
      await bucket.deleteFiles({ prefix: `feedback-media/${uid}/` }).catch(() => {});
      await bucket.deleteFiles({ prefix: `menu-photos/${uid}/` }).catch(() => {});

      // Delete any individually collected paths
      for (const p of storagePaths) {
        await bucket.file(p).delete().catch(() => {});
      }
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
