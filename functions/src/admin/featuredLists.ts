import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { assertAdmin } from '../helpers/assertAdmin';
import { ENFORCE_APP_CHECK, getDb } from '../helpers/env';

/** Extract optional databaseId from callable request data. */
function extractDbId(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'databaseId' in data) {
    const id = (data as { databaseId?: unknown }).databaseId;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

export const toggleFeaturedList = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    assertAdmin(request.auth);

    const { listId, featured } = request.data as {
      listId: string;
      featured: boolean;
    };
    if (!listId || typeof listId !== 'string') {
      throw new HttpsError('invalid-argument', 'listId required');
    }
    if (typeof featured !== 'boolean') {
      throw new HttpsError('invalid-argument', 'featured must be boolean');
    }

    const db = getDb(extractDbId(request.data));
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
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    assertAdmin(request.auth);

    const db = getDb(extractDbId(request.data));
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

/** Public callable — returns featured lists for any authenticated user. */
export const getFeaturedLists = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const db = getDb(extractDbId(request.data));
    const snap = await db
      .collection('sharedLists')
      .where('featured', '==', true)
      .orderBy('updatedAt', 'desc')
      .get();

    const lists: ListData[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ownerId: String(data.ownerId ?? ''),
        name: String(data.name ?? ''),
        description: String(data.description ?? ''),
        isPublic: data.isPublic === true,
        featured: true,
        itemCount: Number(data.itemCount ?? 0),
      };
    });

    return { lists };
  },
);
