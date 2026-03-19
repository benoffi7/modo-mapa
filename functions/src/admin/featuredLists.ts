import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { assertAdmin } from '../helpers/assertAdmin';

/** Resolve Firestore instance — uses named DB when databaseId is provided (staging). */
function resolveDb(databaseId?: string) {
  return databaseId ? getFirestore(databaseId) : getFirestore();
}

export const toggleFeaturedList = onCall(
  { enforceAppCheck: false },
  async (request) => {
    assertAdmin(request.auth);

    const { listId, featured, databaseId } = request.data as {
      listId: string;
      featured: boolean;
      databaseId?: string;
    };
    if (!listId || typeof listId !== 'string') {
      throw new HttpsError('invalid-argument', 'listId required');
    }
    if (typeof featured !== 'boolean') {
      throw new HttpsError('invalid-argument', 'featured must be boolean');
    }

    const db = resolveDb(databaseId);
    const listRef = db.doc(`sharedLists/${listId}`);
    const snap = await listRef.get();

    if (!snap.exists) throw new HttpsError('not-found', 'Lista no encontrada');

    if (featured && !snap.data()?.isPublic) {
      throw new HttpsError('failed-precondition', 'Solo listas públicas pueden ser destacadas');
    }

    await listRef.update({ featured });
    return { success: true };
  },
);

interface ListData {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  isPublic: boolean;
  featured: boolean;
  itemCount: number;
}

export const getPublicLists = onCall(
  { enforceAppCheck: false },
  async (request) => {
    assertAdmin(request.auth);

    const { databaseId } = (request.data ?? {}) as { databaseId?: string };
    const db = resolveDb(databaseId);
    const snap = await db
      .collection('sharedLists')
      .where('isPublic', '==', true)
      .orderBy('updatedAt', 'desc')
      .get();

    const lists: ListData[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ownerId: String(data.ownerId ?? ''),
        name: String(data.name ?? ''),
        description: String(data.description ?? ''),
        isPublic: true,
        featured: data.featured === true,
        itemCount: Number(data.itemCount ?? 0),
      };
    });

    return { lists };
  },
);
